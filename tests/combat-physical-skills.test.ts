import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  advanceCombatTurn, defendCombatTurn, getCurrentPhysicalSkillOptions, resolveNormalAttack,
  runFromCombat, startCombat, usePhysicalSkill, type DiceRoller,
} from "../src/domain/combat.js";
import { createCombatState } from "../src/domain/combat-state.js";
import { getActiveSkillDefinition } from "../src/domain/physical-skills.js";
import { applyCommand, createGameState, type GameState } from "../src/domain/game.js";
import { TEST_COMBAT_PARTICIPANTS } from "../src/server/combat/fixtures.js";
import { createCombatActionFixtureRoller, createCombatFixtureRoller, SequenceD20Roller } from "../src/server/combat/dice.js";
import { buildApp } from "../src/server/app.js";
import { createDomainSession, createPersistedDomainSession } from "../src/server/domain-session.js";
import { createTestGameState } from "../src/server/test-game-state.js";
import { hydrateStateRow, PostgresGameStateRepository } from "../src/server/postgres-game-state-repository.js";
import { isAuthoritativeGameStateResponse, isPhysicalSkillOptionsResponse, isPhysicalSkillUseResponse } from "../src/shared/game-state.js";
import { executePhysicalSkill, loadPhysicalSkillOptions } from "../src/web/api.js";
import { CombatPage } from "../src/web/CombatPage.js";

function ok<T extends { readonly ok: boolean }>(result: T): asserts result is Extract<T, { readonly ok: true }> {
  assert.equal(result.ok, true);
}

class CountingRoller implements DiceRoller {
  calls = 0;
  private index = 0;
  constructor(private readonly values: readonly number[]) {}
  d20() { this.calls += 1; return this.values[this.index++] ?? 0; }
}

function equippedState(): GameState {
  const equipped = applyCommand(createTestGameState(), {
    type: "set-equipped-skills", expectedRevision: 0, skillIds: ["TEST-skill-1"],
  });
  ok(equipped);
  return equipped.state;
}

function playerTurn(state = equippedState()): GameState {
  const started = startCombat(state, { expectedRevision: state.revision }, TEST_COMBAT_PARTICIPANTS,
    createCombatFixtureRoller("normal"));
  ok(started);
  const advanced = advanceCombatTurn(started.state, { expectedRevision: started.state.revision });
  ok(advanced);
  return advanced.state;
}

function use(state: GameState, roller: DiceRoller = new SequenceD20Roller([10, 8])) {
  return usePhysicalSkill(state, {
    expectedRevision: state.revision, skillId: "TEST-skill-1", targetId: "TEST-enemy-1",
  }, roller);
}

test("TEST 工程定義、Phase 3 六格與戰鬥中不可更換技能", () => {
  assert.deepEqual(getActiveSkillDefinition("TEST-skill-1"), {
    skillId: "TEST-skill-1", displayName: "TEST 物理技能", category: "physical-active",
    targetType: "single-enemy", range: "melee",
  });
  assert.equal(getActiveSkillDefinition("TEST-skill-2")?.category, "magic-active");
  assert.equal(getActiveSkillDefinition("TEST-does-not-exist"), undefined);
  const tooMany = applyCommand(createTestGameState(), {
    type: "set-equipped-skills", expectedRevision: 0,
    skillIds: Array.from({ length: 7 }, (_, index) => `TEST-skill-${index + 1}`),
  });
  assert.deepEqual([tooMany.ok, tooMany.ok ? null : tooMany.code], [false, "too-many-skills"]);
  const inCombat = playerTurn();
  const change = applyCommand(inCombat, {
    type: "set-equipped-skills", expectedRevision: inCombat.revision, skillIds: [],
  });
  assert.deepEqual([change.ok, change.ok ? null : change.code], [false, "in-combat"]);
});

test("server options 只顯示已裝備物理技能與 Phase 13 近戰合法目標", () => {
  const state = playerTurn();
  const options = getCurrentPhysicalSkillOptions(state);
  ok(options);
  assert.deepEqual(options.options.skills.map((skill) => skill.skillId), ["TEST-skill-1"]);
  assert.equal(options.options.skills[0]?.usable, true);
  assert.deepEqual(options.options.skills[0]?.targets.map((target) => [target.targetId, target.legal, target.reason]), [
    ["TEST-enemy-1", true, undefined], ["TEST-enemy-2", false, "front-row-blocked"],
  ]);
  const readAgain = getCurrentPhysicalSkillOptions(state);
  assert.deepEqual(readAgain, options);
  assert.deepEqual(state.combat?.skillCooldowns, []);
  const enemy = startCombat(equippedState(), { expectedRevision: 1 }, TEST_COMBAT_PARTICIPANTS,
    createCombatFixtureRoller("normal"));
  ok(enemy);
  const enemyOptions = getCurrentPhysicalSkillOptions(enemy.state);
  ok(enemyOptions);
  assert.equal(enemyOptions.options.skills[0]?.unavailableReason, "not-player-turn");
  assert.deepEqual(enemyOptions.options.skills[0]?.targets, []);
  const unequipped = playerTurn(createTestGameState());
  const empty = getCurrentPhysicalSkillOptions(unequipped);
  ok(empty);
  assert.deepEqual(empty.options.skills, []);
});

test("敵方前排空缺時可指定後排；玩家在後排仍可近戰", () => {
  const state = playerTurn();
  assert.ok(state.combat);
  const backPlayer = createGameState({ ...state, combat: {
    ...state.combat,
    participants: state.combat.participants.map((participant) => participant.id === "TEST-player"
      ? { ...participant, row: "back" } : participant),
  } });
  const frontOptions = getCurrentPhysicalSkillOptions(backPlayer); ok(frontOptions);
  assert.equal(frontOptions.options.skills[0]?.targets.find((target) => target.targetId === "TEST-enemy-1")?.legal, true);
  const noFront = createGameState({ ...backPlayer, combat: {
    ...backPlayer.combat!,
    participants: backPlayer.combat!.participants.map((participant) => participant.id === "TEST-enemy-1"
      ? { ...participant, row: "back" } : participant),
  } });
  const options = getCurrentPhysicalSkillOptions(noFront); ok(options);
  assert.deepEqual(options.options.skills[0]?.targets.map((target) => target.legal), [true, true]);
  const used = usePhysicalSkill(noFront, { expectedRevision: 3, skillId: "TEST-skill-1", targetId: "TEST-enemy-2" },
    new SequenceD20Roller([10, 8]));
  ok(used);
});

test("冷卻依 actorId 與 skillId 配對；其他角色的 Turn 不改 cooldown", () => {
  const state = playerTurn();
  assert.ok(state.combat);
  const otherActorCooldown = createGameState({ ...state, combat: {
    ...state.combat,
    skillCooldowns: [{ actorId: "TEST-enemy-1", skillId: "TEST-skill-1", readyRound: 3 }],
  } });
  const ownOptions = getCurrentPhysicalSkillOptions(otherActorCooldown); ok(ownOptions);
  assert.equal(ownOptions.options.skills[0]?.usable, true);
  const used = use(otherActorCooldown); ok(used);
  assert.deepEqual(used.state.combat?.skillCooldowns, [
    { actorId: "TEST-enemy-1", skillId: "TEST-skill-1", readyRound: 3 },
    { actorId: "TEST-player", skillId: "TEST-skill-1", readyRound: 3 },
  ]);
  const advanced = advanceCombatTurn(used.state, { expectedRevision: 4 }); ok(advanced);
  assert.deepEqual(advanced.state.combat?.skillCooldowns, used.state.combat?.skillCooldowns);
});

test("物理技能重用 Phase 13 同一命中裁定；hit、miss、相等與 raw 1", () => {
  const state = playerTurn();
  for (const [dice, outcome] of [
    [[10, 8], "hit"], [[3, 15], "miss"], [[5, 8], "hit"], [[1, 1], "hit"],
  ] as const) {
    const skill = use(state, new SequenceD20Roller(dice));
    const normal = resolveNormalAttack(state, {
      expectedRevision: state.revision, targetId: "TEST-enemy-1",
    }, new SequenceD20Roller(dice));
    ok(skill); ok(normal);
    assert.equal(skill.effect.outcome, outcome);
    assert.deepEqual(skill.state.combat?.lastAction?.type === "physical-skill"
      ? [skill.state.combat.lastAction.attack, skill.state.combat.lastAction.evasion, skill.state.combat.lastAction.outcome]
      : null,
    normal.state.combat?.lastAction?.type === "normal-attack"
      ? [normal.state.combat.lastAction.attack, normal.state.combat.lastAction.evasion, normal.state.combat.lastAction.outcome]
      : null);
    assert.deepEqual([skill.state.revision, skill.state.combat?.currentActorId], [state.revision + 1, "TEST-enemy-2"]);
    assert.deepEqual(skill.state.combat?.skillCooldowns, [{ actorId: "TEST-player", skillId: "TEST-skill-1", readyRound: 3 }]);
    assert.equal(Object.hasOwn(skill.state.combat?.lastAction ?? {}, "damage"), false);
  }
});

for (const mode of ["hit", "miss", "raw-one-hit"] as const) {
  test(`同一 ${mode} fixture：R1 技能、R2 冷卻、R3 同一技能再次裁定`, () => {
    const roller = createCombatActionFixtureRoller(mode);
    const first = use(playerTurn(), roller); ok(first);
    assert.deepEqual([first.state.combat?.lastAction?.type, first.effect.outcome,
      first.state.combat?.skillCooldowns[0]?.readyRound], ["physical-skill", mode === "miss" ? "miss" : "hit", 3]);
    const r2enemy = advanceCombatTurn(first.state, { expectedRevision: 4 }); ok(r2enemy);
    const r2player = advanceCombatTurn(r2enemy.state, { expectedRevision: 5 }); ok(r2player);
    assert.equal(r2player.state.combat?.round, 2);
    const options2 = getCurrentPhysicalSkillOptions(r2player.state); ok(options2);
    assert.deepEqual([options2.options.skills[0]?.usable, options2.options.skills[0]?.unavailableReason,
      options2.options.skills[0]?.readyRound], [false, "skill-on-cooldown", 3]);
    const rejected = use(r2player.state, roller);
    assert.deepEqual([rejected.ok, rejected.ok ? null : rejected.code], [false, "skill-on-cooldown"]);
    const defended = defendCombatTurn(r2player.state, { expectedRevision: 6 }); ok(defended);
    const r3enemy = advanceCombatTurn(defended.state, { expectedRevision: 7 }); ok(r3enemy);
    const r3player = advanceCombatTurn(r3enemy.state, { expectedRevision: 8 }); ok(r3player);
    assert.deepEqual([r3player.state.revision, r3player.state.combat?.round,
      r3player.state.combat?.currentActorId], [9, 3, "TEST-player"]);
    const options3 = getCurrentPhysicalSkillOptions(r3player.state); ok(options3);
    assert.deepEqual([options3.options.skills[0]?.usable, options3.options.skills[0]?.readyRound], [true, 3]);
    const second = use(r3player.state, roller); ok(second);
    const action = second.state.combat?.lastAction;
    assert.equal(action?.type, "physical-skill");
    if (action?.type !== "physical-skill") return;
    assert.deepEqual([action.round, action.skillId, action.targetId, action.attack.rawD20,
      action.evasion.rawD20, action.outcome, action.readyRound],
    [3, "TEST-skill-1", "TEST-enemy-1", mode === "hit" ? 10 : mode === "miss" ? 3 : 1,
      mode === "hit" ? 8 : mode === "miss" ? 15 : 1, mode === "miss" ? "miss" : "hit", 5]);
    assert.deepEqual([second.state.revision, second.state.combat?.currentActorId,
      second.state.combat?.skillCooldowns[0]?.readyRound], [10, "TEST-enemy-2", 5]);
    const r4enemy = advanceCombatTurn(second.state, { expectedRevision: 10 }); ok(r4enemy);
    const r4player = advanceCombatTurn(r4enemy.state, { expectedRevision: 11 }); ok(r4player);
    const defendedAgain = defendCombatTurn(r4player.state, { expectedRevision: 12 }); ok(defendedAgain);
    const r5enemy = advanceCombatTurn(defendedAgain.state, { expectedRevision: 13 }); ok(r5enemy);
    const r5player = advanceCombatTurn(r5enemy.state, { expectedRevision: 14 }); ok(r5player);
    const third = use(r5player.state, roller); ok(third);
    const thirdAction = third.state.combat?.lastAction;
    assert.ok(thirdAction && "outcome" in thirdAction);
    assert.deepEqual([third.state.revision, thirdAction.round,
      thirdAction.outcome, third.state.combat?.skillCooldowns[0]?.readyRound],
    [16, 5, mode === "miss" ? "miss" : "hit", 7]);
  });
}

for (const firstAction of ["normal-attack", "physical-skill"] as const) {
  test(`共用 fixture：${firstAction} 後另一種物理行動仍可擲骰`, () => {
    const roller = createCombatActionFixtureRoller("hit");
    const initial = playerTurn();
    const first = firstAction === "normal-attack"
      ? resolveNormalAttack(initial, { expectedRevision: 3, targetId: "TEST-enemy-1" }, roller)
      : use(initial, roller);
    ok(first);
    const enemy = advanceCombatTurn(first.state, { expectedRevision: 4 }); ok(enemy);
    const nextPlayer = advanceCombatTurn(enemy.state, { expectedRevision: 5 }); ok(nextPlayer);
    const second = firstAction === "normal-attack"
      ? use(nextPlayer.state, roller)
      : resolveNormalAttack(nextPlayer.state, { expectedRevision: 6, targetId: "TEST-enemy-1" }, roller);
    ok(second);
    const secondAction = second.state.combat?.lastAction;
    assert.ok(secondAction && "outcome" in secondAction);
    assert.deepEqual([secondAction.type, secondAction.outcome,
      second.state.revision, second.state.combat?.currentActorId],
    [firstAction === "normal-attack" ? "physical-skill" : "normal-attack", "hit", 7, "TEST-enemy-2"]);
  });
}

test("stale、未裝備、未知／非物理、敵方、非法目標與注入均不擲骰、不改狀態", () => {
  const state = playerTurn();
  const cases = [
    [{ expectedRevision: 2, skillId: "TEST-skill-1", targetId: "TEST-enemy-1" }, "stale-revision"],
    [{ expectedRevision: 3, skillId: "TEST-unknown", targetId: "TEST-enemy-1" }, "unknown-skill"],
    [{ expectedRevision: 3, skillId: "TEST-skill-2", targetId: "TEST-enemy-1" }, "not-physical-skill"],
    [{ expectedRevision: 3, skillId: "TEST-skill-1", targetId: "TEST-enemy-2" }, "illegal-target"],
    [{ expectedRevision: 3, skillId: "TEST-skill-1", targetId: "TEST-player" }, "illegal-target"],
    [{ expectedRevision: 3, skillId: "TEST-skill-1", targetId: "TEST-enemy-1", damage: 999 }, "invalid-command"],
    [{ expectedRevision: 3, skillId: "TEST-skill-1", targetId: "TEST-enemy-1", attackRoll: 20 }, "invalid-command"],
    [{ expectedRevision: 3, skillId: "TEST-skill-1", targetId: "TEST-enemy-1", actorId: "TEST-player" }, "invalid-command"],
  ] as const;
  for (const [request, code] of cases) {
    const roller = new CountingRoller([10, 8]);
    const result = usePhysicalSkill(state, request, roller);
    assert.deepEqual([result.ok, result.ok ? null : result.code, roller.calls], [false, code, 0]);
    assert.deepEqual(state.combat?.skillCooldowns, []);
  }
  const unequipped = playerTurn(createTestGameState());
  const notEquipped = use(unequipped, new CountingRoller([10, 8]));
  assert.deepEqual([notEquipped.ok, notEquipped.ok ? null : notEquipped.code], [false, "skill-not-equipped"]);
  const unlearned = playerTurn(createGameState({ ...createTestGameState(),
    character: { ...createTestGameState().character, learnedActiveSkillIds: [], equippedSkillIds: [] },
  }));
  const notLearned = use(unlearned, new CountingRoller([10, 8]));
  assert.deepEqual([notLearned.ok, notLearned.ok ? null : notLearned.code], [false, "skill-not-learned"]);
  const enemy = startCombat(equippedState(), { expectedRevision: 1 }, TEST_COMBAT_PARTICIPANTS,
    createCombatFixtureRoller("normal")); ok(enemy);
  const enemyUse = use(enemy.state, new CountingRoller([10, 8]));
  assert.deepEqual([enemyUse.ok, enemyUse.ok ? null : enemyUse.code], [false, "not-player-turn"]);
  const escaped = runFromCombat(state, { expectedRevision: 3 }, new SequenceD20Roller([8])); ok(escaped);
  const endedUse = use(escaped.state, new CountingRoller([10, 8]));
  assert.deepEqual([endedUse.ok, endedUse.ok ? null : endedUse.code], [false, "combat-ended"]);
});

test("舊 CombatState 補空冷卻；新裁定與既有 action 經 snapshot 驗證", () => {
  const state = playerTurn();
  const legacy = { ...state.combat } as Record<string, unknown>;
  delete legacy.skillCooldowns;
  assert.deepEqual(createCombatState(legacy).skillCooldowns, []);
  const result = use(state); ok(result);
  assert.equal(result.state.combat?.lastAction?.type, "physical-skill");
  assert.equal(isAuthoritativeGameStateResponse({ sandbox: true, storage: "memory", state: result.state }), true);
  const hydrated = hydrateStateRow({ character_id: result.state.character.id,
    revision: String(result.state.revision), snapshot: { activity: result.state.activity,
      character: result.state.character, inventory: result.state.inventory,
      exploration: result.state.exploration, combat: JSON.parse(JSON.stringify(result.state.combat)) } });
  assert.deepEqual(hydrated.combat?.skillCooldowns, result.state.combat?.skillCooldowns);
  assert.equal(hydrated.combat?.lastAction?.type, "physical-skill");
});

test("API exact body、唯讀 options、權威 response 與 UI 技能顯示", async () => {
  const session = createDomainSession(equippedState());
  const app = await buildApp({ domainSession: session, combatSandbox: true,
    combatRoller: createCombatFixtureRoller("normal"), combatActionRoller: createCombatActionFixtureRoller("hit") });
  try {
    const start = await app.inject({ method: "POST", url: "/api/dev/combat/start", payload: { expectedRevision: 1 } });
    assert.equal(start.statusCode, 200);
    const advance = await app.inject({ method: "POST", url: "/api/dev/combat/advance", payload: { expectedRevision: 2 } });
    assert.equal(advance.statusCode, 200);
    const options = await app.inject({ method: "GET", url: "/api/combat/physical-skills/options" });
    assert.equal(options.statusCode, 200);
    assert.equal(isPhysicalSkillOptionsResponse(options.json()), true);
    assert.equal(session.getState().revision, 3);
    const injected = await app.inject({ method: "POST", url: "/api/combat/physical-skills/use",
      payload: { expectedRevision: 3, skillId: "TEST-skill-1", targetId: "TEST-enemy-1", readyRound: 1 } });
    assert.equal(injected.statusCode, 400);
    assert.equal(session.getState().revision, 3);
    const used = await app.inject({ method: "POST", url: "/api/combat/physical-skills/use",
      payload: { expectedRevision: 3, skillId: "TEST-skill-1", targetId: "TEST-enemy-1" } });
    assert.equal(used.statusCode, 200);
    assert.equal(isPhysicalSkillUseResponse(used.json()), true);
    assert.equal(used.json().state.combat.lastAction.readyRound, 3);
    await app.inject({ method: "POST", url: "/api/dev/combat/advance", payload: { expectedRevision: 4 } });
    await app.inject({ method: "POST", url: "/api/dev/combat/advance", payload: { expectedRevision: 5 } });
    const cooldown = await app.inject({ method: "POST", url: "/api/combat/physical-skills/use",
      payload: { expectedRevision: 6, skillId: "TEST-skill-1", targetId: "TEST-enemy-1" } });
    assert.deepEqual([cooldown.statusCode, cooldown.json().error, session.getState().revision],
      [409, "skill-on-cooldown", 6]);
    const defended = await app.inject({ method: "POST", url: "/api/combat/defend",
      payload: { expectedRevision: 6 } });
    assert.equal(defended.statusCode, 200);
    for (const revision of [7, 8]) {
      const next = await app.inject({ method: "POST", url: "/api/dev/combat/advance",
        payload: { expectedRevision: revision } });
      assert.equal(next.statusCode, 200);
    }
    const ready = await app.inject({ method: "GET", url: "/api/combat/physical-skills/options" });
    assert.deepEqual([ready.json().revision, ready.json().skills[0].readyRound,
      ready.json().skills[0].usable], [9, 3, true]);
    const reused = await app.inject({ method: "POST", url: "/api/combat/physical-skills/use",
      payload: { expectedRevision: 9, skillId: "TEST-skill-1", targetId: "TEST-enemy-1" } });
    assert.equal(reused.statusCode, 200);
    assert.deepEqual([reused.json().state.revision, reused.json().state.combat.currentActorId,
      reused.json().state.combat.lastAction.type, reused.json().state.combat.lastAction.round,
      reused.json().state.combat.lastAction.skillId, reused.json().state.combat.lastAction.targetId,
      reused.json().state.combat.lastAction.attack.total, reused.json().state.combat.lastAction.evasion.total,
      reused.json().state.combat.lastAction.outcome, reused.json().state.combat.skillCooldowns[0].readyRound],
    [10, "TEST-enemy-2", "physical-skill", 3, "TEST-skill-1", "TEST-enemy-1", 14, 9, "hit", 5]);
    const markup = renderToStaticMarkup(createElement(CombatPage, {
      gameState: { sandbox: true, storage: "memory", state: used.json().state }, stateError: null,
      onStateUpdate: () => undefined,
      onRetryState: async () => ({ sandbox: true, storage: "memory" as const, state: used.json().state }),
    }));
    assert.match(markup, /TEST 物理技能/);
    assert.match(markup, /未計算傷害/);
    assert.doesNotMatch(markup, /hpBefore|damageMultiplier|armorPiercing/);
  } finally { await app.close(); }
});

test("API 擲骰失敗保持 revision、Turn、冷卻與最近裁定", async () => {
  const session = createDomainSession(equippedState());
  const app = await buildApp({ domainSession: session, combatSandbox: true,
    combatRoller: createCombatFixtureRoller("normal"), combatActionRoller: new SequenceD20Roller([10]) });
  try {
    await app.inject({ method: "POST", url: "/api/dev/combat/start", payload: { expectedRevision: 1 } });
    await app.inject({ method: "POST", url: "/api/dev/combat/advance", payload: { expectedRevision: 2 } });
    const before = session.getState();
    const failed = await app.inject({ method: "POST", url: "/api/combat/physical-skills/use",
      payload: { expectedRevision: 3, skillId: "TEST-skill-1", targetId: "TEST-enemy-1" } });
    assert.deepEqual([failed.statusCode, failed.json().error], [500, "invalid-roll"]);
    assert.deepEqual(session.getState(), before);
  } finally { await app.close(); }
});

test("前端 API 只送三個欄位並驗證回應；服務不可用顯示安全訊息", async () => {
  const state = playerTurn();
  const result = use(state); ok(result);
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).endsWith("/options")) return new Response(JSON.stringify({
      revision: state.revision, ...getCurrentPhysicalSkillOptions(state).ok
        ? (getCurrentPhysicalSkillOptions(state) as Extract<ReturnType<typeof getCurrentPhysicalSkillOptions>, { ok: true }>).options
        : {},
    }), { status: 200 });
    assert.deepEqual(JSON.parse(String(init?.body)), {
      expectedRevision: 3, skillId: "TEST-skill-1", targetId: "TEST-enemy-1",
    });
    return new Response(JSON.stringify({ sandbox: true, storage: "memory",
      effect: result.effect, state: result.state }), { status: 200 });
  };
  assert.equal((await loadPhysicalSkillOptions(fetcher as typeof fetch)).skills[0]?.usable, true);
  assert.equal((await executePhysicalSkill(3, "TEST-skill-1", "TEST-enemy-1", fetcher as typeof fetch)).state.revision, 4);
  await assert.rejects(executePhysicalSkill(3, "TEST-skill-1", "TEST-enemy-1",
    async () => new Response(JSON.stringify({ error: "invalid-roll", message: "internal stack trace" }), { status: 500 })),
  /目前無法完成技能判定，請再試一次。/);
  await assert.rejects(loadPhysicalSkillOptions(async () => { throw new Error("SQL internal path"); }),
    /目前無法讀取物理技能/);
});

test("隔離 PostgreSQL 保存技能冷卻並由新 repository 讀回", {
  skip: !process.env.TEST_DATABASE_URL && "需提供隔離的 TEST_DATABASE_URL，並先執行 migration。",
}, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 2 });
  const id = `TEST-physical-skill-${randomUUID()}`;
  try {
    const seed = createGameState({ ...equippedState(), character: { ...equippedState().character, id } });
    const session = createPersistedDomainSession(new PostgresGameStateRepository(pool), seed);
    const started = await session.startCombat({ expectedRevision: 1 }, TEST_COMBAT_PARTICIPANTS,
      createCombatFixtureRoller("normal")); ok(started);
    const advanced = await session.advanceCombat({ expectedRevision: 2 }); ok(advanced);
    const used = await session.usePhysicalSkill({ expectedRevision: 3, skillId: "TEST-skill-1", targetId: "TEST-enemy-1" },
      new SequenceD20Roller([10, 8])); ok(used);
    const loaded = await new PostgresGameStateRepository(pool).load(id);
    assert.deepEqual(loaded?.combat?.skillCooldowns, [{ actorId: "TEST-player", skillId: "TEST-skill-1", readyRound: 3 }]);
    assert.equal(loaded?.combat?.lastAction?.type, "physical-skill");
  } finally {
    await pool.query("DELETE FROM game_states WHERE character_id = $1", [id]);
    await pool.end();
  }
});
