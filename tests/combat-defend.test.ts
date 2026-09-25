import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  advanceCombatTurn, defendCombatTurn, moveCombatRow, resolveNormalAttack, startCombat, useCombatItem,
  type CombatParticipantSeed,
} from "../src/domain/combat.js";
import { createCombatState } from "../src/domain/combat-state.js";
import { createGameState, type GameState } from "../src/domain/game.js";
import { TEST_COMBAT_CONSUMABLE_ID } from "../src/domain/combat-items.js";
import { buildApp } from "../src/server/app.js";
import { createCombatActionFixtureRoller, createCombatFixtureRoller, SequenceD20Roller } from "../src/server/combat/dice.js";
import { TEST_COMBAT_PARTICIPANTS } from "../src/server/combat/fixtures.js";
import { createDomainSession, createPersistedDomainSession } from "../src/server/domain-session.js";
import { createTestGameState } from "../src/server/test-game-state.js";
import { hydrateStateRow, PostgresGameStateRepository } from "../src/server/postgres-game-state-repository.js";
import { isAuthoritativeGameStateResponse, isCombatDefendResponse, isCombatStateView } from "../src/shared/game-state.js";
import { executeDefend } from "../src/web/api.js";
import { CombatPage } from "../src/web/CombatPage.js";
import { canPlayerDefend } from "../src/web/combat-ui.js";

function requireOk<T extends { readonly ok: boolean }>(result: T): asserts result is Extract<T, { readonly ok: true }> {
  assert.equal(result.ok, true);
}

function startedState(initial: GameState = createTestGameState()): GameState {
  const result = startCombat(initial, { expectedRevision: initial.revision }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"));
  requireOk(result);
  return result.state;
}

function playerState(): GameState {
  const result = advanceCombatTurn(startedState(), { expectedRevision: 1 });
  requireOk(result);
  return result.state;
}

function page(state: GameState): string {
  return renderToStaticMarkup(createElement(CombatPage, {
    gameState: { sandbox: true, storage: "memory", state },
    stateError: null,
    onStateUpdate: () => undefined,
    onRetryState: async () => ({ sandbox: true, storage: "memory" as const, state }),
  }));
}

test("玩家防禦只記錄 action、消耗 Turn、增加一次 revision，且完全不擲骰", () => {
  const before = playerState();
  const after = defendCombatTurn(before, { expectedRevision: 2 });
  requireOk(after);
  assert.deepEqual(after.state.combat?.lastAction, { type: "defend", actorId: "TEST-player", round: 1 });
  assert.deepEqual([after.state.revision, after.state.combat?.round, after.state.combat?.currentActorId], [3, 1, "TEST-enemy-2"]);
  assert.equal(after.effect.type, "defend-completed");
  assert.deepEqual(before, playerState());
  assert.deepEqual(after.state.inventory, before.inventory);
  assert.deepEqual(after.state.combat?.participants, before.combat?.participants);
  assert.deepEqual(Object.keys(after.state.combat!.lastAction!).sort(), ["actorId", "round", "type"]);
  const next = defendCombatTurn(after.state, { expectedRevision: 3 });
  assert.equal(next.ok, false);
  if (!next.ok) assert.equal(next.code, "not-player-turn");
  assert.equal(resolveNormalAttack(after.state, { expectedRevision: 3, targetId: "TEST-enemy-1" }, createCombatActionFixtureRoller("hit")).ok, false);
  assert.equal(moveCombatRow(after.state, { expectedRevision: 3, targetRow: "back" }).ok, false);
  assert.equal(useCombatItem(after.state, { expectedRevision: 3, itemId: TEST_COMBAT_CONSUMABLE_ID }).ok, false);
});

test("最後一名 participant 防禦沿用原本 Round wrap", () => {
  const participants: readonly CombatParticipantSeed[] = [
    { id: "TEST-player", displayName: "TEST 玩家", side: "party", row: "front", dexterityModifier: 0,
      normalAttack: { range: "melee", perceptionModifier: 1, weaponMainStatModifier: 2, proficiencyModifier: 1 } },
    { id: "TEST-enemy", displayName: "TEST 敵人", side: "enemy", row: "front", dexterityModifier: 0, normalAttack: null },
  ];
  const started = startCombat(createTestGameState(), { expectedRevision: 0 }, participants, new SequenceD20Roller([10, 20]));
  requireOk(started);
  const player = advanceCombatTurn(started.state, { expectedRevision: 1 });
  requireOk(player);
  const defended = defendCombatTurn(player.state, { expectedRevision: 2 });
  requireOk(defended);
  assert.deepEqual([defended.state.revision, defended.state.combat?.round, defended.state.combat?.currentActorId], [3, 2, "TEST-enemy"]);
  assert.equal(defended.state.combat?.lastAction?.round, 1);
});

test("敵方、無戰鬥、stale、格式錯誤與注入欄位均拒絕且不改 state", () => {
  const player = playerState();
  const enemy = startedState();
  const cases: readonly [GameState, unknown, string][] = [
    [enemy, { expectedRevision: 1 }, "not-player-turn"],
    [createTestGameState(), { expectedRevision: 0 }, "not-in-combat"],
    [player, { expectedRevision: 1 }, "stale-revision"],
    [player, {}, "invalid-command"],
    [player, { expectedRevision: "2" }, "invalid-command"],
    [player, { expectedRevision: 2, actorId: "TEST-player" }, "invalid-command"],
    [player, { expectedRevision: 2, targetId: "TEST-enemy-1" }, "invalid-command"],
    [player, { expectedRevision: 2, defensePercent: 30 }, "invalid-command"],
    [player, { expectedRevision: 2, duration: 1 }, "invalid-command"],
  ];
  for (const [state, input, code] of cases) {
    const before = structuredClone(state);
    const result = defendCombatTurn(state, input);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, code);
    assert.deepEqual(state, before);
  }
});

test("runtime contract 接受四種 lastAction，拒絕偷偷加入防禦效果欄位", () => {
  const base = playerState();
  const attack = resolveNormalAttack(base, { expectedRevision: 2, targetId: "TEST-enemy-1" }, createCombatActionFixtureRoller("hit"));
  const move = moveCombatRow(base, { expectedRevision: 2, targetRow: "back" });
  const item = useCombatItem(base, { expectedRevision: 2, itemId: TEST_COMBAT_CONSUMABLE_ID });
  const defend = defendCombatTurn(base, { expectedRevision: 2 });
  for (const result of [attack, move, item, defend]) {
    requireOk(result);
    assert.equal(isCombatStateView(result.state.combat), true);
    assert.equal(isAuthoritativeGameStateResponse({ sandbox: true, storage: "memory", state: result.state }), true);
    assert.match(page(result.state), /最近行動|最近裁定/);
  }
  requireOk(defend);
  assert.match(page(defend.state), /選擇：防禦/);
  assert.doesNotMatch(page(defend.state), /防禦中|減傷 30%|剩餘 1 回合/);
  for (const extra of [{ isDefending: true }, { damageReduction: 0.3 }, { expiresRound: 2 }]) {
    assert.throws(() => createCombatState({ ...defend.state.combat!, ...extra }));
    assert.equal(isCombatStateView({ ...defend.state.combat!, ...extra }), false);
    assert.throws(() => createCombatState({ ...defend.state.combat!, lastAction: { ...defend.state.combat!.lastAction!, ...extra } }));
  }
  const snapshot = {
    character_id: defend.state.character.id,
    revision: String(defend.state.revision),
    snapshot: {
      activity: defend.state.activity, character: defend.state.character,
      inventory: defend.state.inventory, exploration: defend.state.exploration, combat: defend.state.combat,
    },
  };
  assert.deepEqual(hydrateStateRow(snapshot), defend.state);
});

test("Defend route 只接收 expectedRevision，回應保存權威 state", async (t) => {
  const session = createDomainSession(createTestGameState());
  const app = await buildApp({ domainSession: session, combatSandbox: true, combatParticipants: TEST_COMBAT_PARTICIPANTS, combatRoller: createCombatFixtureRoller("normal") });
  t.after(() => app.close());
  assert.equal((await app.inject({ method: "POST", url: "/api/dev/combat/start", payload: { expectedRevision: 0 } })).statusCode, 200);
  const enemy = await app.inject({ method: "POST", url: "/api/combat/defend", payload: { expectedRevision: 1 } });
  assert.equal(enemy.statusCode, 409);
  assert.equal(enemy.json().error, "not-player-turn");
  assert.equal(session.getState().revision, 1);
  await app.inject({ method: "POST", url: "/api/dev/combat/advance", payload: { expectedRevision: 1 } });
  for (const payload of [{}, { expectedRevision: 2, actorId: "TEST-player" }, { expectedRevision: 2, targetId: "TEST-enemy-1" },
    { expectedRevision: 2, defensePercent: 30 }, { expectedRevision: 2, duration: 1 }]) {
    const response = await app.inject({ method: "POST", url: "/api/combat/defend", payload });
    assert.equal(response.statusCode, 400);
    assert.equal(session.getState().revision, 2);
    assert.equal(session.getState().combat?.lastAction, null);
  }
  const malformed = await app.inject({ method: "POST", url: "/api/combat/defend", payload: '{"expectedRevision":', headers: { "content-type": "application/json" } });
  assert.equal(malformed.statusCode, 400);
  assert.equal(session.getState().revision, 2);
  const stale = await app.inject({ method: "POST", url: "/api/combat/defend", payload: { expectedRevision: 1 } });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.json().error, "stale-revision");
  const response = await app.inject({ method: "POST", url: "/api/combat/defend", payload: { expectedRevision: 2 } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(isCombatDefendResponse(response.json()), true);
  assert.equal(response.json().state.combat.currentActorId, "TEST-enemy-2");
  assert.deepEqual(session.getState(), response.json().state);
});

test("前端只送 revision，安全拒絕服務離線與無效回應", async () => {
  const result = defendCombatTurn(playerState(), { expectedRevision: 2 });
  requireOk(result);
  const response = { sandbox: true, storage: "memory", effect: result.effect, state: result.state };
  const received = await executeDefend(2, async (url, init) => {
    assert.equal(url, "/api/combat/defend");
    assert.equal(init?.body, '{"expectedRevision":2}');
    return Response.json(response);
  });
  assert.equal(received.state.combat?.currentActorId, "TEST-enemy-2");
  await assert.rejects(executeDefend(2, async () => { throw new Error("secret SQL"); }), /防禦暫時無法使用/);
  await assert.rejects(executeDefend(2, async () => Response.json({})), /防禦回應格式不正確/);
});

test("敵方回合停用防禦、玩家回合啟用，recent action 不顯示假數值或持續 badge", () => {
  assert.equal(canPlayerDefend(startedState().combat!, false), false);
  assert.equal(canPlayerDefend(playerState().combat!, false), true);
  assert.equal(canPlayerDefend(playerState().combat!, true), false);
  assert.match(page(startedState()), /data-command="defend"[^>]*disabled=""/);
  assert.doesNotMatch(page(playerState()), /data-command="defend"[^>]*disabled=""/);
  const result = defendCombatTurn(playerState(), { expectedRevision: 2 });
  requireOk(result);
  assert.match(page(result.state), /防禦行動已完成。實際減傷效果尚未接入。/);
  assert.doesNotMatch(page(result.state), /防禦中|30%|防禦力提升|剩餘 1 回合/);
});

test("隔離 PostgreSQL 下同 revision 只成功一次，重開 repository 後可讀回", {
  skip: !process.env.TEST_DATABASE_URL && "需提供隔離的 TEST_DATABASE_URL，並先執行 migration。",
}, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 4 });
  const id = `TEST-combat-defend-${randomUUID()}`;
  try {
    const initial = createGameState({ ...createTestGameState(), character: { ...createTestGameState().character, id } });
    const first = createPersistedDomainSession(new PostgresGameStateRepository(pool), initial);
    const second = createPersistedDomainSession(new PostgresGameStateRepository(pool), initial);
    requireOk(await first.startCombat({ expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal")));
    requireOk(await first.advanceCombat({ expectedRevision: 1 }));
    const outcomes = await Promise.all([first.defend({ expectedRevision: 2 }), second.defend({ expectedRevision: 2 })]);
    assert.deepEqual(outcomes.map((outcome) => outcome.ok).sort(), [false, true]);
    for (const outcome of outcomes) if (!outcome.ok) assert.equal(outcome.code, "stale-revision");
    const loaded = await new PostgresGameStateRepository(pool).load(id);
    assert.deepEqual([loaded?.revision, loaded?.combat?.round, loaded?.combat?.currentActorId, loaded?.combat?.lastAction],
      [3, 1, "TEST-enemy-2", { type: "defend", actorId: "TEST-player", round: 1 }]);
  } finally {
    await pool.query("DELETE FROM game_states WHERE character_id = $1", [id]).catch(() => undefined);
    await pool.end();
  }
});
