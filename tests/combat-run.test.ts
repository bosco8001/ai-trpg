import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  advanceCombatTurn, defendCombatTurn, moveCombatRow, resolveEscapeCheck, resolveNormalAttack,
  runFromCombat, startCombat, useCombatItem, type CombatParticipantSeed,
} from "../src/domain/combat.js";
import { createCombatState } from "../src/domain/combat-state.js";
import { createGameState, type GameState } from "../src/domain/game.js";
import { TEST_COMBAT_CONSUMABLE_ID } from "../src/domain/combat-items.js";
import { buildApp } from "../src/server/app.js";
import {
  createCombatEscapeFixtureRoller, createCombatFixtureRoller, SequenceD20Roller,
} from "../src/server/combat/dice.js";
import { TEST_COMBAT_PARTICIPANTS } from "../src/server/combat/fixtures.js";
import { createDomainSession, createPersistedDomainSession } from "../src/server/domain-session.js";
import { createTestGameState } from "../src/server/test-game-state.js";
import { hydrateStateRow, PostgresGameStateRepository } from "../src/server/postgres-game-state-repository.js";
import { createSaveSnapshot } from "../src/server/save-game/service.js";
import { SaveGameFailure } from "../src/server/save-game/contracts.js";
import { isAuthoritativeGameStateResponse, isCombatRunResponse, isCombatStateView } from "../src/shared/game-state.js";
import { executeRun } from "../src/web/api.js";
import { CombatPage } from "../src/web/CombatPage.js";
import { applicationMode, canPlayerUseNormalAttack } from "../src/web/combat-ui.js";

function ok<T extends { readonly ok: boolean }>(result: T): asserts result is Extract<T, { readonly ok: true }> {
  assert.equal(result.ok, true);
}

function startedState(participants: readonly CombatParticipantSeed[] = TEST_COMBAT_PARTICIPANTS): GameState {
  const result = startCombat(createTestGameState(), { expectedRevision: 0 }, participants, createCombatFixtureRoller("normal"));
  ok(result);
  return result.state;
}

function playerState(): GameState {
  const result = advanceCombatTurn(startedState(), { expectedRevision: 1 });
  ok(result);
  return result.state;
}

function page(state: GameState) {
  return renderToStaticMarkup(createElement(CombatPage, {
    gameState: { sandbox: true, storage: "memory", state },
    stateError: null,
    onStateUpdate: () => undefined,
    onRetryState: async () => ({ sandbox: true, storage: "memory" as const, state }),
  }));
}

test("逃跑公式含 DEX、種族修正與含等號的 DC 8 邊界", () => {
  assert.deepEqual(resolveEscapeCheck(8, 2, 0), {
    rawD20: 8, dexterityModifier: 2, racialModifier: 0, total: 10, dc: 8, outcome: "success",
  });
  assert.deepEqual(resolveEscapeCheck(3, 2, 0), {
    rawD20: 3, dexterityModifier: 2, racialModifier: 0, total: 5, dc: 8, outcome: "failure",
  });
  assert.equal(resolveEscapeCheck(6, 2, 0).outcome, "success");
  assert.equal(resolveEscapeCheck(5, 2, 0).outcome, "failure");
  assert.deepEqual([resolveEscapeCheck(7, 2, 0).total, resolveEscapeCheck(7, 2, 0).outcome], [9, "success"]);
  assert.deepEqual([resolveEscapeCheck(7, 2, -2).total, resolveEscapeCheck(7, 2, -2).outcome], [7, "failure"]);
  assert.throws(() => resolveEscapeCheck(21, 2, 0));
  assert.throws(() => resolveEscapeCheck(7, 2, 10 as 0));
});

test("龍裔 domain fixture 保留同一 D20／DEX，真正套用 -2；TEST 玩家維持 0", () => {
  const normal = playerState();
  assert.equal(normal.combat?.participants.find((p) => p.id === "TEST-player")?.racialEscapeModifier, 0);
  const dragonborn = TEST_COMBAT_PARTICIPANTS.map((participant) => participant.id === "TEST-player"
    ? { ...participant, racialEscapeModifier: -2 as const }
    : participant);
  const started = startedState(dragonborn);
  const advanced = advanceCombatTurn(started, { expectedRevision: 1 });
  ok(advanced);
  const normalRun = runFromCombat(normal, { expectedRevision: 2 }, new SequenceD20Roller([7]));
  const dragonbornRun = runFromCombat(advanced.state, { expectedRevision: 2 }, new SequenceD20Roller([7]));
  ok(normalRun); ok(dragonbornRun);
  assert.deepEqual([normalRun.state.combat?.lastAction?.type, normalRun.state.combat?.status], ["run", "ended"]);
  assert.deepEqual([dragonbornRun.state.combat?.status, dragonbornRun.state.combat?.lastAction], ["active", {
    type: "run", actorId: "TEST-player", round: 1, rawD20: 7,
    dexterityModifier: 2, racialModifier: -2, total: 7, dc: 8, outcome: "failure",
  }]);
});

test("失敗消耗 Turn；成功只增加一次 revision 並移除可行動 actor", () => {
  const before = playerState();
  const failed = runFromCombat(before, { expectedRevision: 2 }, createCombatEscapeFixtureRoller("failure"));
  const succeeded = runFromCombat(before, { expectedRevision: 2 }, createCombatEscapeFixtureRoller("success"));
  ok(failed); ok(succeeded);
  assert.deepEqual([failed.state.revision, failed.state.combat?.status, failed.state.combat?.currentActorId,
    failed.state.combat?.round, failed.state.combat?.lastAction], [3, "active", "TEST-enemy-2", 1, {
    type: "run", actorId: "TEST-player", round: 1, rawD20: 3,
    dexterityModifier: 2, racialModifier: 0, total: 5, dc: 8, outcome: "failure",
  }]);
  assert.deepEqual([succeeded.state.revision, succeeded.state.combat?.status,
    succeeded.state.combat?.endReason, succeeded.state.combat?.currentActorId,
    succeeded.state.combat?.currentTurnIndex, succeeded.state.combat?.round], [3, "ended", "escaped", null, null, 1]);
  assert.deepEqual(succeeded.state.combat?.lastAction, {
    type: "run", actorId: "TEST-player", round: 1, rawD20: 8,
    dexterityModifier: 2, racialModifier: 0, total: 10, dc: 8, outcome: "success",
  });
  assert.equal(succeeded.state.activity, "in-combat");
  assert.deepEqual(succeeded.state.exploration, before.exploration);
  assert.deepEqual(succeeded.state.inventory, before.inventory);
  assert.deepEqual(succeeded.state.character, before.character);
  assert.equal(applicationMode({ sandbox: true, storage: "memory", state: succeeded.state }), "combat");
});

test("逃跑失敗沿用 Round wrap", () => {
  const participants: readonly CombatParticipantSeed[] = [
    { id: "TEST-player", displayName: "TEST 玩家", side: "party", row: "front", dexterityModifier: 2,
      normalAttack: { range: "melee", perceptionModifier: 1, weaponMainStatModifier: 2, proficiencyModifier: 1 } },
    { id: "TEST-enemy", displayName: "TEST 敵人", side: "enemy", row: "front", dexterityModifier: 0, normalAttack: null,
      health: { maxHp: 6, currentHp: 6, lifeState: "active", dyingTurnsRemaining: null } },
  ];
  const started = startCombat(createTestGameState(), { expectedRevision: 0 }, participants, new SequenceD20Roller([5, 20]));
  ok(started);
  const player = advanceCombatTurn(started.state, { expectedRevision: 1 });
  ok(player);
  const failed = runFromCombat(player.state, { expectedRevision: 2 }, createCombatEscapeFixtureRoller("failure"));
  ok(failed);
  assert.deepEqual([failed.state.combat?.round, failed.state.combat?.currentActorId, failed.state.combat?.lastAction?.round], [2, "TEST-enemy", 1]);
});

test("請求拒絕額外欄位、敵方回合、無戰鬥、舊版本；拒絕前不擲骰", () => {
  const player = playerState();
  const enemy = startedState();
  const inputs: readonly [GameState, unknown, string][] = [
    [enemy, { expectedRevision: 1 }, "not-player-turn"],
    [createTestGameState(), { expectedRevision: 0 }, "not-in-combat"],
    [player, { expectedRevision: 1 }, "stale-revision"],
    ...["actorId", "roll", "rawD20", "total", "dc", "success", "racialModifier", "dexterityModifier", "targetId"].map(
      (key): [GameState, unknown, string] => [player, { expectedRevision: 2, [key]: 1 }, "invalid-command"]),
  ];
  for (const [state, input, code] of inputs) {
    const before = structuredClone(state);
    const result = runFromCombat(state, input, { d20: () => { throw new Error("不應擲骰"); } });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, code);
    assert.deepEqual(state, before);
  }
});

test("戰鬥 ended 後所有 action 與 TEST advance 都拒絕，不會再次擲骰", () => {
  const succeeded = runFromCombat(playerState(), { expectedRevision: 2 }, createCombatEscapeFixtureRoller("success"));
  ok(succeeded);
  const state = succeeded.state;
  const before = structuredClone(state);
  const rejected = [
    advanceCombatTurn(state, { expectedRevision: 3 }),
    defendCombatTurn(state, { expectedRevision: 3 }),
    moveCombatRow(state, { expectedRevision: 3, targetRow: "back" }),
    useCombatItem(state, { expectedRevision: 3, itemId: TEST_COMBAT_CONSUMABLE_ID }),
    resolveNormalAttack(state, { expectedRevision: 3, targetId: "TEST-enemy-1" }, { d20: () => { throw new Error("不應擲骰"); } }),
    runFromCombat(state, { expectedRevision: 3 }, { d20: () => { throw new Error("不應擲骰"); } }),
  ];
  for (const result of rejected) {
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "combat-ended");
  }
  assert.deepEqual(state, before);
});

test("舊 CombatState hydrate active；新 terminal 狀態及裁定必須一致", () => {
  const state = playerState();
  const { status: _status, endReason: _reason, activeCastings: _castings, racialAbilityCooldowns: _racial, ...oldCombat } = state.combat!;
  const old = createCombatState(oldCombat);
  assert.deepEqual([old.status, old.endReason, old.currentActorId], ["active", null, "TEST-player"]);
  const success = runFromCombat(state, { expectedRevision: 2 }, createCombatEscapeFixtureRoller("success"));
  ok(success);
  assert.equal(isCombatStateView(success.state.combat), true);
  assert.equal(isAuthoritativeGameStateResponse({ sandbox: true, storage: "memory", state: success.state }), true);
  for (const malformed of [
    { ...success.state.combat!, currentActorId: "TEST-enemy-2" },
    { ...success.state.combat!, status: "active" },
    { ...success.state.combat!, endReason: null },
    { ...success.state.combat!, lastAction: { ...success.state.combat!.lastAction!, outcome: "failure" } },
  ]) {
    assert.throws(() => createCombatState(malformed));
    assert.equal(isCombatStateView(malformed), false);
  }
  const hydrated = hydrateStateRow({
    character_id: success.state.character.id,
    revision: "3",
    snapshot: {
      activity: success.state.activity, character: success.state.character,
      inventory: success.state.inventory, exploration: success.state.exploration, combat: success.state.combat,
    },
  });
  assert.deepEqual(hydrated, success.state);
});

test("Phase 13–16 的四種 lastAction 舊快照都 hydrate active；未結算戰鬥仍不能 Save", () => {
  const player = playerState();
  const variants = [
    resolveNormalAttack(player, { expectedRevision: 2, targetId: "TEST-enemy-1" }, new SequenceD20Roller([10, 8])),
    moveCombatRow(player, { expectedRevision: 2, targetRow: "back" }),
    useCombatItem(player, { expectedRevision: 2, itemId: TEST_COMBAT_CONSUMABLE_ID }),
    defendCombatTurn(player, { expectedRevision: 2 }),
    runFromCombat(player, { expectedRevision: 2 }, createCombatEscapeFixtureRoller("failure")),
  ];
  for (const result of variants) {
    ok(result);
    const { status: _status, endReason: _reason, activeCastings: _castings, racialAbilityCooldowns: _racial, ...previousShape } = result.state.combat!;
    assert.equal(createCombatState(previousShape).status, "active");
    assert.equal(isCombatStateView(result.state.combat), true);
  }
  const success = runFromCombat(player, { expectedRevision: 2 }, createCombatEscapeFixtureRoller("success"));
  ok(success);
  assert.throws(() => createSaveSnapshot(success.state), (error: unknown) => {
    assert.ok(error instanceof SaveGameFailure);
    assert.equal(error.code, "combat-not-supported");
    return true;
  });
});

test("Run route 精確 request、stale、成功 terminal 及結束後 action guard", async (t) => {
  const session = createDomainSession(createTestGameState());
  const app = await buildApp({ domainSession: session, combatSandbox: true,
    combatParticipants: TEST_COMBAT_PARTICIPANTS, combatRoller: createCombatFixtureRoller("normal"), combatEscapeRoller: createCombatEscapeFixtureRoller("success") });
  t.after(() => app.close());
  assert.equal((await app.inject({ method: "POST", url: "/api/dev/combat/start", payload: { expectedRevision: 0 } })).statusCode, 200);
  assert.equal((await app.inject({ method: "POST", url: "/api/combat/run", payload: { expectedRevision: 1 } })).json().error, "not-player-turn");
  await app.inject({ method: "POST", url: "/api/dev/combat/advance", payload: { expectedRevision: 1 } });
  for (const payload of [{ expectedRevision: 2, dc: 1, success: true }, { expectedRevision: 2, targetId: "TEST-enemy-1" },
    { expectedRevision: 2, actorId: "TEST-player" }, { expectedRevision: 2, racialModifier: 0 }]) {
    assert.equal((await app.inject({ method: "POST", url: "/api/combat/run", payload })).statusCode, 400);
  }
  const stale = await app.inject({ method: "POST", url: "/api/combat/run", payload: { expectedRevision: 1 } });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.json().error, "stale-revision");
  assert.equal(session.getState().revision, 2);
  const response = await app.inject({ method: "POST", url: "/api/combat/run", payload: { expectedRevision: 2 } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(isCombatRunResponse(response.json()), true);
  assert.deepEqual([response.json().state.revision, response.json().state.combat.status,
    response.json().state.combat.currentActorId], [3, "ended", null]);
  const refreshed = await app.inject("/api/game-state");
  assert.equal(isAuthoritativeGameStateResponse(refreshed.json()), true);
  assert.deepEqual(refreshed.json().state, response.json().state);
  for (const [url, payload] of [
    ["/api/combat/normal-attack", { expectedRevision: 3, targetId: "TEST-enemy-1" }],
    ["/api/combat/row-move", { expectedRevision: 3, targetRow: "back" }],
    ["/api/combat/items/use", { expectedRevision: 3, itemId: TEST_COMBAT_CONSUMABLE_ID }],
    ["/api/combat/defend", { expectedRevision: 3 }],
    ["/api/combat/run", { expectedRevision: 3 }],
    ["/api/dev/combat/advance", { expectedRevision: 3 }],
  ] as const) {
    const rejected = await app.inject({ method: "POST", url, payload });
    assert.equal(rejected.statusCode, 409);
    assert.equal(rejected.json().error ?? rejected.json().code, "combat-ended");
  }
  assert.equal(session.getState().revision, 3);
});

test("前端 request 只有 revision；畫面呈現成功或失敗的機械結果與終止狀態", async () => {
  const player = playerState();
  const failed = runFromCombat(player, { expectedRevision: 2 }, createCombatEscapeFixtureRoller("failure"));
  const succeeded = runFromCombat(player, { expectedRevision: 2 }, createCombatEscapeFixtureRoller("success"));
  ok(failed); ok(succeeded);
  const response = { sandbox: true, storage: "memory", effect: succeeded.effect, state: succeeded.state } as const;
  const received = await executeRun(2, async (url, init) => {
    assert.equal(url, "/api/combat/run");
    assert.equal(init?.body, '{"expectedRevision":2}');
    return Response.json(response);
  });
  assert.equal(received.state.combat?.status, "ended");
  await assert.rejects(executeRun(2, async () => { throw new Error("secret SQL"); }), /逃跑暫時無法使用/);
  await assert.rejects(executeRun(2, async () => Response.json({})), /格式不正確/);
  assert.match(page(player), /data-command="flee"/);
  assert.doesNotMatch(page(player), /data-command="flee"[^>]*disabled=""/);
  assert.match(page(startedState()), /data-command="flee"[^>]*disabled=""/);
  assert.match(page(failed.state), /逃跑判定：3 \+ 2 = 5/);
  assert.match(page(failed.state), /目標：8/);
  assert.match(page(failed.state), /結果：逃跑失敗/);
  assert.match(page(failed.state), /TEST 敵人 2/);
  assert.match(page(succeeded.state), /戰鬥已結束/);
  assert.match(page(succeeded.state), /逃跑判定：8 \+ 2 = 10/);
  assert.match(page(succeeded.state), /結果：逃跑成功/);
  assert.match(page(succeeded.state), /戰鬥結算與返回探索尚未接入/);
  assert.doesNotMatch(page(succeeded.state), /目前行動：TEST 敵人 2|成功率|進入探索/);
  assert.match(page(succeeded.state), /目前沒有戰鬥敘事/);
  assert.match(page(succeeded.state), /data-command="party"/);
  assert.doesNotMatch(page(succeeded.state), /data-command="party"[^>]*disabled=""/);
  assert.equal((page(succeeded.state).match(/disabled=""/g) ?? []).length, 7);
  assert.equal(canPlayerUseNormalAttack(succeeded.state.combat!, false), false);
  const source = await readFile(new URL("../src/web/CombatPage.tsx", import.meta.url), "utf8");
  assert.match(source, /確定要嘗試逃跑嗎？/);
  assert.match(source, /restoreRunFocus\.current = true/);
  assert.match(source, /取消逃跑；戰鬥狀態沒有改變/);
});

test("PostgreSQL 重新載入仍保留 ended／escaped／run resolution", {
  skip: !process.env.TEST_DATABASE_URL && "需提供隔離的 TEST_DATABASE_URL，並先執行 migration。",
}, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 4 });
  const id = `TEST-combat-run-${randomUUID()}`;
  try {
    const seed = createGameState({ ...createTestGameState(), character: { ...createTestGameState().character, id } });
    const first = createPersistedDomainSession(new PostgresGameStateRepository(pool), seed);
    ok(await first.startCombat({ expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal")));
    ok(await first.advanceCombat({ expectedRevision: 1 }));
    const result = await first.run({ expectedRevision: 2 }, createCombatEscapeFixtureRoller("success"));
    ok(result);
    const loaded = await new PostgresGameStateRepository(pool).load(id);
    assert.deepEqual(loaded, result.state);
    assert.equal(loaded?.combat?.status, "ended");
    assert.equal(loaded?.combat?.endReason, "escaped");
    assert.equal(loaded?.combat?.lastAction?.type, "run");
  } finally {
    await pool.query("DELETE FROM game_states WHERE character_id = $1", [id]).catch(() => undefined);
    await pool.end();
  }
});
