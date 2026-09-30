import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { applyCommand, createGameState, gameStateContents, type GameState } from "./helpers/phase26-fixture.js";
import { advanceCombatTurn, cancelCasting, continueCasting, defendCombatTurn, getCurrentCombatItemOptions,
  getCurrentNormalAttackOptions, getCurrentPhysicalSkillOptions, getCurrentRowMoveOptions, moveCombatRow,
  resolveNormalAttack, runFromCombat, startCasting, startCombat, useCombatItem, usePhysicalSkill } from "../src/domain/combat.js";
import { TEST_COMBAT_CONSUMABLE_ID } from "../src/domain/combat-items.js";
import { createCombatFixtureRoller, SequenceD20Roller } from "../src/server/combat/dice.js";
import { TEST_COMBAT_PARTICIPANTS } from "../src/server/combat/fixtures.js";
import { buildApp } from "./helpers/phase26-fixture.js";
import { createDomainSession, createPersistedDomainSession } from "../src/server/domain-session.js";
import { createTestGameState } from "./helpers/phase26-fixture.js";
import { hydrateStateRow, PostgresGameStateRepository } from "../src/server/postgres-game-state-repository.js";
import { isAuthoritativeGameStateResponse, isCastingResponse } from "../src/shared/game-state.js";
import { executeCasting } from "../src/web/api.js";
import { CombatPage } from "../src/web/CombatPage.js";

function ok<T extends { readonly ok: boolean }>(result: T): asserts result is Extract<T, { readonly ok: true }> {
  assert.equal(result.ok, true);
}
function equipped(skillIds: string[] = ["TEST-skill-2"]): GameState {
  const result = applyCommand(createTestGameState(), { type: "set-equipped-skills", expectedRevision: 0, skillIds });
  ok(result); return result.state;
}
function player(initial = equipped()): GameState {
  const started = startCombat(initial, { expectedRevision: initial.revision }, TEST_COMBAT_PARTICIPANTS,
    createCombatFixtureRoller("normal")); ok(started);
  const advanced = advanceCombatTurn(started.state, { expectedRevision: started.state.revision }); ok(advanced);
  return advanced.state;
}
function nextPlayer(state: GameState): GameState {
  let next = state;
  for (let i = 0; i < 2; i += 1) {
    const result = advanceCombatTurn(next, { expectedRevision: next.revision }); ok(result); next = result.state;
  }
  return next;
}
function page(state: GameState) {
  return renderToStaticMarkup(createElement(CombatPage, { gameState: { sandbox: true, storage: "memory", state },
    stateError: null, onStateUpdate: () => undefined,
    onRetryState: async () => ({ sandbox: true, storage: "memory" as const, state }) }));
}

test("TEST 法術已學且裝備；完整 18 MP 門檻先於每回合 6 MP", () => {
  const ready = player();
  assert.equal(ready.combat!.participants.find(p=>p.side === "party" && p.controlledBy !== "companion")!.mp!.currentMp, 24);
  const low = createGameState({ ...ready, combat:{...ready.combat,participants:ready.combat!.participants.map(p=>p.id === "TEST-player" ? {...p,mp:{...p.mp!,currentMp:10}} : p)} });
  const rejected = startCasting(low, { expectedRevision: low.revision, skillId: "TEST-skill-2" });
  assert.deepEqual([rejected.ok, rejected.ok ? null : rejected.code], [false, "insufficient-mp"]);
  assert.equal(low.combat!.participants.find(p=>p.side === "party" && p.controlledBy !== "companion")!.mp!.currentMp, 10);
  assert.deepEqual(low.combat?.activeCastings, []);
  for (const [state, skillId, code] of [
    [player(createTestGameState()), "TEST-skill-2", "skill-not-equipped"],
    [ready, "UNKNOWN", "unknown-skill"],
    [player(equipped(["TEST-skill-1"])), "TEST-skill-1", "not-magic-skill"],
  ] as const) {
    const result = startCasting(state, { expectedRevision: state.revision, skillId });
    assert.deepEqual([result.ok, result.ok ? null : result.code], [false, code]);
  }
  const unlearned = createGameState({ ...ready, character: {
    ...ready.character, learnedActiveSkillIds: [], equippedSkillIds: [],
  } });
  const notLearned = startCasting(unlearned, { expectedRevision: unlearned.revision, skillId: "TEST-skill-2" });
  assert.deepEqual([notLearned.ok, notLearned.ok ? null : notLearned.code], [false, "skill-not-learned"]);
});

test("三回合詠唱跨敵方回合保存 MP 與進度；完成沒有命中、傷害或反噬", () => {
  const initial = player(equipped(["TEST-skill-1", "TEST-skill-2"]));
  const r1 = startCasting(initial, { expectedRevision: initial.revision, skillId: "TEST-skill-2" }); ok(r1);
  assert.deepEqual([r1.state.combat!.participants.find(p=>p.side === "party" && p.controlledBy !== "companion")!.mp!.currentMp, r1.state.combat?.activeCastings[0]?.completedCastingTurns,
    r1.state.combat?.activeCastings[0]?.mpSpent, r1.state.combat?.currentActorId, r1.state.revision],
  [18, 1, 6, "TEST-enemy-2", initial.revision + 1]);
  assert.equal(r1.state.combat?.lastAction?.type, "casting-start");
  assert.equal(gameStateContents(r1.state).combat?.status,"active");
  const r2 = nextPlayer(r1.state);
  assert.deepEqual(r2.combat?.activeCastings, r1.state.combat?.activeCastings);
  assert.equal(r2.combat!.participants.find(p=>p.side === "party" && p.controlledBy !== "companion")!.mp!.currentMp, 18);
  assert.equal(r2.combat?.round, 2);
  const continued = continueCasting(r2, { expectedRevision: r2.revision }); ok(continued);
  assert.deepEqual([continued.state.combat!.participants.find(p=>p.side === "party" && p.controlledBy !== "companion")!.mp!.currentMp, continued.state.combat?.activeCastings[0]?.completedCastingTurns,
    continued.state.combat?.activeCastings[0]?.mpSpent, continued.state.combat?.currentActorId,
    continued.state.revision], [12, 2, 12, "TEST-enemy-2", r2.revision + 1]);
  const r3 = nextPlayer(continued.state);
  assert.equal(r3.combat!.participants.find(p=>p.side === "party" && p.controlledBy !== "companion")!.mp!.currentMp, 12);
  const completed = continueCasting(r3, { expectedRevision: r3.revision }); ok(completed);
  assert.deepEqual([completed.state.combat!.participants.find(p=>p.side === "party" && p.controlledBy !== "companion")!.mp!.currentMp, completed.state.combat?.activeCastings,
    completed.state.combat?.lastAction?.type, completed.state.combat?.currentActorId,
    completed.state.revision], [6, [], "casting-complete", "TEST-enemy-2", r3.revision + 1]);
  assert.deepEqual(completed.state.combat?.lastAction, { type: "casting-complete", actorId: "TEST-player",
    skillId: "TEST-skill-2", round: 3, mpSpentThisAction: 6, totalMpSpent: 18,
    completedCastingTurns: 3, totalCastingTurns: 3 });
  assert.equal(isAuthoritativeGameStateResponse({ sandbox: true, storage: "memory", state: completed.state }), true);
  assert.equal(JSON.stringify(completed.state.combat?.lastAction).includes("damage"), false);
  assert.equal(JSON.stringify(completed.state.combat?.lastAction).includes("success"), false);
});

test("詠唱時其他權威行動與 TEST 跳回合受阻；取消不退 MP 且不推進 Turn", () => {
  const initial = player(equipped(["TEST-skill-1", "TEST-skill-2"]));
  const started = startCasting(initial, { expectedRevision: initial.revision, skillId: "TEST-skill-2" }); ok(started);
  const ownTurn = nextPlayer(started.state);
  const before = ownTurn;
  const attacks = getCurrentNormalAttackOptions(ownTurn); ok(attacks);
  assert.equal(attacks.options.canPlayerAct, false);
  const rows = getCurrentRowMoveOptions(ownTurn); ok(rows);
  assert.deepEqual(rows.options.legalTargetRows, []);
  const items = getCurrentCombatItemOptions(ownTurn); ok(items);
  assert.equal(items.options.items[0]?.unavailableReason, "casting-active");
  const skills = getCurrentPhysicalSkillOptions(ownTurn); ok(skills);
  assert.equal(skills.options.skills[0]?.unavailableReason, "casting-active");
  const attempts = [
    resolveNormalAttack(ownTurn, { expectedRevision: ownTurn.revision, targetId: "TEST-enemy-1" }, new SequenceD20Roller([10, 8])),
    usePhysicalSkill(ownTurn, { expectedRevision: ownTurn.revision, skillId: "TEST-skill-1", targetId: "TEST-enemy-1" }, new SequenceD20Roller([10, 8])),
    defendCombatTurn(ownTurn, { expectedRevision: ownTurn.revision }),
    moveCombatRow(ownTurn, { expectedRevision: ownTurn.revision, targetRow: "back" }),
    useCombatItem(ownTurn, { expectedRevision: ownTurn.revision, itemId: TEST_COMBAT_CONSUMABLE_ID }),
    runFromCombat(ownTurn, { expectedRevision: ownTurn.revision }, new SequenceD20Roller([8])),
    startCasting(ownTurn, { expectedRevision: ownTurn.revision, skillId: "TEST-skill-2" }),
    advanceCombatTurn(ownTurn, { expectedRevision: ownTurn.revision }),
  ];
  for (const attempt of attempts) assert.deepEqual([attempt.ok, attempt.ok ? null : attempt.code], [false, "casting-active"]);
  assert.deepEqual(ownTurn, before);
  const cancelled = cancelCasting(ownTurn, { expectedRevision: ownTurn.revision }); ok(cancelled);
  assert.deepEqual([cancelled.state.combat!.participants.find(p=>p.side === "party" && p.controlledBy !== "companion")!.mp!.currentMp, cancelled.state.combat?.activeCastings,
    cancelled.state.combat?.currentActorId, cancelled.state.combat?.round, cancelled.state.revision],
  [18, [], "TEST-player", 2, ownTurn.revision + 1]);
  assert.equal(cancelled.state.combat?.lastAction?.type, "casting-cancel");
  const defended = defendCombatTurn(cancelled.state, { expectedRevision: cancelled.state.revision }); ok(defended);
  assert.equal(defended.state.combat?.currentActorId, "TEST-enemy-2");
});

test("stale、注入、非施法者回合及 ended combat 均不修改狀態", () => {
  const own = player();
  for (const payload of [
    { expectedRevision: own.revision - 1, skillId: "TEST-skill-2" },
    { expectedRevision: own.revision, skillId: "TEST-skill-2", actorId: "TEST-player" },
    { expectedRevision: own.revision, skillId: "TEST-skill-2", equipped: true },
    { expectedRevision: own.revision, skillId: "TEST-skill-2", totalMpCost: 0 },
    { expectedRevision: own.revision, skillId: "TEST-skill-2", progress: 3 },
    { expectedRevision: own.revision, skillId: "TEST-skill-2", damage: 999, success: true },
  ]) assert.equal(startCasting(own, payload).ok, false);
  const started = startCasting(own, { expectedRevision: own.revision, skillId: "TEST-skill-2" }); ok(started);
  assert.deepEqual([continueCasting(started.state, { expectedRevision: started.state.revision }).ok,
    cancelCasting(started.state, { expectedRevision: started.state.revision }).ok], [false, false]);
  const next = nextPlayer(started.state);
  for (const operation of [continueCasting, cancelCasting]) {
    assert.equal(operation(next, { expectedRevision: next.revision - 1 }).ok, false);
    for (const injected of [{ actorId: "TEST-player" }, { currentMp: 999 }, { completed: true }, { damage: 99, success: true }]) {
      assert.equal(operation(next, { expectedRevision: next.revision, ...injected }).ok, false);
    }
  }
  const escaped = runFromCombat(own, { expectedRevision: own.revision }, new SequenceD20Roller([8])); ok(escaped);
  for (const operation of [startCasting, continueCasting, cancelCasting]) {
    const body = operation === startCasting
      ? { expectedRevision: escaped.state.revision, skillId: "TEST-skill-2" }
      : { expectedRevision: escaped.state.revision };
    const result = operation(escaped.state, body);
    assert.deepEqual([result.ok, result.ok ? null : result.code], [false, "combat-ended"]);
  }
  assert.equal(own.revision, 3);
});

test("舊 TEST 快照只補工程 MP／空詠唱；UI 顯示權威進度與完整 MP 門檻", () => {
  const started = startCasting(player(), { expectedRevision: 3, skillId: "TEST-skill-2" }); ok(started);
  const old = JSON.parse(JSON.stringify(started.state)) as Record<string, unknown>;
  delete (old.character as Record<string, unknown>).currentMp;
  delete (old.character as Record<string, unknown>).raceId;
  delete (old.character as Record<string, unknown>).dragonBreathElement;
  delete (old.combat as Record<string, unknown>).activeCastings;
  delete (old.combat as Record<string, unknown>).racialAbilityCooldowns;
  const hydrated = hydrateStateRow({ character_id: "TEST-character", revision: String(started.state.revision),
    snapshot: { activity: old.activity, character: old.character, inventory: old.inventory,
      exploration: old.exploration, combat: { ...(old.combat as object), lastAction: null } } });
  assert.equal(hydrated.combat!.participants.find(p=>p.side === "party" && p.controlledBy !== "companion")!.mp!.currentMp, 18);
  assert.deepEqual(hydrated.combat?.activeCastings, []);
  assert.match(page(started.state), /正在詠唱：TEST 多回合法術/);
  assert.match(page(started.state), /已投入：6 \/ 18 MP/);
  assert.match(page(player()), /18 MP・3 回合詠唱/);
  const before=player();const low = createGameState({ ...before, combat:{...before.combat,participants:before.combat!.participants.map(p=>p.id === "TEST-player" ? {...p,mp:{...p.mp!,currentMp:10}} : p)} });
  assert.match(page(low), /MP 不足/);
});

test("詠唱 API 精確 body、Memory persistence、frontend runtime validation", async () => {
  const session = createDomainSession(equipped());
  const app = await buildApp({ domainSession: session, combatSandbox: true,
    combatParticipants: TEST_COMBAT_PARTICIPANTS, combatRoller: createCombatFixtureRoller("normal") });
  try {
    assert.equal((await app.inject({ method: "POST", url: "/api/dev/combat/start", payload: { expectedRevision: 1 } })).statusCode, 200);
    assert.equal((await app.inject({ method: "POST", url: "/api/dev/combat/advance", payload: { expectedRevision: 2 } })).statusCode, 200);
    const bad = await app.inject({ method: "POST", url: "/api/combat/casting/start",
      payload: { expectedRevision: 3, skillId: "TEST-skill-2", mpCost: 0 } });
    assert.deepEqual([bad.statusCode, session.getState().revision], [400, 3]);
    const started = await app.inject({ method: "POST", url: "/api/combat/casting/start",
      payload: { expectedRevision: 3, skillId: "TEST-skill-2" } });
    assert.equal(started.statusCode, 200);
    assert.equal(isCastingResponse(started.json()), true);
    const refresh = await app.inject({ method: "GET", url: "/api/game-state" });
    assert.deepEqual([refresh.json().state.combat!.participants.find((p:{side:string;controlledBy?:string})=>p.side === "party" && p.controlledBy !== "companion")!.mp!.currentMp,
      refresh.json().state.combat.activeCastings[0].completedCastingTurns], [18, 1]);
    const stale = await app.inject({ method: "POST", url: "/api/combat/casting/cancel", payload: { expectedRevision: 3 } });
    assert.equal(stale.statusCode, 409);
    assert.equal(session.getState().revision, 4);
    const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => {
      assert.deepEqual(JSON.parse(String(init?.body)), { expectedRevision: 3, skillId: "TEST-skill-2" });
      return new Response(JSON.stringify(started.json()), { status: 200 });
    };
    assert.equal((await executeCasting("start", 3, "TEST-skill-2", fetcher as typeof fetch)).state.combat!.participants.find(p=>p.side === "party" && p.controlledBy !== "companion")!.mp!.currentMp, 18);
    await assert.rejects(executeCasting("start", 3, "TEST-skill-2",
      async () => new Response(JSON.stringify({ error: "internal", message: "SQL secret" }), { status: 500 })),
    /目前無法完成詠唱操作/);
  } finally { await app.close(); }
});

test("隔離 PostgreSQL 可從新 repository 讀回 MP、詠唱與 revision", {
  skip: !process.env.TEST_DATABASE_URL && "需提供隔離的 TEST_DATABASE_URL 並先執行 migration。",
}, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 2 });
  const id = `TEST-casting-${randomUUID()}`;
  try {
    const seed = createGameState({ ...equipped(), character: { ...equipped().character, id } });
    const session = createPersistedDomainSession(new PostgresGameStateRepository(pool), seed);
    const started = await session.startCombat({ expectedRevision: 1 }, TEST_COMBAT_PARTICIPANTS,
      createCombatFixtureRoller("normal")); ok(started);
    const advanced = await session.advanceCombat({ expectedRevision: 2 }); ok(advanced);
    const cast = await session.startCasting({ expectedRevision: 3, skillId: "TEST-skill-2" }); ok(cast);
    const loaded = await new PostgresGameStateRepository(pool).load(id);
    assert.deepEqual([loaded?.revision, loaded?.combat?.participants.find(p=>p.side === "party" && p.controlledBy !== "companion")?.mp?.currentMp,
      loaded?.combat?.activeCastings[0]?.completedCastingTurns, loaded?.combat?.activeCastings[0]?.mpSpent,
      loaded?.combat?.currentActorId], [4, 18, 1, 6, "TEST-enemy-2"]);
  } finally {
    await pool.query("DELETE FROM game_states WHERE character_id = $1", [id]).catch(() => undefined);
    await pool.end();
  }
});
