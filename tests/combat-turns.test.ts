import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { advanceCombatTurn, startCombat } from "../src/domain/combat.js";
import { createCombatState } from "../src/domain/combat-state.js";
import { createGameState, type GameState } from "../src/domain/game.js";
import { buildApp } from "../src/server/app.js";
import { createCombatFixtureRoller, RandomD20Roller, SequenceD20Roller } from "../src/server/combat/dice.js";
import { TEST_COMBAT_PARTICIPANTS } from "../src/server/combat/fixtures.js";
import { createDomainSession, createPersistedDomainSession } from "../src/server/domain-session.js";
import { createExplorationActionService } from "../src/server/exploration/action-service.js";
import { PostgresGameStateRepository, hydrateStateRow } from "../src/server/postgres-game-state-repository.js";
import { InMemorySaveGameRepository } from "../src/server/save-game/memory-repository.js";
import { createSaveGameService } from "../src/server/save-game/service.js";
import { SaveGameFailure } from "../src/server/save-game/contracts.js";

function seed(characterId = "TEST-character"): GameState {
  return createGameState({
    revision: 0,
    activity: "outside-combat",
    character: {
      id: characterId,
      learnedActiveSkillIds: ["TEST-skill-1"],
      equippedSkillIds: [],
    },
    exploration: { locationId: "TEST-forest-edge", lastObservationTargetId: null },
    combat: null,
  });
}

function requireStarted(result: ReturnType<typeof startCombat>): Extract<typeof result, { ok: true }> {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("TEST combat 未能開始。");
  return result;
}

function participant(state: GameState, id: string) {
  const value = state.combat?.participants.find((entry) => entry.id === id);
  assert.ok(value);
  return value;
}

async function expectSaveFailure(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof SaveGameFailure);
    assert.equal(error.code, code);
    return true;
  });
}

test("normal fixture 依 D20 + DEX 由高至低建立三人先攻，只增加一次 revision", () => {
  const started = requireStarted(startCombat(
    seed(), { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"),
  ));
  assert.equal(started.state.revision, 1);
  assert.equal(started.state.activity, "in-combat");
  assert.equal(started.state.combat?.round, 1);
  assert.equal(started.state.combat?.currentTurnIndex, 0);
  assert.deepEqual(started.state.combat?.turnOrder, ["TEST-enemy-1", "TEST-player", "TEST-enemy-2"]);
  assert.equal(started.state.combat?.currentActorId, "TEST-enemy-1");
  assert.deepEqual(participant(started.state, "TEST-player").initiative, {
    baseD20: 12, dexterityModifier: 2, total: 14, tieBreakRolls: [],
  });
  assert.deepEqual(participant(started.state, "TEST-enemy-1").initiative, {
    baseD20: 17, dexterityModifier: 1, total: 18, tieBreakRolls: [],
  });
  assert.deepEqual(participant(started.state, "TEST-enemy-2").initiative, {
    baseD20: 8, dexterityModifier: 0, total: 8, tieBreakRolls: [],
  });
});

test("runtime D20 adapter 每次只產生 1 至 20 的整數", () => {
  const roller = new RandomD20Roller();
  for (let index = 0; index < 100; index += 1) {
    const value = roller.d20();
    assert.equal(Number.isInteger(value), true);
    assert.ok(value >= 1 && value <= 20);
  }
});

test("tie fixture 只重擲同分者，再次同點時只讓仍平手者繼續，原 total 不變", () => {
  const started = requireStarted(startCombat(
    seed(), { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("tie"),
  ));
  assert.equal(started.state.revision, 1);
  assert.deepEqual(started.state.combat?.turnOrder, ["TEST-enemy-1", "TEST-player", "TEST-enemy-2"]);
  assert.deepEqual(participant(started.state, "TEST-player").initiative, {
    baseD20: 10, dexterityModifier: 2, total: 12, tieBreakRolls: [7, 4],
  });
  assert.deepEqual(participant(started.state, "TEST-enemy-1").initiative, {
    baseD20: 11, dexterityModifier: 1, total: 12, tieBreakRolls: [7, 15],
  });
  assert.deepEqual(participant(started.state, "TEST-enemy-2").initiative, {
    baseD20: 6, dexterityModifier: 0, total: 6, tieBreakRolls: [],
  });
});

test("平手順序由重擲決定，不以 ID、字母或輸入順序代替", () => {
  const started = requireStarted(startCombat(seed(), { expectedRevision: 0 }, [
    { id: "TEST-a", displayName: "TEST A", side: "party", row: "front", dexterityModifier: 0, normalAttack: null },
    { id: "TEST-z", displayName: "TEST Z", side: "enemy", row: "front", dexterityModifier: 0, normalAttack: null },
  ], new SequenceD20Roller([10, 10, 1, 20])));
  assert.deepEqual(started.state.combat?.turnOrder, ["TEST-z", "TEST-a"]);
});

test("Start Combat 拒絕 stale、額外欄位、非法骰子與重複開始，失敗不改 state", () => {
  const initial = seed();
  for (const [input, roller, code] of [
    [{ expectedRevision: 1 }, new SequenceD20Roller([10, 10, 10]), "stale-revision"],
    [{ expectedRevision: 0, round: 99 }, new SequenceD20Roller([10, 10, 10]), "invalid-command"],
    [{ expectedRevision: 0 }, { d20: () => 21 }, "invalid-combat-setup"],
  ] as const) {
    const result = startCombat(initial, input, TEST_COMBAT_PARTICIPANTS, roller);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, code);
    assert.equal(initial.revision, 0);
    assert.equal(initial.combat, null);
  }
  const started = requireStarted(startCombat(
    initial, { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"),
  ));
  const repeated = startCombat(
    started.state, { expectedRevision: 1 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"),
  );
  assert.equal(repeated.ok, false);
  if (!repeated.ok) assert.equal(repeated.code, "already-in-combat");
  assert.equal(started.state.revision, 1);
});

test("Advance 逐一停在每名參與者，最後一人才 wrap 至下一 Round", () => {
  const initialExploration = seed().exploration;
  let state = requireStarted(startCombat(
    seed(), { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"),
  )).state;
  assert.equal(state.combat?.currentActorId, "TEST-enemy-1");
  assert.equal(state.revision, 1);
  const first = advanceCombatTurn(state, { expectedRevision: 1 });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  state = first.state;
  assert.deepEqual([state.combat?.round, state.combat?.currentTurnIndex, state.combat?.currentActorId, state.revision],
    [1, 1, "TEST-player", 2]);
  const second = advanceCombatTurn(state, { expectedRevision: 2 });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  state = second.state;
  assert.deepEqual([state.combat?.round, state.combat?.currentTurnIndex, state.combat?.currentActorId, state.revision],
    [1, 2, "TEST-enemy-2", 3]);
  const third = advanceCombatTurn(state, { expectedRevision: 3 });
  assert.equal(third.ok, true);
  if (!third.ok) return;
  state = third.state;
  assert.deepEqual([state.combat?.round, state.combat?.currentTurnIndex, state.combat?.currentActorId, state.revision],
    [2, 0, "TEST-enemy-1", 4]);
  assert.deepEqual(state.exploration, initialExploration);
});

test("Advance stale、額外欄位與非戰鬥狀態都拒絕，current actor 不變", () => {
  const started = requireStarted(startCombat(
    seed(), { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"),
  ));
  for (const [state, input, code] of [
    [started.state, { expectedRevision: 0 }, "stale-revision"],
    [started.state, { expectedRevision: 1, currentActorId: "TEST-player" }, "invalid-command"],
    [seed(), { expectedRevision: 0 }, "not-in-combat"],
  ] as const) {
    const result = advanceCombatTurn(state, input);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, code);
  }
  assert.equal(started.state.combat?.currentActorId, "TEST-enemy-1");
  assert.equal(started.state.revision, 1);
});

test("CombatState runtime validation 拒絕不一致 actor、initiative 順序、total 與額外欄位", () => {
  const valid = requireStarted(startCombat(
    seed(), { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"),
  )).state.combat!;
  assert.deepEqual(createCombatState(valid), valid);
  for (const combat of [
    { ...valid, currentActorId: "TEST-player" },
    { ...valid, turnOrder: ["TEST-player"] },
    { ...valid, turnOrder: ["TEST-player", "TEST-enemy-1", "TEST-enemy-2"], currentActorId: "TEST-player" },
    { ...valid, round: 1, winner: "TEST-player" },
    { ...valid, participants: valid.participants.map((entry, index) => index === 0
      ? { ...entry, initiative: { ...entry.initiative, total: 999 } } : entry) },
    { ...valid, participants: valid.participants.map((entry, index) => index === 0
      ? { ...entry, initiative: { ...entry.initiative, tieBreakRolls: [20] } } : entry) },
  ]) assert.throws(() => createCombatState(combat));
  assert.throws(() => createGameState({ ...seed(), activity: "in-combat", combat: null }));
});

test("active combat 阻擋探索且不呼叫 narrator，也不改 exploration 或 combat clock", async () => {
  let narratorCalls = 0;
  const started = requireStarted(startCombat(
    seed(), { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"),
  ));
  const session = createDomainSession(started.state);
  const service = createExplorationActionService({
    async interpret(text) {
      return { status: "candidate", kind: "move", target: "森林裡的廢墟", manner: "慢慢",
        clarificationQuestion: null, originalText: String(text) };
    },
  }, session, "memory", {
    async narrate() { narratorCalls += 1; return { text: "不應出現" }; },
  });
  const response = await service.execute("我慢慢走向森林裡的廢墟。", 1);
  assert.equal(response.ruling.accepted, false);
  if (!response.ruling.accepted) assert.equal(response.ruling.code, "action-not-allowed");
  assert.equal(narratorCalls, 0);
  assert.equal((await session.getState()).revision, 1);
  assert.equal((await session.getState()).exploration.locationId, "TEST-forest-edge");
  assert.equal((await session.getState()).combat?.currentActorId, "TEST-enemy-1");
});

test("戰鬥中的 Save 與 Load 暫時安全拒絕，Save Format v1 不含 combat 且 revision 不變", async () => {
  const session = createDomainSession(seed());
  const repository = new InMemorySaveGameRepository(() => session.getState());
  const saves = createSaveGameService(repository, session, "memory");
  await saves.save(1, 0);
  const started = await session.startCombat(
    { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"),
  );
  assert.equal(started.ok, true);
  await expectSaveFailure(saves.save(2, 1), "combat-not-supported");
  await expectSaveFailure(saves.load(1, 1), "combat-not-supported");
  const state = await session.getState();
  assert.equal(state.revision, 1);
  assert.equal(state.activity, "in-combat");
  const stored = await repository.read(1);
  assert.ok(stored);
  assert.equal("combat" in (stored.snapshot as object), false);
});

test("dev combat sandbox 驗證 request、structured state、stale 與 production 關閉", async (t) => {
  const app = await buildApp({ combatSandbox: true, combatRoller: createCombatFixtureRoller("normal") });
  t.after(() => app.close());
  const initial = await app.inject("/api/dev/combat");
  assert.equal(initial.statusCode, 200);
  assert.equal(initial.json().state.combat, null);
  for (const payload of [
    { expectedRevision: 0, initiative: 20 },
    { expectedRevision: 0, round: 50 },
    { expectedRevision: 0, currentActorId: "TEST-player" },
  ]) {
    const rejected = await app.inject({ method: "POST", url: "/api/dev/combat/start", payload });
    assert.equal(rejected.statusCode, 400);
  }
  const started = await app.inject({
    method: "POST", url: "/api/dev/combat/start", payload: { expectedRevision: 0 },
  });
  assert.equal(started.statusCode, 200);
  assert.equal(started.json().state.revision, 1);
  assert.equal(started.json().state.combat.currentActorId, "TEST-enemy-1");
  const stale = await app.inject({
    method: "POST", url: "/api/dev/combat/advance", payload: { expectedRevision: 0 },
  });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.json().code, "stale-revision");
  const unchanged = await app.inject("/api/dev/combat");
  assert.equal(unchanged.json().state.combat.currentActorId, "TEST-enemy-1");

  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const production = await buildApp({ combatSandbox: true, combatRoller: new SequenceD20Roller([10, 10, 10]) });
  if (previous === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previous;
  t.after(() => production.close());
  assert.equal((await production.inject("/api/dev/combat")).statusCode, 404);
});

test("Save / Load API 在 active combat 回安全 engineering safeguard，不修改 revision", async (t) => {
  const session = createDomainSession(seed());
  const saveRepository = new InMemorySaveGameRepository(() => session.getState());
  const app = await buildApp({
    domainSession: session,
    saveGameRepository: saveRepository,
    combatSandbox: true,
    combatRoller: createCombatFixtureRoller("normal"),
  });
  t.after(() => app.close());
  assert.equal((await app.inject({
    method: "PUT", url: "/api/save-slots/1", payload: { expectedRevision: 0 },
  })).statusCode, 200);
  assert.equal((await app.inject({
    method: "POST", url: "/api/dev/combat/start", payload: { expectedRevision: 0 },
  })).statusCode, 200);
  for (const request of [
    { method: "PUT" as const, url: "/api/save-slots/2", payload: { expectedRevision: 1 } },
    { method: "POST" as const, url: "/api/save-slots/1/load", payload: { expectedRevision: 1 } },
  ]) {
    const response = await app.inject(request);
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().error, "combat-not-supported");
    assert.equal(response.json().message, "目前工程階段尚未支援戰鬥中的存檔與載入。");
  }
  assert.equal((await session.getState()).revision, 1);
  assert.equal((await session.getState()).combat?.currentActorId, "TEST-enemy-1");
});

test("舊 snapshot 安全 hydrate 為無 active combat；新 snapshot 可完整 round-trip", () => {
  const initial = seed();
  const legacy = hydrateStateRow({
    character_id: initial.character.id,
    revision: "0",
    snapshot: { activity: initial.activity, character: initial.character, exploration: initial.exploration },
  });
  assert.equal(legacy.combat, null);
  const started = requireStarted(startCombat(
    initial, { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("tie"),
  )).state;
  const hydrated = hydrateStateRow({
    character_id: started.character.id,
    revision: String(started.revision),
    snapshot: {
      activity: started.activity,
      character: started.character,
      exploration: started.exploration,
      combat: started.combat,
    },
  });
  assert.deepEqual(hydrated, started);
});

test("Combat start / advance 實作不依賴 interpretation、narration 或 LLM", async () => {
  for (const file of [
    "../src/domain/combat.ts",
    "../src/domain/combat-state.ts",
    "../src/server/combat/service.ts",
  ]) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /from\s+["'][^"']*(interpretation|narration|\/llm\/)/i);
  }
});

test("PostgreSQL JSONB 可在新 repository instance 恢復 active combat 與目前 Turn", {
  skip: !process.env.TEST_DATABASE_URL && "需提供隔離的 TEST_DATABASE_URL，並先執行 migration。",
}, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 3 });
  const id = `TEST-${randomUUID()}`;
  try {
    const session = createPersistedDomainSession(new PostgresGameStateRepository(pool), seed(id));
    const started = await session.startCombat(
      { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"),
    );
    assert.equal(started.ok, true);
    const advanced = await session.advanceCombat({ expectedRevision: 1 });
    assert.equal(advanced.ok, true);
    const restarted = new PostgresGameStateRepository(pool);
    const loaded = await restarted.load(id);
    assert.equal(loaded?.revision, 2);
    assert.equal(loaded?.activity, "in-combat");
    assert.equal(loaded?.combat?.round, 1);
    assert.equal(loaded?.combat?.currentTurnIndex, 1);
    assert.equal(loaded?.combat?.currentActorId, "TEST-player");
    assert.deepEqual(loaded?.combat?.turnOrder, ["TEST-enemy-1", "TEST-player", "TEST-enemy-2"]);
  } finally {
    await pool.query("DELETE FROM game_states WHERE character_id = $1", [id]).catch(() => undefined);
    await pool.end();
  }
});
