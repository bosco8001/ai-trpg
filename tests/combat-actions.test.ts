import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import {
  advanceCombatTurn, rollInitiative,
  getCurrentNormalAttackOptions,
  resolveNormalAttack,
  startCombat,
  type CombatParticipantSeed,
  type DiceRoller,
} from "../src/domain/combat.js";
import { checkNormalAttackTarget, getLegalNormalAttackTargets } from "../src/domain/combat-targeting.js";
import { createCombatState } from "../src/domain/combat-state.js";
import { createGameState, type GameState } from "./helpers/phase26-fixture.js";
import { createTestCombatInventory } from "../src/domain/combat-items.js";
import type { GameStateRepository } from "../src/domain/game-state-repository.js";
import { buildApp } from "./helpers/phase26-fixture.js";
import {
  createCombatActionFixtureRoller,
  createCombatFixtureRoller,
  SequenceD20Roller,
} from "../src/server/combat/dice.js";
import { TEST_COMBAT_PARTICIPANTS } from "../src/server/combat/fixtures.js";
import { createDomainSession, createPersistedDomainSession } from "../src/server/domain-session.js";
import { InvalidPersistedStateError, PostgresGameStateRepository, hydrateStateRow } from "../src/server/postgres-game-state-repository.js";
import {
  isAuthoritativeGameStateResponse,
  isCombatNormalAttackResponse,
  type AuthoritativeGameStateResponse,
} from "../src/shared/game-state.js";
import {
  executeNormalAttack,
  loadAuthoritativeGameState,
  loadNormalAttackOptions,
} from "../src/web/api.js";
import { CombatPage } from "../src/web/CombatPage.js";
import { canPlayerUseNormalAttack, getCombatPresentationLanes, isServerListedLegalTarget } from "../src/web/combat-ui.js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

class CountingD20Roller implements DiceRoller {
  calls = 0;
  private index = 0;

  constructor(private readonly values: readonly number[]) {}

  d20(): number {
    this.calls += 1;
    const value = this.values[this.index];
    this.index += 1;
    if (value === undefined) throw new Error("TEST dice exhausted");
    return value;
  }
}

function seed(characterId = "TEST-character"): GameState {
  return createGameState({
    revision: 0,
    activity: "outside-combat",
    character: {
      id: characterId,
      learnedActiveSkillIds: ["TEST-skill-1"],
      equippedSkillIds: [],
      currentMp: 24,
    },
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
  const start = startCombat(
    seed(),
    { expectedRevision: 0 },
    TEST_COMBAT_PARTICIPANTS,
    createCombatFixtureRoller("normal"),
  );
  requireOk(start);
  const advance = advanceCombatTurn(start.state, { expectedRevision: 1 });
  requireOk(advance);
  return advance.state;
}

function combatParticipants(state: GameState) {
  assert.ok(state.combat);
  return state.combat.participants;
}

function normalAttackAction(state: GameState) {
  const action = state.combat?.lastAction;
  assert.ok(action && action.type === "normal-attack");
  return action;
}

function customTargetingCombat(seeds: readonly CombatParticipantSeed[], rolls: readonly number[]) {
  return {ok:true as const,state:{...seed(),activity:"in-combat" as const,combat:rollInitiative(seeds,new SequenceD20Roller(rolls))}};
}

test("TEST initial row 與最小普通攻擊 profile 進入 CombatState", () => {
  const state = playerTurnState();
  const participants = combatParticipants(state);
  assert.deepEqual(participants.map(({ id, side, row }) => [id, side, row]), [
    ["TEST-player", "party", "front"],
    ["TEST-enemy-1", "enemy", "front"],
    ["TEST-enemy-2", "enemy", "back"],
  ]);
  assert.deepEqual(participants[0]?.normalAttack, {
    range: "melee",
    perceptionModifier: 1,
    weaponMainStatModifier: 2,
    proficiencyModifier: 1,
  });
  assert.equal(participants[1]?.normalAttack, null);
  assert.equal(state.combat?.lastAction, null);
});

test("Physical Attack 與 Evasion 使用各自的 canonical 修正公式", () => {
  const state = playerTurnState();
  const dice = new CountingD20Roller([10, 8]);
  const result = resolveNormalAttack(state, { expectedRevision: 2, targetId: "TEST-enemy-1" }, dice);
  requireOk(result);
  assert.deepEqual(result.state.combat?.lastAction, {
    type: "normal-attack",
    round: 1,
    actorId: "TEST-player",
    targetId: "TEST-enemy-1",
    attack: {
      rawD20: 10,
      perceptionModifier: 1,
      weaponMainStatModifier: 2,
      proficiencyModifier: 1,
      total: 14,
    },
    evasion: { rawD20: 8, dexterityModifier: 1, total: 9 },
    outcome: "hit",
  });
  assert.equal(dice.calls, 2);
});

test("Attack total 大於、等於或低於 Evasion total 時分別命中、命中、未命中", () => {
  const cases = [
    { rolls: [10, 8], totals: [14, 9], outcome: "hit" },
    { rolls: [5, 8], totals: [9, 9], outcome: "hit" },
    { rolls: [3, 15], totals: [7, 16], outcome: "miss" },
  ] as const;
  for (const scenario of cases) {
    const result = resolveNormalAttack(
      playerTurnState(),
      { expectedRevision: 2, targetId: "TEST-enemy-1" },
      new SequenceD20Roller(scenario.rolls),
    );
    requireOk(result);
    const action = normalAttackAction(result.state);
    assert.deepEqual([
      action.attack.total,
      action.evasion.total,
      action.outcome,
    ], [...scenario.totals, scenario.outcome]);
  }
});

test("raw D20 1 不會自動失敗，修正後較高仍可命中", () => {
  const result = resolveNormalAttack(
    playerTurnState(),
    { expectedRevision: 2, targetId: "TEST-enemy-1" },
    createCombatActionFixtureRoller("raw-one-hit"),
  );
  requireOk(result);
  const action = normalAttackAction(result.state);
  assert.equal(action.attack.rawD20, 1);
  assert.equal(action.attack.total, 5);
  assert.equal(action.evasion.rawD20, 1);
  assert.equal(action.evasion.total, 2);
  assert.equal(action.outcome, "hit");
});

test("request 不接受 caller 的 attacker、骰值、total、結果、damage 或回合欄位", () => {
  const invalidFields = [
    { actorId: "TEST-player" },
    { attackRoll: 20 },
    { evasionRoll: 1 },
    { attackTotal: 999 },
    { evasionTotal: 1 },
    { hit: true },
    { damage: 100 },
    { critical: true },
    { round: 100 },
    { currentActorId: "TEST-player" },
  ];
  for (const extra of invalidFields) {
    const dice = new CountingD20Roller([10, 8]);
    const result = resolveNormalAttack(
      playerTurnState(),
      { expectedRevision: 2, targetId: "TEST-enemy-1", ...extra },
      dice,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "invalid-command");
    assert.equal(dice.calls, 0);
  }
});

test("melee 可攻擊敵方前排；敵方前排有人時後排受阻", () => {
  const state = playerTurnState();
  const combat = state.combat!;
  const attacker = combat.participants.find((participant) => participant.id === "TEST-player")!;
  assert.deepEqual(getLegalNormalAttackTargets(combat, attacker.id, "melee"), ["TEST-enemy-1"]);
  assert.deepEqual(checkNormalAttackTarget(combat, attacker, "TEST-enemy-1", "melee"), { legal: true });
  assert.deepEqual(checkNormalAttackTarget(combat, attacker, "TEST-enemy-2", "melee"), {
    legal: false,
    reason: "front-row-blocked",
  });
});

test("敵方前排空缺時，melee 後排目標合法", () => {
  const state = playerTurnState();
  const combat = state.combat!;
  const participants = combat.participants.filter((participant) => participant.id !== "TEST-enemy-1");
  const attacker = participants.find((participant) => participant.id === "TEST-player")!;
  const backRowAvailable = { ...combat, participants };
  assert.deepEqual(getLegalNormalAttackTargets(backRowAvailable, attacker.id, "melee"), ["TEST-enemy-2"]);
  assert.deepEqual(checkNormalAttackTarget(backRowAvailable, attacker, "TEST-enemy-2", "melee"), { legal: true });
});

test("ranged normal attack 可以指定敵方前排與後排", () => {
  const combat = playerTurnState().combat!;
  const participants = combat.participants.map((participant) => participant.id === "TEST-player"
    ? { ...participant, normalAttack: { ...participant.normalAttack!, range: "ranged" as const } }
    : participant);
  const rangedCombat = createCombatState({ ...combat, participants });
  assert.deepEqual(getLegalNormalAttackTargets(rangedCombat, "TEST-player", "ranged"), [
    "TEST-enemy-1",
    "TEST-enemy-2",
  ]);
});

test("self、ally 與不存在的 participant 都不是合法目標", () => {
  const seeds: readonly CombatParticipantSeed[] = [
    {
      id: "TEST-attacker", displayName: "TEST 攻擊者", side: "party", row: "front",
      dexterityModifier: 0,
      health: { maxHp: 10, currentHp: 10, lifeState: "active", dyingTurnsRemaining: null },
      normalAttack: { range: "melee", perceptionModifier: 1, weaponMainStatModifier: 2, proficiencyModifier: 1 },
    },
    {
      id: "TEST-ally", displayName: "TEST 隊友", side: "party", row: "back",
      health: { maxHp: 8, currentHp: 8, lifeState: "active", dyingTurnsRemaining: null },
      dexterityModifier: 0, normalAttack: null,
    },
    {
      id: "TEST-enemy", displayName: "TEST 敵人", side: "enemy", row: "front",
      health: { maxHp: 6, currentHp: 6, lifeState: "active", dyingTurnsRemaining: null },
      dexterityModifier: 0, normalAttack: null,
    },
  ];
  const started = customTargetingCombat(seeds, [20, 10, 5]);
  requireOk(started);
  const attacker = started.state.combat!.participants.find((participant) => participant.id === "TEST-attacker")!;
  assert.deepEqual(checkNormalAttackTarget(started.state.combat!, attacker, "TEST-attacker", "melee"), {
    legal: false, reason: "self",
  });
  assert.deepEqual(checkNormalAttackTarget(started.state.combat!, attacker, "TEST-ally", "melee"), {
    legal: false, reason: "ally",
  });
  assert.deepEqual(checkNormalAttackTarget(started.state.combat!, attacker, "missing", "melee"), {
    legal: false, reason: "target-not-found",
  });
});

test("敵方 current actor 不提供 player action options，也不能透過 action route 操控", async (t) => {
  const started = startCombat(seed(), { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"));
  requireOk(started);
  const options = getCurrentNormalAttackOptions(started.state);
  requireOk(options);
  assert.equal(options.options.canPlayerAct, false);
  assert.deepEqual(options.options.legalTargetIds, []);

  const dice = new CountingD20Roller([10, 8]);
  const app = await buildApp({
    domainSession: createDomainSession(started.state),
    combatActionRoller: dice,
  });
  t.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: "/api/combat/normal-attack",
    payload: { expectedRevision: 1, targetId: "TEST-player" },
  });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error, "not-player-turn");
  assert.equal(dice.calls, 0);
});

test("stale revision、illegal target、缺少 combat 與 wrong actor 都在擲骰前拒絕", () => {
  const dice = new CountingD20Roller([10, 8]);
  const stale = resolveNormalAttack(
    playerTurnState(),
    { expectedRevision: 1, targetId: "TEST-enemy-1" },
    dice,
  );
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.code, "stale-revision");
  assert.equal(dice.calls, 0);

  const blocked = resolveNormalAttack(
    playerTurnState(),
    { expectedRevision: 2, targetId: "TEST-enemy-2" },
    dice,
  );
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.code, "illegal-target");
  assert.equal(dice.calls, 0);

  const noCombat = resolveNormalAttack(seed(), { expectedRevision: 0, targetId: "TEST-enemy-1" }, dice);
  assert.equal(noCombat.ok, false);
  if (!noCombat.ok) assert.equal(noCombat.code, "not-in-combat");
  assert.equal(dice.calls, 0);
});

test("persisted session 的競爭攻擊由鎖定狀態序列化，失敗請求不擲骰", async () => {
  let state = playerTurnState();
  let lockTail: Promise<void> = Promise.resolve();
  const repository: GameStateRepository = {
    async load() { return state; },
    async createIfAbsent() { return state; },
    async saveIfRevision() { return false; },
    async withStateLocked(_seed, transition) {
      const previous = lockTail;
      let release!: () => void;
      lockTail = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      try {
        const result = transition(state);
        if (result.nextState) state = result.nextState;
        return result.result;
      } finally {
        release();
      }
    },
  };
  const sessionA = createPersistedDomainSession(repository, state);
  const sessionB = createPersistedDomainSession(repository, state);
  const diceA = new CountingD20Roller([10, 8]);
  const diceB = new CountingD20Roller([10, 8]);
  const results = await Promise.all([
    sessionA.normalAttack({ expectedRevision: 2, targetId: "TEST-enemy-1" }, diceA),
    sessionB.normalAttack({ expectedRevision: 2, targetId: "TEST-enemy-1" }, diceB),
  ]);
  assert.deepEqual(results.map((result) => result.ok).sort(), [false, true]);
  const rejected = results.find((result) => !result.ok);
  assert.ok(rejected && !rejected.ok);
  assert.equal(rejected.code, "stale-revision");
  assert.equal(diceA.calls + diceB.calls, 2);
  assert.equal(state.revision, 3);
  assert.equal(state.combat?.currentActorId, "TEST-enemy-2");
});

test("hit 與 miss 各只增加一次 revision，並自動消耗玩家 Turn", () => {
  for (const mode of ["hit", "miss"] as const) {
    const initial = playerTurnState();
    const result = resolveNormalAttack(
      initial,
      { expectedRevision: 2, targetId: "TEST-enemy-1" },
      createCombatActionFixtureRoller(mode),
    );
    requireOk(result);
    assert.equal(result.state.revision, 3);
    assert.equal(result.state.combat?.currentActorId, "TEST-enemy-2");
    assert.equal(result.state.combat?.currentTurnIndex, 2);
    assert.equal(result.effect.outcome, mode);
    assert.equal(normalAttackAction(result.state).outcome, mode);
    assert.deepEqual(result.state.combat?.participants.map((participant) => participant.row),
      initial.combat?.participants.map((participant) => participant.row));
    assert.equal("hp" in result.state.combat!.participants[1]!, false);
  }
});

test("TurnOrder 最後一名攻擊後 Round 加一並 wrap，仍只提交一次 revision", () => {
  const slowerPlayer: readonly CombatParticipantSeed[] = TEST_COMBAT_PARTICIPANTS.map((participant) => ({
    ...participant,
    dexterityModifier: 0,
  }));
  const started = startCombat(seed(), { expectedRevision: 0 }, slowerPlayer, new SequenceD20Roller([1, 20, 10]));
  requireOk(started);
  assert.deepEqual(started.state.combat?.turnOrder, ["TEST-enemy-1", "TEST-enemy-2", "TEST-player"]);
  const enemyTwo = advanceCombatTurn(started.state, { expectedRevision: 1 });
  requireOk(enemyTwo);
  const player = advanceCombatTurn(enemyTwo.state, { expectedRevision: 2 });
  requireOk(player);
  const result = resolveNormalAttack(
    player.state,
    { expectedRevision: 3, targetId: "TEST-enemy-1" },
    new SequenceD20Roller([10, 8]),
  );
  requireOk(result);
  assert.deepEqual([
    result.state.revision,
    result.state.combat?.round,
    result.state.combat?.currentTurnIndex,
    result.state.combat?.currentActorId,
    result.state.combat?.lastAction?.round,
  ], [4, 2, 0, "TEST-enemy-1", 1]);
});

test("read-only options API 僅回傳 server-derived legal targets 與 front-row-blocked reason", async (t) => {
  const state = playerTurnState();
  const session = createDomainSession(state);
  const app = await buildApp({ domainSession: session });
  t.after(() => app.close());
  const before = await session.getState();
  const response = await app.inject("/api/combat/normal-attack/options");
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.deepEqual(response.json(), {
    revision: 2,
    currentActorId: "TEST-player",
    canPlayerAct: true,
    legalTargetIds: ["TEST-enemy-1"],
    targets: [
      { targetId: "TEST-enemy-1", displayName: "TEST 敵人 1", legal: true },
      { targetId: "TEST-enemy-2", displayName: "TEST 敵人 2", legal: false, reason: "front-row-blocked" },
    ],
  });
  assert.deepEqual(await session.getState(), before);
  assert.equal("legalTargetIds" in state.combat!, false);
});

test("正式 normal-attack API 驗證精確 body，回傳權威 lastAction 與已前進的 current actor", async (t) => {
  const state = playerTurnState();
  const dice = new CountingD20Roller([10, 8]);
  const app = await buildApp({
    domainSession: createDomainSession(state),
    combatActionRoller: dice,
  });
  t.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: "/api/combat/normal-attack",
    payload: { expectedRevision: 2, targetId: "TEST-enemy-1" },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(isCombatNormalAttackResponse(response.json()), true);
  assert.equal(response.json().state.revision, 3);
  assert.equal(response.json().state.combat.currentActorId, "TEST-enemy-2");
  assert.equal(response.json().state.combat.lastAction.outcome, "hit");
  assert.equal(dice.calls, 2);
});

test("illegal、stale 與多欄位 API request 都不擲骰且不改變 state", async (t) => {
  const state = playerTurnState();
  const session = createDomainSession(state);
  const dice = new CountingD20Roller([10, 8]);
  const app = await buildApp({ domainSession: session, combatActionRoller: dice });
  t.after(() => app.close());
  const before = await session.getState();
  const requests = [
    { body: { expectedRevision: 2, targetId: "TEST-enemy-2" }, status: 409, error: "illegal-target" },
    { body: { expectedRevision: 1, targetId: "TEST-enemy-1" }, status: 409, error: "stale-revision" },
    { body: { expectedRevision: 2, targetId: "TEST-enemy-1", attackRoll: 10 }, status: 400, error: "invalid-command" },
    { body: { expectedRevision: 2, targetId: "TEST-enemy-1", evasionRoll: 8 }, status: 400, error: "invalid-command" },
    { body: { expectedRevision: 2, targetId: "TEST-enemy-1", hit: true }, status: 400, error: "invalid-command" },
  ];
  for (const request of requests) {
    const response = await app.inject({
      method: "POST",
      url: "/api/combat/normal-attack",
      payload: request.body,
    });
    assert.equal(response.statusCode, request.status);
    assert.equal(response.json().error, request.error);
    assert.ok(response.json().message.length > 0);
    assert.doesNotMatch(response.body, /stack|SELECT|postgres:\/\/|\/Users\//i);
  }
  assert.equal(dice.calls, 0);
  assert.deepEqual(await session.getState(), before);
});

test("重讀 game-state 可取回持久化裁定，shared runtime validation 驗證 row 與 lastAction", async (t) => {
  const session = createDomainSession(playerTurnState());
  const app = await buildApp({ domainSession: session, combatActionRoller: createCombatActionFixtureRoller("miss") });
  t.after(() => app.close());
  const action = await app.inject({
    method: "POST",
    url: "/api/combat/normal-attack",
    payload: { expectedRevision: 2, targetId: "TEST-enemy-1" },
  });
  assert.equal(action.statusCode, 200);
  const firstRead = await app.inject("/api/game-state");
  const secondRead = await app.inject("/api/game-state");
  const current = firstRead.json() as AuthoritativeGameStateResponse;
  assert.equal(isAuthoritativeGameStateResponse(current), true);
  assert.deepEqual(secondRead.json().state, current.state);
  assert.equal(current.state.combat?.lastAction?.type, "normal-attack");
  if (current.state.combat?.lastAction?.type === "normal-attack") {
    assert.equal(current.state.combat.lastAction.outcome, "miss");
  }
  assert.equal(current.state.combat?.participants.find((item) => item.id === "TEST-enemy-2")?.row, "back");
  assert.equal(isAuthoritativeGameStateResponse({
    ...current,
    state: {
      ...current.state,
      combat: {
        ...current.state.combat!,
        participants: current.state.combat!.participants.map((participant) => {
          if (participant.id !== "TEST-enemy-2") return participant;
          const { row: _row, ...withoutRow } = participant;
          return withoutRow;
        }),
      },
    },
  }), false);
});

test("UI 使用 authoritative side + row 排列，且只接受目前 revision 的 server legal target", () => {
  const state = playerTurnState();
  const combat = state.combat!;
  assert.deepEqual(getCombatPresentationLanes(combat.participants).map((lane) => [
    lane.id,
    lane.participants.map((participant) => participant.id),
  ]), [
    ["enemy-back", ["TEST-enemy-2"]],
    ["enemy-front", ["TEST-enemy-1"]],
    ["party-front", ["TEST-player"]],
    ["party-back", []],
  ]);
  assert.equal(canPlayerUseNormalAttack(combat, false), true);
  assert.equal(canPlayerUseNormalAttack(combat, true), false);
  const enemyTurn = startCombat(
    seed(), { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"),
  );
  requireOk(enemyTurn);
  assert.equal(canPlayerUseNormalAttack(enemyTurn.state.combat!, false), false);
  const options = {
    revision: 2,
    currentActorId: "TEST-player",
    canPlayerAct: true,
    legalTargetIds: ["TEST-enemy-1"],
    targets: [
      { targetId: "TEST-enemy-1", displayName: "TEST 敵人 1", legal: true },
      { targetId: "TEST-enemy-2", displayName: "TEST 敵人 2", legal: false, reason: "front-row-blocked" as const },
    ],
  };
  assert.equal(isServerListedLegalTarget(options, "TEST-enemy-1", 2), true);
  assert.equal(isServerListedLegalTarget(options, "TEST-enemy-2", 2), false);
  assert.equal(isServerListedLegalTarget(options, "TEST-enemy-1", 3), false);
});

test("普通攻擊結果 UI 只顯示檢定事實與命中結果，不顯示傷害或敘述", () => {
  const state = playerTurnState();
  const result = resolveNormalAttack(
    state,
    { expectedRevision: 2, targetId: "TEST-enemy-1" },
    createCombatActionFixtureRoller("hit"),
  );
  requireOk(result);
  const view: AuthoritativeGameStateResponse = { sandbox: false, storage: "memory", state: result.state };
  const page = renderToStaticMarkup(createElement(CombatPage, {
    gameState: view,
    stateError: null,
    onStateUpdate: () => undefined,
    onRetryState: async () => view,
  }));
  assert.match(page, /最近裁定/);
  assert.match(page, /TEST 玩家 → TEST 敵人 1/);
  assert.match(page, /10 \+ 1 \+ 2 \+ 1 = 14/);
  assert.match(page, /8 \+ 1 = 9/);
  assert.match(page, /結果：命中/);
  assert.match(page, /目前行動：<strong>TEST 敵人 2<\/strong>/);
  const visibleText = page.replace(/<[^>]+>/g, " ");
  assert.match(visibleText, /HP 10 \/ 10/);
  assert.doesNotMatch(visibleText, /damage|造成傷害|揮劍|躲開|暴擊|critical/i);
});

test("target mode 的取消與進入流程不會直接呼叫 attack endpoint；卡片平時維持 article", async () => {
  const page = renderToStaticMarkup(createElement(CombatPage, {
    gameState: { sandbox: true, storage: "memory", state: playerTurnState() },
    stateError: null,
    onStateUpdate: () => undefined,
    onRetryState: async () => ({ sandbox: true, storage: "memory" as const, state: playerTurnState() }),
  }));
  assert.match(page, /<article class="combat-participant/);
  assert.doesNotMatch(page, /data-target=/);
  const source = await readFile(new URL("../src/web/CombatPage.tsx", import.meta.url), "utf8");
  const cancel = source.split("function cancelTargeting() {")[1]?.split("function beginTargetSelection() {")[0] ?? "";
  const begin = source.split("function beginTargetSelection() {")[1]?.split("function selectTarget(")[0] ?? "";
  assert.doesNotMatch(cancel, /executeNormalAttack|fetch\(/);
  assert.match(begin, /loadNormalAttackOptions/);
  assert.doesNotMatch(begin, /executeNormalAttack|fetch\(/);
  assert.match(source, /請選擇攻擊目標/);
  assert.match(source, /前排敵人阻擋/);
  assert.match(source, />取消</);
});

test("前端 normal attack API 嚴格送出 targetId / revision 並安全拒絕 malformed 回應", async () => {
  await executeNormalAttack(2, "TEST-enemy-1", async (url, init) => {
    assert.equal(url, "/api/combat/normal-attack");
    assert.equal(init?.method, "POST");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.body, JSON.stringify({ expectedRevision: 2, targetId: "TEST-enemy-1" }));
    const result = resolveNormalAttack(playerTurnState(), { expectedRevision: 2, targetId: "TEST-enemy-1" },
      createCombatActionFixtureRoller("hit"));
    requireOk(result);
    return Response.json({
      sandbox: false,
      storage: "memory",
      effect: { type: "normal-attack-resolved", outcome: result.effect.outcome },
      state: result.state,
    });
  });
  assert.equal(isCombatNormalAttackResponse({
    sandbox: false,
    storage: "memory",
    effect: { type: "normal-attack-resolved", outcome: "miss" },
    state: playerTurnState(),
  }), false);
  await assert.rejects(executeNormalAttack(2, "TEST-enemy-1", async () => Response.json({})), /格式不正確/);
  await assert.rejects(loadNormalAttackOptions(async () => Response.json({})), /格式不正確/);
  await assert.rejects(loadAuthoritativeGameState(async () => Response.json({})), /格式不正確/);
});

test("legacy known Phase 11 TEST snapshot 可補 row；未知缺 row participant 安全拒絕", () => {
  const state = playerTurnState();
  const combat = state.combat!;
  const legacyCombat = {
    round: combat.round,
    currentTurnIndex: combat.currentTurnIndex,
    currentActorId: combat.currentActorId,
    turnOrder: combat.turnOrder,
    participants: combat.participants.map(({ row: _row, normalAttack: _normalAttack, health: _health, ...participant }) => participant),
  };
  const hydrated = hydrateStateRow({
    character_id: state.character.id,
    revision: String(state.revision),
    snapshot: {
      activity: state.activity,
      character: state.character,
      exploration: state.exploration,
      combat: legacyCombat,
    },
  });
  assert.deepEqual(hydrated.combat?.participants.map(({ id, row }) => [id, row]), [
    ["TEST-player", "front"],
    ["TEST-enemy-1", "front"],
    ["TEST-enemy-2", "back"],
  ]);
  assert.deepEqual(hydrated.combat?.participants[0]?.normalAttack, TEST_COMBAT_PARTICIPANTS[0]?.normalAttack);

  const unknownLegacyCombat = {
    ...legacyCombat,
    turnOrder: ["TEST-enemy-1", "TEST-player", "TEST-unknown"],
    participants: legacyCombat.participants.map((participant, index) => index === 2
      ? { ...participant, id: "TEST-unknown", displayName: "TEST 未知參與者" }
      : participant),
  };
  assert.throws(() => hydrateStateRow({
    character_id: state.character.id,
    revision: String(state.revision),
    snapshot: {
      activity: state.activity,
      character: state.character,
      exploration: state.exploration,
      combat: unknownLegacyCombat,
    },
  }), InvalidPersistedStateError);
});

test("前端不直接修改 participant row，並消費 server 提供的 attack／move options", async () => {
  const ui = await readFile(new URL("../src/web/combat-ui.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../src/web/CombatPage.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(ui + page, /moveParticipant|setParticipantRow|participant\.row\s*=(?!=)/i);
  assert.doesNotMatch(ui + page, /getLegalNormalAttackTargets|checkNormalAttackTarget/);
  assert.match(ui, /participant\.side \+ "-" \+ participant\.row/);
  assert.match(ui, /options\.legalTargetRows\.includes\(targetRow\)/);
  assert.match(page, /executeRowMove/);
});

test("PostgreSQL round-trip 保存攻擊權威狀態，並讓競爭的過期攻擊在擲骰前拒絕", {
  skip: !process.env.TEST_DATABASE_URL && "需明確提供隔離的 TEST_DATABASE_URL，並先執行既有 migration。",
}, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 3 });
  const characterId = "TEST-combat-" + randomUUID();
  const raceCharacterId = "TEST-combat-race-" + randomUUID();
  const repository = new PostgresGameStateRepository(pool);
  try {
    const initial = createGameState({ ...seed(characterId), revision: 0 });
    const session = createPersistedDomainSession(repository, initial);
    const started = await session.startCombat(
      { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"),
    );
    requireOk(started);
    const playerTurn = await session.advanceCombat({ expectedRevision: 1 });
    requireOk(playerTurn);
    const attack = await session.normalAttack(
      { expectedRevision: 2, targetId: "TEST-enemy-1" },
      createCombatActionFixtureRoller("hit"),
    );
    requireOk(attack);
    const saved = await repository.load(characterId);
    assert.ok(saved);
    const savedAttack = normalAttackAction(saved);
    assert.deepEqual([
      saved.revision,
      saved.combat?.round,
      saved.combat?.currentActorId,
      saved.combat?.participants.find((participant) => participant.id === "TEST-enemy-2")?.row,
      savedAttack.attack.rawD20,
      savedAttack.evasion.rawD20,
      savedAttack.outcome,
    ], [3, 1, "TEST-enemy-2", "back", 10, 8, "hit"]);
    const restartedPool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 1 });
    try {
      const restarted = await new PostgresGameStateRepository(restartedPool).load(characterId);
      assert.deepEqual(restarted, saved);
    } finally {
      await restartedPool.end();
    }

    const raceInitial = createGameState({ ...seed(raceCharacterId), revision: 0 });
    const raceA = createPersistedDomainSession(new PostgresGameStateRepository(pool), raceInitial);
    const raceB = createPersistedDomainSession(new PostgresGameStateRepository(pool), raceInitial);
    const raceStart = await raceA.startCombat(
      { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"),
    );
    requireOk(raceStart);
    const racePlayerTurn = await raceA.advanceCombat({ expectedRevision: 1 });
    requireOk(racePlayerTurn);
    const raceDiceA = new CountingD20Roller([10, 8]);
    const raceDiceB = new CountingD20Roller([10, 8]);
    const raceResults = await Promise.all([
      raceA.normalAttack({ expectedRevision: 2, targetId: "TEST-enemy-1" }, raceDiceA),
      raceB.normalAttack({ expectedRevision: 2, targetId: "TEST-enemy-1" }, raceDiceB),
    ]);
    assert.deepEqual(raceResults.map((result) => result.ok).sort(), [false, true]);
    const rejectedRace = raceResults.find((result) => !result.ok);
    assert.ok(rejectedRace && !rejectedRace.ok);
    assert.equal(rejectedRace.code, "stale-revision");
    assert.equal(raceDiceA.calls + raceDiceB.calls, 2);
    const raceSaved = await repository.load(raceCharacterId);
    assert.equal(raceSaved?.revision, 3);
    assert.equal(raceSaved?.combat?.currentActorId, "TEST-enemy-2");
  } finally {
    await pool.query("DELETE FROM game_states WHERE character_id = $1", [raceCharacterId]);
    await pool.query("DELETE FROM game_states WHERE character_id = $1", [characterId]);
    await pool.end();
  }
});
