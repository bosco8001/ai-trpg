import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { advanceCombatTurn, cancelCasting, defendCombatTurn, getCurrentDragonBreathOptions,
  getCurrentPhysicalSkillOptions, runFromCombat, startCasting, startCombat, useDragonBreath,
  type CombatParticipantSeed, type DiceRoller } from "../src/domain/combat.js";
import { createCombatState } from "../src/domain/combat-state.js";
import { applyCommand, createGameState, gameStateContents, type GameState } from "./helpers/phase26-fixture.js";
import { TEST_COMBAT_PARTICIPANTS } from "../src/server/combat/fixtures.js";
import { createCombatActionFixtureRoller, createCombatFixtureRoller, SequenceD20Roller } from "../src/server/combat/dice.js";
import { buildApp } from "./helpers/phase26-fixture.js";
import { createDomainSession, createPersistedDomainSession } from "../src/server/domain-session.js";
import { createTestGameState } from "./helpers/phase26-fixture.js";
import { hydrateStateRow, PostgresGameStateRepository } from "../src/server/postgres-game-state-repository.js";
import { isAuthoritativeGameStateResponse, isDragonBreathOptionsResponse, isDragonBreathResponse } from "../src/shared/game-state.js";
import { executeDragonBreath, loadDragonBreathOptions } from "../src/web/api.js";
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
function player(initial = createTestGameState(), participants: readonly CombatParticipantSeed[] = TEST_COMBAT_PARTICIPANTS): GameState {
  const started = startCombat(initial, { expectedRevision: initial.revision }, participants, createCombatFixtureRoller("normal")); ok(started);
  const advanced = advanceCombatTurn(started.state, { expectedRevision: started.state.revision }); ok(advanced);
  return advanced.state;
}
function nextPlayer(state: GameState): GameState {
  let next = state;
  for (let i = 0; i < 2; i += 1) { const result = advanceCombatTurn(next, { expectedRevision: next.revision }); ok(result); next = result.state; }
  return next;
}
function use(state: GameState, row: "front" | "back" = "front", roller: DiceRoller = new SequenceD20Roller([10, 8])) {
  return useDragonBreath(state, { expectedRevision: state.revision, targetRow: row }, roller);
}

test("龍裔天生能力不佔六格、不需已學或裝備、不扣 MP；非龍裔在擲骰前拒絕", () => {
  const base = createTestGameState();
  const equipped = applyCommand(base, { type: "set-equipped-skills", expectedRevision: 0,
    skillIds: Array.from({ length: 6 }, (_, i) => `TEST-skill-${i + 1}`) }); ok(equipped);
  const ready = player(equipped.state);
  const options = getCurrentDragonBreathOptions(ready); ok(options);
  assert.deepEqual([options.options.available, options.options.element, options.options.currentRound], [true, "fire", 1]);
  assert.equal(ready.character.equippedSkillIds.length, 6);
  assert.equal(ready.character.equippedSkillIds.includes("dragon-breath"), false);
  const used = use(ready); ok(used);
  assert.deepEqual(used.state.character.equippedSkillIds, ready.character.equippedSkillIds);
  assert.equal(used.state.combat!.participants.find(p=>p.side === "party" && p.controlledBy !== "companion")!.mp!.currentMp, 24);
  assert.deepEqual(used.state.combat?.skillCooldowns, []);
  assert.deepEqual(used.state.combat?.activeCastings, []);
  assert.equal(used.state.combat?.racialAbilityCooldowns[0]?.readyRound, 4);
  const emptyLoadout = player(createGameState({ ...base, character: { ...base.character,
    learnedActiveSkillIds: [], equippedSkillIds: [] } }));
  assert.equal(getCurrentDragonBreathOptions(emptyLoadout).ok, true);
  ok(use(emptyLoadout));
  const nonDragonborn = createGameState({ ...ready, character: { ...ready.character, raceId: "human", dragonBreathElement: null } });
  const dice = new CountingRoller([10, 8]);
  const refused = use(nonDragonborn, "front", dice);
  assert.deepEqual([refused.ok, refused.ok ? null : refused.code, dice.calls], [false, "not-dragonborn", 0]);
  assert.equal(nonDragonborn.revision, ready.revision);
  const unknownElement = createGameState({ ...ready, character: { ...ready.character, dragonBreathElement: null } });
  assert.deepEqual([getCurrentDragonBreathOptions(unknownElement).ok, use(unknownElement).ok], [true, false]);
});

test("同排兩目標各自攻擊與閃避：一命中一落空，但只提交一次行動", () => {
  const twoFront = TEST_COMBAT_PARTICIPANTS.map((entry) => entry.id === "TEST-enemy-2"
    ? { ...entry, row: "front" as const } : entry);
  const state = player(createTestGameState(), twoFront);
  const dice = new CountingRoller([10, 8, 3, 15]);
  const result = use(state, "front", dice); ok(result);
  const action = result.state.combat?.lastAction;
  assert.ok(action?.type === "dragon-breath");
  assert.deepEqual(action.results.map((entry) => [entry.targetId, entry.attack.rawD20, entry.evasion.rawD20, entry.outcome]), [
    ["TEST-enemy-1", 10, 8, "hit"], ["TEST-enemy-2", 3, 15, "miss"],
  ]);
  assert.deepEqual([dice.calls, result.state.revision, result.state.combat?.currentActorId,
    result.state.combat?.round, result.state.combat?.racialAbilityCooldowns.length],
  [4, state.revision + 1, "TEST-enemy-2", 1, 1]);
  assert.equal("damage" in action, false);
  assert.equal(isAuthoritativeGameStateResponse({ sandbox: true, storage: "memory", state: result.state }), true);
});

test("Phase 18 循環命名骰 fixture 可在同一排兩目標及再次行動重複使用", () => {
  const twoFront = TEST_COMBAT_PARTICIPANTS.map((entry) => entry.id === "TEST-enemy-2"
    ? { ...entry, row: "front" as const } : entry);
  const fixture = createCombatActionFixtureRoller("hit");
  const state = player(createTestGameState(), twoFront);
  const first = use(state, "front", fixture); ok(first);
  const action = first.state.combat?.lastAction;
  assert.ok(action?.type === "dragon-breath");
  assert.deepEqual(action.results.map((entry) => [entry.attack.rawD20, entry.evasion.rawD20]), [[10, 8], [10, 8]]);
  let current = first.state;
  for (let round = 2; round <= 3; round += 1) {
    current = nextPlayer(current);
    const defended = defendCombatTurn(current, { expectedRevision: current.revision }); ok(defended);
    current = defended.state;
  }
  current = nextPlayer(current);
  const second = use(current, "front", fixture); ok(second);
  assert.equal(second.state.combat?.lastAction?.type, "dragon-breath");
});

test("龍息含等號命中、raw 1 可命中；19 命中才暴擊，19 落空不是暴擊", () => {
  const state = player();
  for (const [rolls, outcome, critical] of [
    [[1, 1], "hit", false], [[19, 8], "hit", true], [[19, 20], "miss", false],
  ] as const) {
    const result = use(state, "front", new SequenceD20Roller(rolls)); ok(result);
    const action = result.state.combat?.lastAction;
    assert.ok(action?.type === "dragon-breath");
    assert.deepEqual([action.results[0]?.outcome, action.results[0]?.critical], [outcome, critical]);
  }
});

test("R1 使用後 R2/R3 直接提交被拒絕；R4 可用並更新為 R7", () => {
  const r1 = player();
  const first = use(r1); ok(first);
  assert.equal(first.state.combat?.racialAbilityCooldowns[0]?.readyRound, 4);
  let state = first.state;
  for (const round of [2, 3]) {
    state = nextPlayer(state);
    assert.equal(state.combat?.round, round);
    const options = getCurrentDragonBreathOptions(state); ok(options);
    assert.deepEqual([options.options.available, options.options.unavailableReason, options.options.readyRound],
      [false, "ability-on-cooldown", 4]);
    const dice = new CountingRoller([10, 8]);
    const refused = use(state, "front", dice);
    assert.deepEqual([refused.ok, refused.ok ? null : refused.code, dice.calls], [false, "ability-on-cooldown", 0]);
    const defended = defendCombatTurn(state, { expectedRevision: state.revision }); ok(defended); state = defended.state;
  }
  state = nextPlayer(state);
  assert.equal(state.combat?.round, 4);
  const options = getCurrentDragonBreathOptions(state); ok(options);
  assert.equal(options.options.available, true);
  const second = use(state); ok(second);
  assert.equal(second.state.combat?.racialAbilityCooldowns[0]?.readyRound, 7);
});

test("前後排都可直接選，空排在 options 停用且提交前拒絕", () => {
  const ready = player();
  const options = getCurrentDragonBreathOptions(ready); ok(options);
  assert.deepEqual(options.options.rows.map((entry) => [entry.row, entry.targetCount, entry.available]),
    [["front", 1, true], ["back", 1, true]]);
  const back = use(ready, "back"); ok(back);
  assert.deepEqual(back.state.combat?.lastAction?.type, "dragon-breath");
  if (back.state.combat?.lastAction?.type === "dragon-breath") {
    assert.deepEqual(back.state.combat.lastAction.results.map((entry) => entry.targetId), ["TEST-enemy-2"]);
  }
  const frontOnly = player(createTestGameState(), TEST_COMBAT_PARTICIPANTS.map((entry) => entry.id === "TEST-enemy-2"
    ? { ...entry, row: "front" as const } : entry));
  const frontOnlyOptions = getCurrentDragonBreathOptions(frontOnly); ok(frontOnlyOptions);
  assert.deepEqual(frontOnlyOptions.options.rows[1], { row: "back", targetCount: 0, available: false,
    unavailableReason: "empty-target-row" });
  const dice = new CountingRoller([10, 8]);
  const rejected = use(frontOnly, "back", dice);
  assert.deepEqual([rejected.ok, rejected.ok ? null : rejected.code, dice.calls], [false, "empty-target-row", 0]);
});

test("stale、注入、非法排、敵方回合、ended 與途中骰子故障都不提交", () => {
  const state = player();
  const before = JSON.stringify(state);
  const staleDice = new CountingRoller([10, 8]);
  for (const input of [
    { expectedRevision: state.revision - 1, targetRow: "front" },
    { expectedRevision: state.revision, targetRow: "left" },
    { expectedRevision: state.revision, targetRow: "front", actorId: "TEST-player", element: "lightning",
      attackRoll: 20, critical: true, damage: 999, readyRound: 1 },
  ]) {
    const rejected = useDragonBreath(state, input, staleDice);
    assert.equal(rejected.ok, false);
  }
  assert.equal(staleDice.calls, 0);
  const twoFront = TEST_COMBAT_PARTICIPANTS.map((entry) => entry.id === "TEST-enemy-2"
    ? { ...entry, row: "front" as const } : entry);
  const multi = player(createTestGameState(), twoFront);
  const failed = use(multi, "front", new CountingRoller([10, 8, 3]));
  assert.deepEqual([failed.ok, failed.ok ? null : failed.code], [false, "invalid-roll"]);
  assert.equal(multi.combat?.racialAbilityCooldowns.length, 0);
  assert.equal(multi.combat?.lastAction, null);
  assert.equal(JSON.stringify(state), before);
  const started = startCombat(createTestGameState(), { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS,
    createCombatFixtureRoller("normal")); ok(started);
  const enemyDice = new CountingRoller([10, 8]);
  assert.deepEqual([use(started.state, "front", enemyDice).ok, enemyDice.calls], [false, 0]);
  const escaped = runFromCombat(state, { expectedRevision: state.revision }, new SequenceD20Roller([8])); ok(escaped);
  assert.equal(getCurrentDragonBreathOptions(escaped.state).ok, false);
  assert.equal(use(escaped.state).ok, false);
  assert.equal(gameStateContents(state).combat?.status,"active");
});

test("詠唱阻止龍息；取消後同一 Turn 可使用且 MP 不再扣除", () => {
  const equipped = applyCommand(createTestGameState(), { type: "set-equipped-skills", expectedRevision: 0,
    skillIds: ["TEST-skill-1", "TEST-skill-2"] }); ok(equipped);
  const ready = player(equipped.state);
  const started = startCasting(ready, { expectedRevision: ready.revision, skillId: "TEST-skill-2" }); ok(started);
  const r2 = nextPlayer(started.state);
  const before = getCurrentDragonBreathOptions(r2); ok(before);
  assert.deepEqual([before.options.available, before.options.unavailableReason], [false, "casting-active"]);
  const dice = new CountingRoller([10, 8]);
  const blocked = use(r2, "front", dice);
  assert.deepEqual([blocked.ok, blocked.ok ? null : blocked.code, dice.calls], [false, "casting-active", 0]);
  const cancelled = cancelCasting(r2, { expectedRevision: r2.revision }); ok(cancelled);
  assert.equal(cancelled.state.combat?.currentActorId, "TEST-player");
  const option = getCurrentDragonBreathOptions(cancelled.state); ok(option);
  assert.equal(option.options.available, true);
  const used = use(cancelled.state); ok(used);
  assert.deepEqual([used.state.combat!.participants.find(p=>p.side === "party" && p.controlledBy !== "companion")!.mp!.currentMp, used.state.combat?.currentActorId,
    getCurrentPhysicalSkillOptions(used.state).ok], [18, "TEST-enemy-2", true]);
});

test("舊快照補空天生能力冷卻；已知 TEST 元素補固定值，未知角色保持未解決", () => {
  const fresh = player();
  const old = JSON.parse(JSON.stringify(fresh)) as Record<string, unknown>;
  delete (old.combat as Record<string, unknown>).racialAbilityCooldowns;
  delete (old.character as Record<string, unknown>).raceId;
  delete (old.character as Record<string, unknown>).dragonBreathElement;
  const hydrated = hydrateStateRow({ character_id: "TEST-character", revision: String(fresh.revision),
    snapshot: { activity: old.activity, character: old.character, inventory: old.inventory,
      exploration: old.exploration, combat: old.combat } });
  assert.deepEqual(hydrated.combat?.racialAbilityCooldowns, []);
  assert.deepEqual([hydrated.character.raceId, hydrated.character.dragonBreathElement], ["dragonborn", "fire"]);
  const unknown = createGameState({ ...createTestGameState(), character: {
    id: "other-character", currentMp: 24, learnedActiveSkillIds: [], equippedSkillIds: [],
  } });
  assert.deepEqual([unknown.character.raceId, unknown.character.dragonBreathElement], [null, null]);
  const unresolved = createGameState({ ...fresh, character: { ...fresh.character,
    id: "other-character", raceId: "dragonborn", dragonBreathElement: null },combat:{...fresh.combat,lifecycle:{...fresh.combat!.lifecycle!,runId:"fixture-run-other-character"},participants:fresh.combat!.participants.map(p=>p.characterId === "TEST-character" ? {...p,characterId:"other-character"} : p)} });
  assert.equal(use(unresolved).ok, false);
  const action = use(fresh); ok(action);
  assert.equal(isAuthoritativeGameStateResponse({ sandbox: true, storage: "memory", state: action.state }), true);
  assert.equal(createCombatState(action.state.combat).lastAction?.type, "dragon-breath");
  const tampered = { ...action.state, character: { ...action.state.character, dragonBreathElement: "ice" } };
  assert.throws(() => createGameState(tampered));
  assert.equal(isAuthoritativeGameStateResponse({ sandbox: true, storage: "memory", state: tampered }), false);
});

test("API 只接受 revision 與 targetRow；GET、取消選排不改權威狀態", async () => {
  const initial = player();
  const session = createDomainSession(initial);
  const app = await buildApp({ domainSession: session, combatSandbox: true,
    combatActionRoller: createCombatActionFixtureRoller("hit") });
  try {
    const before = session.getState();
    const options = await app.inject({ method: "GET", url: "/api/combat/dragon-breath/options" });
    assert.equal(options.statusCode, 200);
    assert.equal(isDragonBreathOptionsResponse(options.json()), true);
    assert.deepEqual(session.getState(), before);
    // 選排與取消只屬 UI local state；此時沒有 POST。
    const invalid = await app.inject({ method: "POST", url: "/api/combat/dragon-breath",
      payload: { expectedRevision: before.revision, targetRow: "front", damage: 999 } });
    assert.deepEqual([invalid.statusCode, invalid.json().error], [400, "invalid-command"]);
    const stale = await app.inject({ method: "POST", url: "/api/combat/dragon-breath",
      payload: { expectedRevision: before.revision - 1, targetRow: "front" } });
    assert.deepEqual([stale.statusCode, stale.json().error], [409, "stale-revision"]);
    assert.deepEqual(session.getState(), before);
    const success = await app.inject({ method: "POST", url: "/api/combat/dragon-breath",
      payload: { expectedRevision: before.revision, targetRow: "front" } });
    assert.equal(success.statusCode, 200);
    assert.equal(isDragonBreathResponse(success.json()), true);
    assert.equal(success.json().state.combat.lastAction.results[0].attack.rawD20, 10);
    assert.equal(success.json().state.combat.lastAction.results[0].evasion.rawD20, 8);
    assert.equal(success.json().state.revision, before.revision + 1);
    for (const revision of [before.revision + 1, before.revision + 2]) {
      const advanced = await app.inject({ method: "POST", url: "/api/dev/combat/advance",
        payload: { expectedRevision: revision } });
      assert.equal(advanced.statusCode, 200);
    }
    const r2 = session.getState();
    assert.equal(r2.combat?.round, 2);
    const cooldown = await app.inject({ method: "POST", url: "/api/combat/dragon-breath",
      payload: { expectedRevision: r2.revision, targetRow: "front" } });
    assert.deepEqual([cooldown.statusCode, cooldown.json().error], [409, "ability-on-cooldown"]);
    assert.deepEqual(session.getState(), r2);
    const markup = renderToStaticMarkup(createElement(CombatPage, { gameState: { sandbox: true,
      storage: "memory", state: success.json().state }, stateError: null, onStateUpdate: () => undefined,
      onRetryState: async () => ({ sandbox: true, storage: "memory" as const, state: success.json().state }) }));
    assert.match(markup, /龍息・火/);
    assert.match(markup, /攻擊：10 \+ 1 PER = 11/);
    assert.match(markup, /第 4 回合可再次使用/);
    assert.match(markup, /HP 6 \/ 6/);
    assert.doesNotMatch(markup, /造成 0 傷害/);
  } finally { await app.close(); }
});

test("前端嚴格送兩欄位，驗證 options 與結果", async () => {
  const state = player();
  const options = getCurrentDragonBreathOptions(state); ok(options);
  const result = use(state); ok(result);
  const fetcher = async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url).endsWith("/options")) return Response.json({ revision: options.revision, ...options.options });
    assert.equal(init?.body, JSON.stringify({ expectedRevision: state.revision, targetRow: "front" }));
    return Response.json({ sandbox: true, storage: "memory", effect: result.effect, state: result.state });
  };
  assert.equal((await loadDragonBreathOptions(fetcher as typeof fetch)).rows[0]?.targetCount, 1);
  assert.equal((await executeDragonBreath(state.revision, "front", fetcher as typeof fetch)).state.revision, state.revision + 1);
  await assert.rejects(loadDragonBreathOptions(async () => Response.json({ revision: state.revision })), /格式不正確/);
  await assert.rejects(executeDragonBreath(state.revision, "front", async () => Response.json({})), /格式不正確/);
});

test("隔離 PostgreSQL 保存元素、冷卻與逐目標裁定，重建 session 後可讀回", {
  skip: !process.env.TEST_DATABASE_URL && "需提供隔離的 TEST_DATABASE_URL，並先執行 migration。",
}, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 2 });
  const id = `TEST-dragon-breath-${randomUUID()}`;
  try {
    const seed = createGameState({ ...createTestGameState(), character: { ...createTestGameState().character, id } });
    const session = createPersistedDomainSession(new PostgresGameStateRepository(pool), seed);
    const started = await session.startCombat({ expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS,
      createCombatFixtureRoller("normal")); ok(started);
    const advanced = await session.advanceCombat({ expectedRevision: 1 }); ok(advanced);
    const used = await session.useDragonBreath({ expectedRevision: 2, targetRow: "front" },
      new SequenceD20Roller([10, 8])); ok(used);
    const reloaded = await createPersistedDomainSession(new PostgresGameStateRepository(pool), seed).getState();
    assert.deepEqual(reloaded, used.state);
    assert.equal(reloaded.character.dragonBreathElement, "fire");
    assert.equal(reloaded.combat?.racialAbilityCooldowns[0]?.readyRound, 4);
  } finally {
    await pool.query("DELETE FROM game_states WHERE character_id = $1", [id]);
    await pool.end();
  }
});
