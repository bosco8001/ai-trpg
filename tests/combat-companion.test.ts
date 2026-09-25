import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { advanceCombatTurn, defendCombatTurn, resolveCompanionTurn, resolveNormalAttack,
  rollInitiative, startCombat } from "../src/domain/combat.js";
import { createCombatState } from "../src/domain/combat-state.js";
import { createGameState } from "../src/domain/game.js";
import { setCompanionTacticPreference } from "../src/domain/party.js";
import { createLegacyPartyMembers } from "../src/domain/party-tactics.js";
import { buildApp } from "../src/server/app.js";
import { createPhase22CombatFixtureRoller, SequenceD20Roller } from "../src/server/combat/dice.js";
import { PHASE22_TEST_COMBAT_PARTICIPANTS, TEST_COMBAT_PARTICIPANTS } from "../src/server/combat/fixtures.js";
import { createDomainSession, createPersistedDomainSession } from "../src/server/domain-session.js";
import { createTestGameState } from "../src/server/test-game-state.js";
import { hydrateStateRow, PostgresGameStateRepository } from "../src/server/postgres-game-state-repository.js";
import { isAuthoritativeGameStateView, isCompanionActResponse } from "../src/shared/game-state.js";
import { canPlayerUseNormalAttack } from "../src/web/combat-ui.js";
import { CombatPage } from "../src/web/CombatPage.js";
import { executeCompanionTurn } from "../src/web/api.js";

function ok<T extends { readonly ok: boolean }>(result: T): asserts result is Extract<T, { ok: true }> {
  assert.equal(result.ok, true);
}

function started() {
  const result = startCombat(createTestGameState(), { expectedRevision: 0 }, PHASE22_TEST_COMBAT_PARTICIPANTS,
    createPhase22CombatFixtureRoller("normal"));
  ok(result);
  return result.state;
}

function atCompanion(state = started()) {
  while (state.combat?.status === "active" && state.combat.currentActorId !== "TEST-companion-1") {
    const result = advanceCombatTurn(state, { expectedRevision: state.revision });
    ok(result);
    state = result.state;
  }
  return state;
}

test("Phase 22 TEST 隊友擲一次先攻並依總值排序；平手沿原重擲路徑", () => {
  const state = started();
  assert.deepEqual(state.combat?.turnOrder, ["TEST-enemy-1", "TEST-player", "TEST-enemy-2", "TEST-companion-1"]);
  assert.deepEqual(state.combat?.participants.find((entry) => entry.id === "TEST-companion-1")?.initiative,
    { baseD20: 4, dexterityModifier: 0, total: 4, tieBreakRolls: [] });
  assert.equal(state.combat?.participants.find((entry) => entry.id === "TEST-companion-1")?.row, "back");
  assert.equal(isAuthoritativeGameStateView(state), true);
  const rolls: number[] = [];
  const dice = [10, 11, 6, 3, 7, 7, 4, 15];
  const tied = rollInitiative(PHASE22_TEST_COMBAT_PARTICIPANTS, { d20: () => {
    const roll = dice[rolls.length]; assert.ok(roll); rolls.push(roll); return roll;
  } });
  assert.equal(rolls.length, 8);
  assert.deepEqual(tied.turnOrder, ["TEST-enemy-1", "TEST-player", "TEST-enemy-2", "TEST-companion-1"]);
  assert.deepEqual(tied.participants.find((entry) => entry.id === "TEST-companion-1")?.initiative.tieBreakRolls, []);
});

test("TEST A 由 server 選合法前排目標，沿 Phase 13 裁定並只提交一次", () => {
  const before = atCompanion();
  let rolls = 0;
  const result = resolveCompanionTurn(before, { expectedRevision: before.revision }, { d20: () => ++rolls === 1 ? 1 : 1 });
  ok(result);
  assert.equal(rolls, 2);
  assert.deepEqual(result.effect, { type: "companion-action-resolved", selectedAction: "normal-attack" });
  assert.equal(result.state.revision, before.revision + 1);
  assert.equal(result.state.combat?.round, 2);
  assert.equal(result.state.combat?.currentActorId, "TEST-enemy-1");
  const action = result.state.combat?.lastAction;
  assert.equal(action?.type, "normal-attack");
  if (action?.type !== "normal-attack") throw new Error("normal attack expected");
  assert.equal(action.actorId, "TEST-companion-1");
  assert.equal(action.targetId, "TEST-enemy-1");
  assert.equal(action.attack.total, 3);
  assert.equal(action.evasion.total, 2);
  assert.equal(action.outcome, "hit"); // raw 1 is not automatic miss
  assert.equal(action.tacticPreferenceId, "TEST-tactic-a");
  assert.equal(Object.hasOwn(action, "damage"), false);
  assert.equal(Object.hasOwn(result.state.combat.participants[0]!, "hp"), false);
  assert.equal(isAuthoritativeGameStateView(result.state), true);
});

test("TEST B 防禦不擲骰；最後一刻 A→B 與 B→A 使用最新權威偏好", () => {
  const before = atCompanion();
  const toB = setCompanionTacticPreference(before, { expectedRevision: before.revision,
    companionId: "TEST-companion-1", tacticPreferenceId: "TEST-tactic-b" });
  ok(toB);
  assert.equal(toB.state.combat?.currentActorId, "TEST-companion-1");
  assert.deepEqual(toB.state.combat, before.combat);
  const defended = resolveCompanionTurn(toB.state, { expectedRevision: toB.state.revision }, {
    d20: () => { throw new Error("defend must not roll"); },
  });
  ok(defended);
  assert.equal(defended.state.combat?.lastAction?.type, "defend");
  assert.equal(defended.state.combat?.lastAction?.tacticPreferenceId, "TEST-tactic-b");
  assert.equal(defended.state.revision, toB.state.revision + 1);
  assert.equal(defended.state.combat?.currentActorId, "TEST-enemy-1");
  const backToA = setCompanionTacticPreference(toB.state, { expectedRevision: toB.state.revision,
    companionId: "TEST-companion-1", tacticPreferenceId: "TEST-tactic-a" });
  ok(backToA);
  const attacked = resolveCompanionTurn(backToA.state, { expectedRevision: backToA.state.revision }, new SequenceD20Roller([10, 8]));
  ok(attacked);
  assert.equal(attacked.state.combat?.lastAction?.type, "normal-attack");
  assert.equal(attacked.state.combat?.lastAction?.tacticPreferenceId, "TEST-tactic-a");
});

test("非隊友、ended、stale、未知偏好與注入欄位全部在擲骰前拒絕", () => {
  const player = (() => {
    const first = started();
    const next = advanceCombatTurn(first, { expectedRevision: first.revision }); ok(next); return next.state;
  })();
  const enemy = started();
  const companion = atCompanion();
  let rolls = 0;
  const roller = { d20: () => { rolls += 1; return 10; } };
  for (const state of [enemy, player]) {
    const result = resolveCompanionTurn(state, { expectedRevision: state.revision }, roller);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "not-companion-turn");
  }
  const stale = resolveCompanionTurn(companion, { expectedRevision: companion.revision - 1 }, roller);
  assert.equal(stale.ok, false); if (!stale.ok) assert.equal(stale.code, "stale-revision");
  for (const extra of ["action", "targetId", "actorId", "companionId", "attackRoll", "evasionRoll", "damage", "nextActor", "tacticPreferenceId"]) {
    const result = resolveCompanionTurn(companion, { expectedRevision: companion.revision, [extra]: "injected" }, roller);
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.code, "invalid-command");
  }
  const unknown = createGameState({ ...companion, partyMembers: [{ ...companion.partyMembers[0]!, tacticPreferenceId: "opaque-future" }] });
  const rejected = resolveCompanionTurn(unknown, { expectedRevision: unknown.revision }, roller);
  assert.equal(rejected.ok, false); if (!rejected.ok) assert.equal(rejected.code, "unsupported-companion-tactic");
  const unset = createGameState({ ...companion, partyMembers: [{ ...companion.partyMembers[0]!, tacticPreferenceId: null }] });
  assert.equal(resolveCompanionTurn(unset, { expectedRevision: unset.revision }, roller).ok, false);
  const ended = createGameState({ ...companion, combat: createCombatState({ ...companion.combat,
    status: "ended", endReason: "escaped", currentActorId: null, currentTurnIndex: null,
    lastAction: { type: "run", actorId: "TEST-player", round: 1, rawD20: 8,
      dexterityModifier: 2, racialModifier: 0, total: 10, dc: 8, outcome: "success" },
    activeCastings: [] }) });
  const endedResult = resolveCompanionTurn(ended, { expectedRevision: ended.revision }, roller);
  assert.equal(endedResult.ok, false); if (!endedResult.ok) assert.equal(endedResult.code, "combat-ended");
  assert.equal(rolls, 0);
  assert.equal(companion.combat?.currentActorId, "TEST-companion-1");
});

test("第二顆攻擊骰失敗不留下部分狀態；無合法目標固定防禦", () => {
  const before = atCompanion();
  let rolls = 0;
  const failure = resolveCompanionTurn(before, { expectedRevision: before.revision }, { d20: () => {
    rolls += 1; if (rolls === 2) throw new Error("roller failed"); return 10;
  } });
  assert.equal(failure.ok, false); if (!failure.ok) assert.equal(failure.code, "invalid-roll");
  assert.deepEqual(before.combat?.lastAction, null);
  assert.equal(before.combat?.currentActorId, "TEST-companion-1");
  const noEnemies = startCombat(createTestGameState(), { expectedRevision: 0 },
    PHASE22_TEST_COMBAT_PARTICIPANTS.filter((entry) => entry.side === "party"), new SequenceD20Roller([1, 20]));
  ok(noEnemies);
  const fallback = resolveCompanionTurn(noEnemies.state, { expectedRevision: noEnemies.state.revision }, { d20: () => {
    throw new Error("fallback must not roll");
  } });
  ok(fallback);
  assert.equal(fallback.state.combat?.lastAction?.type, "defend");
});

test("隊友 Turn 的玩家指令均受保護；舊戰鬥 hydrate 不重建名冊", () => {
  const before = atCompanion();
  const attack = resolveNormalAttack(before, { expectedRevision: before.revision, targetId: "TEST-enemy-1" }, new SequenceD20Roller([20, 1]));
  const defend = defendCombatTurn(before, { expectedRevision: before.revision });
  const advance = advanceCombatTurn(before, { expectedRevision: before.revision });
  assert.equal(attack.ok, false); assert.equal(defend.ok, false);
  assert.equal(advance.ok, false); if (!advance.ok) assert.equal(advance.code, "companion-turn");
  assert.equal(canPlayerUseNormalAttack(before.combat!, false), false);
  const old = startCombat(createTestGameState(), { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS,
    new SequenceD20Roller([12, 17, 8]));
  ok(old);
  const row = { character_id: "TEST-character", revision: String(old.state.revision), snapshot: {
    activity: old.state.activity, character: old.state.character, inventory: old.state.inventory,
    partyMembers: old.state.partyMembers, exploration: old.state.exploration, combat: old.state.combat,
  } };
  const hydrated = hydrateStateRow(row);
  assert.deepEqual(hydrated.combat, old.state.combat);
  assert.equal(hydrated.combat?.participants.length, 3);
  assert.equal(hydrated.partyMembers[0]?.id, "TEST-companion-1");
});

test("companion API 僅接受 revision；成功回權威 state，stale／注入不改狀態", async () => {
  const session = createDomainSession(atCompanion());
  const app = await buildApp({ domainSession: session, combatSandbox: true,
    combatActionRoller: new SequenceD20Roller([10, 8]) });
  try {
    const before = session.getState();
    const injected = await app.inject({ method: "POST", url: "/api/combat/companion/act",
      payload: { expectedRevision: before.revision, action: "normal-attack", targetId: "TEST-enemy-2", attackRoll: 20 } });
    assert.equal(injected.statusCode, 400);
    assert.deepEqual(session.getState(), before);
    const stale = await app.inject({ method: "POST", url: "/api/combat/companion/act",
      payload: { expectedRevision: before.revision - 1 } });
    assert.equal(stale.statusCode, 409);
    assert.equal(stale.json().error, "stale-revision");
    const acted = await app.inject({ method: "POST", url: "/api/combat/companion/act",
      payload: { expectedRevision: before.revision } });
    assert.equal(acted.statusCode, 200);
    assert.equal(isCompanionActResponse(acted.json()), true);
    assert.equal(acted.json().state.combat.lastAction.targetId, "TEST-enemy-1");
    assert.equal(session.getState().revision, before.revision + 1);
  } finally { await app.close(); }
});

test("隊友當前 Turn 的 Phase 21 API 改 B 後，同一 Turn 立刻防禦", async () => {
  const session = createDomainSession(atCompanion());
  const app = await buildApp({ domainSession: session, combatSandbox: true,
    combatActionRoller: { d20: () => { throw new Error("B must not roll"); } } });
  try {
    const before = session.getState();
    const changed = await app.inject({ method: "POST", url: "/api/combat/party/tactic", payload: {
      expectedRevision: before.revision, companionId: "TEST-companion-1", tacticPreferenceId: "TEST-tactic-b",
    } });
    assert.equal(changed.statusCode, 200);
    assert.equal(changed.json().state.combat.currentActorId, "TEST-companion-1");
    const acted = await app.inject({ method: "POST", url: "/api/combat/companion/act",
      payload: { expectedRevision: before.revision + 1 } });
    assert.equal(acted.statusCode, 200);
    assert.equal(acted.json().state.combat.lastAction.type, "defend");
    assert.equal(acted.json().state.combat.lastAction.tacticPreferenceId, "TEST-tactic-b");
  } finally { await app.close(); }
});

test("前端只送 revision；隊友卡、高亮、行動按鈕與結果可從權威 state 顯示", async () => {
  const before = atCompanion();
  const action = resolveCompanionTurn(before, { expectedRevision: before.revision }, new SequenceD20Roller([10, 8]));
  ok(action);
  const response = { sandbox: true, storage: "memory" as const, effect: action.effect, state: action.state };
  const result = await executeCompanionTurn(before.revision, async (url, init) => {
    assert.equal(url, "/api/combat/companion/act");
    assert.equal(init?.body, JSON.stringify({ expectedRevision: before.revision }));
    return Response.json(response);
  });
  assert.equal(result.state.combat?.lastAction?.type, "normal-attack");
  const currentMarkup = renderToStaticMarkup(createElement(CombatPage, {
    gameState: { sandbox: true, storage: "memory", state: before }, stateError: null,
    onStateUpdate: () => {}, onRetryState: async () => ({ sandbox: true, storage: "memory" as const, state: before }),
  }));
  assert.match(currentMarkup, /TEST 隊友/);
  assert.match(currentMarkup, /TEST：執行隊友回合/);
  assert.match(currentMarkup, /data-current="true"/);
  const afterMarkup = renderToStaticMarkup(createElement(CombatPage, {
    gameState: { sandbox: true, storage: "memory", state: action.state }, stateError: null,
    onStateUpdate: () => {}, onRetryState: async () => ({ sandbox: true, storage: "memory" as const, state: action.state }),
  }));
  assert.match(afterMarkup, /TEST 隊友自主選擇：普通攻擊/);
  assert.doesNotMatch(afterMarkup, /傷害：0|HP：0/);
});

test("PostgreSQL 重建 repository／session 後保留隊友先攻、順序、偏好與結果", {
  skip: !process.env.TEST_DATABASE_URL && "需提供隔離的 TEST_DATABASE_URL 並先執行 migration。",
}, async () => {
  const id = `TEST-phase22-${randomUUID()}`;
  const seed = createGameState({ ...createTestGameState(), character: { ...createTestGameState().character, id },
    partyMembers: createLegacyPartyMembers("TEST-character") });
  const poolA = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 2 });
  let poolB: pg.Pool | undefined;
  try {
    const sessionA = createPersistedDomainSession(new PostgresGameStateRepository(poolA), seed);
    const start = await sessionA.startCombat({ expectedRevision: 0 }, PHASE22_TEST_COMBAT_PARTICIPANTS,
      createPhase22CombatFixtureRoller("normal")); ok(start);
    let state = start.state;
    while (state.combat?.status === "active" && state.combat.currentActorId !== "TEST-companion-1") {
      const next = await sessionA.advanceCombat({ expectedRevision: state.revision }); ok(next); state = next.state;
    }
    const tactic = await sessionA.setCompanionTacticPreference({ expectedRevision: state.revision,
      companionId: "TEST-companion-1", tacticPreferenceId: "TEST-tactic-b" }); ok(tactic);
    const acted = await sessionA.actCompanion({ expectedRevision: tactic.state.revision }, new SequenceD20Roller([])); ok(acted);
    const saved = acted.state;
    await poolA.end();
    poolB = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 2 });
    const sessionB = createPersistedDomainSession(new PostgresGameStateRepository(poolB), seed);
    assert.deepEqual(await sessionB.getState(), saved);
    const next = await sessionB.advanceCombat({ expectedRevision: saved.revision }); ok(next);
    assert.equal(next.state.revision, saved.revision + 1);
  } finally {
    if (poolB) {
      await poolB.query("DELETE FROM game_states WHERE character_id = $1", [id]);
      await poolB.end();
    } else { await poolA.end().catch(() => {}); }
  }
});
