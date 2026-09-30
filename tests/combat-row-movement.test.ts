import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  advanceCombatTurn,
  getCurrentNormalAttackOptions,
  getCurrentRowMoveOptions,
  moveCombatRow,
  resolveNormalAttack,
  startCombat,
  type CombatParticipantSeed,
} from "../src/domain/combat.js";
import { createGameState, type GameState } from "./helpers/phase26-fixture.js";
import { createTestCombatInventory } from "../src/domain/combat-items.js";
import { buildApp } from "./helpers/phase26-fixture.js";
import { createCombatActionFixtureRoller, createCombatFixtureRoller, SequenceD20Roller } from "../src/server/combat/dice.js";
import { TEST_COMBAT_PARTICIPANTS } from "../src/server/combat/fixtures.js";
import { createDomainSession, createPersistedDomainSession } from "../src/server/domain-session.js";
import {
  PersistenceUnavailableError,
  PostgresGameStateRepository,
} from "../src/server/postgres-game-state-repository.js";
import {
  isAuthoritativeGameStateResponse,
  isCombatRowMoveResponse,
  isCombatStateView,
  isRowMoveOptionsResponse,
  type AuthoritativeGameStateResponse,
} from "../src/shared/game-state.js";
import { executeRowMove, loadRowMoveOptions } from "../src/web/api.js";
import { CombatPage } from "../src/web/CombatPage.js";
import {
  canPlayerUseRowMove,
  getCombatPresentationLanes,
  isServerListedLegalTargetRow,
} from "../src/web/combat-ui.js";

function seed(characterId = "TEST-character"): GameState {
  return createGameState({
    revision: 0,
    activity: "outside-combat",
    character: { id: characterId, learnedActiveSkillIds: ["TEST-skill-1"], equippedSkillIds: [], currentMp: 24 },
    inventory: createTestCombatInventory(),
    exploration: { locationId: "TEST-forest-edge", lastObservationTargetId: null },
    combat: null,
  });
}

function requireOk<T extends { readonly ok: boolean }>(
  result: T,
): asserts result is Extract<T, { readonly ok: true }> {
  assert.equal(result.ok, true);
}

function playerTurnState(): GameState {
  const started = startCombat(seed(), { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"));
  requireOk(started);
  const advanced = advanceCombatTurn(started.state, { expectedRevision: 1 });
  requireOk(advanced);
  return advanced.state;
}

function backRowPlayerTurnState(): GameState {
  const started = startCombat(seed(), { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"));
  requireOk(started);
  const player = advanceCombatTurn(started.state, { expectedRevision: 1 });
  requireOk(player);
  const moved = moveCombatRow(player.state, { expectedRevision: 2, targetRow: "back" });
  requireOk(moved);
  const roundTwoEnemy = advanceCombatTurn(moved.state, { expectedRevision: 3 });
  requireOk(roundTwoEnemy);
  const roundTwoPlayer = advanceCombatTurn(roundTwoEnemy.state, { expectedRevision: 4 });
  requireOk(roundTwoPlayer);
  return roundTwoPlayer.state;
}

function assertRejectedWithoutMutation(state: GameState, input: unknown, code: string) {
  const before = structuredClone(state);
  const result = moveCombatRow(state, input);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, code);
  assert.deepEqual(state, before);
}

test("front → back 是確定換排，不擲骰、revision 只加一次並結束玩家 Turn", () => {
  const state = playerTurnState();
  assert.equal(state.revision, 2);
  assert.equal(state.combat?.currentActorId, "TEST-player");
  const beforeRows = state.combat!.participants.map(({ id, row }) => [id, row]);

  const moved = moveCombatRow(state, { expectedRevision: 2, targetRow: "back" });
  requireOk(moved);
  assert.equal(moved.state.revision, 3);
  assert.equal(moved.state.combat?.round, 1);
  assert.equal(moved.state.combat?.currentActorId, "TEST-enemy-2");
  assert.equal(moved.state.combat?.participants.find(({ id }) => id === "TEST-player")?.row, "back");
  assert.deepEqual(state.combat?.participants.map(({ id, row }) => [id, row]), beforeRows);
  assert.deepEqual(moved.state.combat?.lastAction, {
    type: "row-move", actorId: "TEST-player", round: 1, fromRow: "front", toRow: "back",
  });
});

test("Move transition 不呼叫 initiative 或 action dice roller", () => {
  const sequence = [12, 17, 8];
  let calls = 0;
  const roller = { d20: () => sequence[calls++]! };
  const started = startCombat(seed(), { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, roller);
  requireOk(started);
  const player = advanceCombatTurn(started.state, { expectedRevision: 1 });
  requireOk(player);
  const callsBeforeMove = calls;
  const moved = moveCombatRow(player.state, { expectedRevision: 2, targetRow: "back" });
  requireOk(moved);
  assert.equal(calls, callsBeforeMove);
});

test("back → front 在下一個玩家 Turn 合法並只推進一名 participant", () => {
  const state = backRowPlayerTurnState();
  assert.deepEqual([state.revision, state.combat?.round, state.combat?.currentActorId], [5, 2, "TEST-player"]);
  const options = getCurrentRowMoveOptions(state);
  requireOk(options);
  assert.deepEqual(options.options.legalTargetRows, ["front"]);
  const moved = moveCombatRow(state, { expectedRevision: 5, targetRow: "front" });
  requireOk(moved);
  assert.deepEqual([
    moved.state.revision,
    moved.state.combat?.round,
    moved.state.combat?.currentActorId,
    moved.state.combat?.participants.find(({ id }) => id === "TEST-player")?.row,
  ], [6, 2, "TEST-enemy-2", "front"]);
  assert.deepEqual(moved.state.combat?.lastAction, {
    type: "row-move", actorId: "TEST-player", round: 2, fromRow: "back", toRow: "front",
  });
});

test("最後一名 participant 換排會沿用回合推進並正常 wrap 到下一 Round", () => {
  const participants: readonly CombatParticipantSeed[] = [
    {
      id: "TEST-player", displayName: "TEST 玩家", side: "party", row: "front", dexterityModifier: 0,
      normalAttack: { range: "melee", perceptionModifier: 1, weaponMainStatModifier: 2, proficiencyModifier: 1 },
    },
    { id: "TEST-enemy", displayName: "TEST 敵人", side: "enemy", row: "front", dexterityModifier: 0, normalAttack: null,
      health: { maxHp: 6, currentHp: 6, lifeState: "active", dyingTurnsRemaining: null } },
  ];
  const started = startCombat(seed(), { expectedRevision: 0 }, participants, new SequenceD20Roller([10, 20]));
  requireOk(started);
  assert.equal(started.state.combat?.currentActorId, "TEST-enemy");
  const player = advanceCombatTurn(started.state, { expectedRevision: 1 });
  requireOk(player);
  assert.equal(player.state.combat?.currentActorId, "TEST-player");
  const moved = moveCombatRow(player.state, { expectedRevision: 2, targetRow: "back" });
  requireOk(moved);
  assert.deepEqual([moved.state.combat?.round, moved.state.combat?.currentTurnIndex, moved.state.combat?.currentActorId], [2, 0, "TEST-enemy"]);
});

test("same-row、invalid row、額外 caller 欄位、stale、enemy Turn 與 no combat 都 safe reject", () => {
  const player = playerTurnState();
  const enemy = startCombat(seed(), { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"));
  requireOk(enemy);
  const outside = seed();

  assertRejectedWithoutMutation(player, { expectedRevision: 2, targetRow: "front" }, "illegal-row-move");
  assertRejectedWithoutMutation(player, { expectedRevision: 2, targetRow: "middle" }, "invalid-command");
  assertRejectedWithoutMutation(player, { expectedRevision: 2, targetRow: "back", actorId: "TEST-player" }, "invalid-command");
  assertRejectedWithoutMutation(player, { expectedRevision: 1, targetRow: "back" }, "stale-revision");
  assertRejectedWithoutMutation(enemy.state, { expectedRevision: 1, targetRow: "back" }, "not-player-turn");
  assertRejectedWithoutMutation(outside, { expectedRevision: 0, targetRow: "back" }, "not-in-combat");
});

test("換排選項只由目前權威狀態推導；敵方回合沒有玩家可選 row", () => {
  const player = getCurrentRowMoveOptions(playerTurnState());
  requireOk(player);
  assert.deepEqual(player, {
    ok: true,
    revision: 2,
    options: { currentActorId: "TEST-player", currentRow: "front", canPlayerAct: true, legalTargetRows: ["back"] },
  });
  const enemy = startCombat(seed(), { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"));
  requireOk(enemy);
  const enemyOptions = getCurrentRowMoveOptions(enemy.state);
  requireOk(enemyOptions);
  assert.deepEqual(enemyOptions.options, {
    currentActorId: "TEST-enemy-1", currentRow: "front", canPlayerAct: false, legalTargetRows: [],
  });
  assert.equal(getCurrentRowMoveOptions(seed()).ok, false);
});

test("row-move lastAction 可 runtime validate、Memory round-trip，normal-attack 舊格式仍有效", () => {
  const session = createDomainSession(playerTurnState());
  const moved = session.moveRow({ expectedRevision: 2, targetRow: "back" });
  requireOk(moved);
  assert.deepEqual(session.getState(), moved.state);
  assert.equal(isCombatStateView(moved.state.combat), true);
  assert.equal(isAuthoritativeGameStateResponse({ sandbox: false, storage: "memory", state: moved.state }), true);
  assert.equal(isAuthoritativeGameStateResponse({
    sandbox: false,
    storage: "memory",
    state: {
      ...moved.state,
      combat: { ...moved.state.combat!, lastAction: { ...moved.state.combat!.lastAction!, toRow: "front" } },
    },
  }), false);

  const attack = resolveNormalAttack(playerTurnState(), { expectedRevision: 2, targetId: "TEST-enemy-1" }, createCombatActionFixtureRoller("hit"));
  requireOk(attack);
  assert.equal(attack.state.combat?.lastAction?.type, "normal-attack");
  assert.equal(isCombatStateView(attack.state.combat), true);
});

test("Move API options 與 mutation 驗證 exact body，回傳一份 authoritative state", async (t) => {
  const session = createDomainSession(playerTurnState());
  const app = await buildApp({ domainSession: session });
  t.after(() => app.close());

  const options = await app.inject("/api/combat/row-move/options");
  assert.equal(options.statusCode, 200);
  assert.equal(options.headers["cache-control"], "no-store");
  assert.equal(isRowMoveOptionsResponse(options.json()), true);
  assert.deepEqual(options.json(), {
    revision: 2,
    currentActorId: "TEST-player",
    currentRow: "front",
    canPlayerAct: true,
    legalTargetRows: ["back"],
  });

  const malformed = await app.inject({
    method: "POST", url: "/api/combat/row-move",
    payload: { expectedRevision: 2, targetRow: "back", actorId: "TEST-player" },
  });
  assert.equal(malformed.statusCode, 400);
  assert.equal(malformed.json().error, "invalid-command");
  const sameRow = await app.inject({
    method: "POST", url: "/api/combat/row-move",
    payload: { expectedRevision: 2, targetRow: "front" },
  });
  assert.equal(sameRow.statusCode, 409);
  assert.equal(sameRow.json().error, "illegal-row-move");
  const moved = await app.inject({ method: "POST", url: "/api/combat/row-move", payload: { expectedRevision: 2, targetRow: "back" } });
  assert.equal(moved.statusCode, 200);
  assert.equal(isCombatRowMoveResponse(moved.json()), true);
  assert.equal(moved.json().state.revision, 3);
  assert.equal(moved.json().state.combat.currentActorId, "TEST-enemy-2");
  const enemyMove = await app.inject({
    method: "POST", url: "/api/combat/row-move",
    payload: { expectedRevision: 3, targetRow: "front" },
  });
  assert.equal(enemyMove.statusCode, 409);
  assert.equal(enemyMove.json().error, "not-player-turn");
  assert.deepEqual(await session.getState(), moved.json().state);
  const stale = await app.inject({
    method: "POST", url: "/api/combat/row-move",
    payload: { expectedRevision: 2, targetRow: "front" },
  });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.json().error, "stale-revision");
  assert.deepEqual(await session.getState(), moved.json().state);
});

test("UI 只在選項 revision、actor、row 均一致時啟用 Move，並只讀 server legalTargetRows", () => {
  const front = playerTurnState();
  const frontOptions = {
    revision: 2, currentActorId: "TEST-player", currentRow: "front" as const,
    canPlayerAct: true, legalTargetRows: ["back" as const],
  };
  assert.equal(canPlayerUseRowMove(front.combat!, frontOptions, 2, false), true);
  assert.equal(canPlayerUseRowMove(front.combat!, frontOptions, 2, true), false);
  assert.equal(canPlayerUseRowMove(front.combat!, frontOptions, 3, false), false);
  assert.equal(isServerListedLegalTargetRow(frontOptions, "back", 2, "TEST-player", "front"), true);
  assert.equal(isServerListedLegalTargetRow(frontOptions, "front", 2, "TEST-player", "front"), false);

  const enemy = startCombat(seed(), { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"));
  requireOk(enemy);
  assert.equal(canPlayerUseRowMove(enemy.state.combat!, frontOptions, 2, false), false);
});

test("玩家站在 back row 時保留 Phase 13 melee legal-target semantics", () => {
  const state = backRowPlayerTurnState();
  const moveOptions = getCurrentRowMoveOptions(state);
  requireOk(moveOptions);
  assert.deepEqual(moveOptions.options.legalTargetRows, ["front"]);
  const targets = getCurrentNormalAttackOptions(state);
  requireOk(targets);
  assert.deepEqual(targets.options.legalTargetIds, ["TEST-enemy-1"]);
  assert.deepEqual(targets.options.targets, [
    { targetId: "TEST-enemy-1", displayName: "TEST 敵人 1", legal: true },
    { targetId: "TEST-enemy-2", displayName: "TEST 敵人 2", legal: false, reason: "front-row-blocked" },
  ]);
});

test("成功 response 後卡片依 authoritative row 移至 party back lane，最近行動只顯示換排事實", () => {
  const moved = moveCombatRow(playerTurnState(), { expectedRevision: 2, targetRow: "back" });
  requireOk(moved);
  const combat = moved.state.combat!;
  const lanes = getCombatPresentationLanes(combat.participants);
  assert.deepEqual(lanes.map(({ id, participants }) => [id, participants.map(({ id: actorId }) => actorId)]), [
    ["enemy-back", ["TEST-enemy-2"]],
    ["enemy-front", ["TEST-enemy-1"]],
    ["party-front", []],
    ["party-back", ["TEST-player"]],
  ]);
  const view: AuthoritativeGameStateResponse = { sandbox: false, storage: "memory", state: moved.state };
  const page = renderToStaticMarkup(createElement(CombatPage, {
    gameState: view, stateError: null, onStateUpdate: () => undefined, onRetryState: async () => view,
  }));
  assert.match(page, /最近行動/);
  assert.match(page, /我方前排 → 我方後排/);
  assert.match(page, /結果：換排完成/);
  assert.doesNotMatch(page, /d20|擲骰|揮動|後撤|他低聲說/);
});

test("前端 Move API 只送 expectedRevision / targetRow，並 runtime validate 回應", async () => {
  const moved = moveCombatRow(playerTurnState(), { expectedRevision: 2, targetRow: "back" });
  requireOk(moved);
  const validResponse = {
    sandbox: false,
    storage: "memory",
    effect: { type: "row-move-completed" },
    state: moved.state,
  };
  const options = await loadRowMoveOptions(async (url, init) => {
    assert.equal(url, "/api/combat/row-move/options");
    assert.equal(init?.cache, "no-store");
    return Response.json({
      revision: 2, currentActorId: "TEST-player", currentRow: "front", canPlayerAct: true,
      legalTargetRows: ["back"],
    });
  });
  assert.deepEqual(options.legalTargetRows, ["back"]);
  await executeRowMove(2, "back", async (url, init) => {
    assert.equal(url, "/api/combat/row-move");
    assert.equal(init?.method, "POST");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.body, JSON.stringify({ expectedRevision: 2, targetRow: "back" }));
    return Response.json(validResponse);
  });
  assert.equal(isCombatRowMoveResponse({ ...validResponse, state: playerTurnState() }), false);
});

test("row-move persistence unavailable 使用安全繁體中文回應，不洩漏資料庫細節", async (t) => {
  const secret = "postgres://user:secret SELECT stack /internal/path";
  const app = await buildApp({
    domainRepository: {
      async load() { throw new PersistenceUnavailableError(new Error(secret)); },
      async createIfAbsent() { throw new PersistenceUnavailableError(new Error(secret)); },
      async saveIfRevision() { throw new PersistenceUnavailableError(new Error(secret)); },
    },
  });
  t.after(() => app.close());
  const responses = [
    await app.inject("/api/combat/row-move/options"),
    await app.inject({
      method: "POST", url: "/api/combat/row-move", payload: { expectedRevision: 2, targetRow: "back" },
    }),
  ];
  for (const response of responses) {
    assert.equal(response.statusCode, 503);
    assert.match(response.json().message, /戰鬥狀態暫時無法使用/);
    assert.doesNotMatch(response.body, /secret|SELECT|stack|internal\/path/i);
  }
});

test("Move selection 與取消不提交 mutation，action flight 有 loading 與 duplicate guard", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("../src/web/CombatPage.tsx", import.meta.url), "utf8"));
  const begin = source.split("function beginRowMoveSelection() {")[1]?.split("function cancelRowMove()")[0] ?? "";
  const cancel = source.split("function cancelRowMove() {")[1]?.split("function confirmRowMove(")[0] ?? "";
  const submit = source.split("function confirmRowMove(targetRow: CombatRow) {")[1]?.split("function advanceTestTurn()")[0] ?? "";
  assert.match(begin, /setIsRowMoveMode\(true\)/);
  assert.doesNotMatch(begin, /executeRowMove|fetch\(/);
  assert.doesNotMatch(cancel, /executeRowMove|fetch\(/);
  assert.match(cancel, /setIsRowMoveMode\(false\)/);
  assert.match(submit, /isServerListedLegalTargetRow/);
  assert.match(submit, /executeRowMove/);
  assert.match(submit, /setIsMovingRow\(true\)/);
  assert.match(source, /loading=\{isMovingRow\}/);
  assert.match(source, /disabled=\{!canPlayerMoveRow \|\| requestInFlight \|\| selectionModeActive\}/);
  assert.match(source, /rowMoveHeading\.current\?\.focus\(\)/);
  assert.match(source, /ref=\{rowMoveHeading\} tabIndex=\{-1\}/);
  assert.match(source, /restoreRowMoveFocus\.current = true/);
});

test("PostgreSQL JSONB 保存 row、row-move lastAction、Round、actor 與 revision，並排除 stale 競爭", {
  skip: !process.env.TEST_DATABASE_URL && "需明確提供隔離的 TEST_DATABASE_URL，並先執行既有 migration。",
}, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 4 });
  const characterId = "TEST-row-move-" + randomUUID();
  const repository = new PostgresGameStateRepository(pool);
  try {
    const initial = seed(characterId);
    const first = createPersistedDomainSession(repository, initial);
    const second = createPersistedDomainSession(new PostgresGameStateRepository(pool), initial);
    const started = await first.startCombat(
      { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"),
    );
    requireOk(started);
    const player = await first.advanceCombat({ expectedRevision: 1 });
    requireOk(player);
    const racing = await Promise.all([
      first.moveRow({ expectedRevision: 2, targetRow: "back" }),
      second.moveRow({ expectedRevision: 2, targetRow: "back" }),
    ]);
    assert.deepEqual(racing.map(({ ok }) => ok).sort(), [false, true]);
    const saved = await repository.load(characterId);
    assert.ok(saved?.combat);
    assert.deepEqual([
      saved.revision,
      saved.combat.round,
      saved.combat.currentActorId,
      saved.combat.participants.find(({ id }) => id === "TEST-player")?.row,
      saved.combat.lastAction?.type,
      saved.combat.lastAction?.type === "row-move" ? saved.combat.lastAction.fromRow : null,
      saved.combat.lastAction?.type === "row-move" ? saved.combat.lastAction.toRow : null,
    ], [3, 1, "TEST-enemy-2", "back", "row-move", "front", "back"]);

    const restartedPool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 1 });
    try {
      const afterRestart = await new PostgresGameStateRepository(restartedPool).load(characterId);
      assert.deepEqual(afterRestart, saved);
    } finally {
      await restartedPool.end();
    }
  } finally {
    await pool.query("DELETE FROM game_states WHERE character_id = $1", [characterId]);
    await pool.end();
  }
});
