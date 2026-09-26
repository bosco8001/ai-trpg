import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { buildApp } from "../src/server/app.js";
import { applyCombatDamage, advanceCombatTurn, processDyingTurn, rescueCombatant,
  resolveCompanionTurn, startCasting, startCombat } from "../src/domain/combat.js";
import { createCombatState } from "../src/domain/combat-state.js";
import { isCombatHealth } from "../src/domain/combat-health.js";
import { createGameState, type GameState } from "../src/domain/game.js";
import { checkNormalAttackTarget } from "../src/domain/combat-targeting.js";
import { PHASE22_TEST_COMBAT_PARTICIPANTS, TEST_COMBAT_PARTICIPANTS } from "../src/server/combat/fixtures.js";
import { createPhase22CombatFixtureRoller } from "../src/server/combat/dice.js";
import { SequenceD20Roller } from "../src/server/combat/dice.js";
import { createTestGameState } from "../src/server/test-game-state.js";
import { createDomainSession, createPersistedDomainSession } from "../src/server/domain-session.js";
import { hydrateStateRow, InvalidPersistedStateError, PostgresGameStateRepository } from "../src/server/postgres-game-state-repository.js";
import { buildLifeEventNarrationFacts, buildCombatNarrationFallback, createCombatNarrationService } from "../src/server/combat/narration.js";
import { isCombatLifeResponse, isCombatStateView } from "../src/shared/game-state.js";

function ok<T extends { ok: boolean }>(result: T): asserts result is Extract<T, { ok: true }> {
  assert.equal(result.ok, true, JSON.stringify(result));
}
function battle(withCompanion = true): GameState {
  const result = startCombat(createTestGameState(), { expectedRevision: 0 },
    withCompanion ? PHASE22_TEST_COMBAT_PARTICIPANTS : TEST_COMBAT_PARTICIPANTS,
    createPhase22CombatFixtureRoller("normal"));
  ok(result);
  return result.state;
}
function actor(state: GameState, id: string): GameState {
  const combat = state.combat!;
  const currentTurnIndex = combat.turnOrder.indexOf(id);
  assert.notEqual(currentTurnIndex, -1);
  return createGameState({ ...state, combat: createCombatState({ ...combat, currentTurnIndex, currentActorId: id }) });
}
function health(state: GameState, id: string) {
  return state.combat!.participants.find((entry) => entry.id === id)!.health;
}
function damage(state: GameState, id: string, amount: number) {
  const result = applyCombatDamage(state, { expectedRevision: state.revision, targetId: id, amount });
  ok(result); return result;
}

test("combat health accepts only exact active, dying and dead invariants", () => {
  const base = { maxHp: 10, currentHp: 10, lifeState: "active", dyingTurnsRemaining: null };
  for (const value of [base, { ...base, currentHp: 0, lifeState: "dying", dyingTurnsRemaining: 2 },
    { ...base, currentHp: 0, lifeState: "dying", dyingTurnsRemaining: 1 },
    { ...base, currentHp: 0, lifeState: "dead" }]) assert.equal(isCombatHealth(value), true);
  for (const value of [{ ...base, currentHp: 0 }, { ...base, dyingTurnsRemaining: 2 },
    { ...base, lifeState: "dying" }, { ...base, currentHp: 1, lifeState: "dying", dyingTurnsRemaining: 2 },
    { ...base, currentHp: 0, lifeState: "dying" }, { ...base, currentHp: 0, lifeState: "dead", dyingTurnsRemaining: 1 },
    { ...base, currentHp: -1 }, { ...base, currentHp: 11 }, { ...base, maxHp: 0 }])
    assert.equal(isCombatHealth(value), false, JSON.stringify(value));
});

test("damage clamps HP, keeps Turn and action, rejects invalid or inactive targets", () => {
  const initial = battle();
  assert.deepEqual([health(initial, "TEST-player").currentHp, health(initial, "TEST-companion-1").currentHp,
    health(initial, "TEST-enemy-1").currentHp], [10, 8, 6]);
  const first = damage(initial, "TEST-companion-1", 3);
  assert.deepEqual([health(first.state, "TEST-companion-1").currentHp, first.state.revision,
    first.state.combat?.currentActorId, first.state.combat?.lastAction], [5, 2, initial.combat?.currentActorId, null]);
  const lethal = damage(first.state, "TEST-companion-1", 999);
  assert.deepEqual(health(lethal.state, "TEST-companion-1"), { maxHp: 8, currentHp: 0,
    lifeState: "dying", dyingTurnsRemaining: 2 });
  assert.deepEqual(lethal.state.combat?.skillCooldowns, first.state.combat?.skillCooldowns);
  assert.deepEqual(lethal.state.combat?.racialAbilityCooldowns, first.state.combat?.racialAbilityCooldowns);
  for (const amount of [0, -1, 0.5]) {
    const rejected = applyCombatDamage(initial, { expectedRevision: initial.revision, targetId: "TEST-player", amount });
    assert.equal(rejected.ok, false); if (!rejected.ok) assert.equal(rejected.code, "invalid-command");
  }
  assert.equal(applyCombatDamage(lethal.state, { expectedRevision: lethal.state.revision,
    targetId: "TEST-companion-1", amount: 1 }).ok, false);
  assert.equal(applyCombatDamage(lethal.state, { expectedRevision: initial.revision,
    targetId: "TEST-player", amount: 1 }).ok, false);
});

test("dying actor counts only own Turn, skips once, preserves lastAction and dies on second Turn", () => {
  const fallen = damage(battle(), "TEST-companion-1", 99).state;
  const first = processDyingTurn(actor(fallen, "TEST-companion-1"), { expectedRevision: fallen.revision });
  ok(first);
  assert.deepEqual([first.state.revision, health(first.state, "TEST-companion-1").dyingTurnsRemaining,
    first.state.combat?.lastAction], [fallen.revision + 1, 1, null]);
  const second = processDyingTurn(actor(first.state, "TEST-companion-1"), { expectedRevision: first.state.revision });
  ok(second);
  assert.deepEqual([second.state.revision, health(second.state, "TEST-companion-1").lifeState,
    second.state.combat?.currentActorId === "TEST-companion-1"], [first.state.revision + 1, "dead", false]);
  assert.equal(second.event.remaining, 0);
  assert.equal(isCombatStateView(second.state.combat), true);
});

test("Rescue is one action: cross-row, HP 1, unchanged cooldown, no bonus Turn", () => {
  const fallen = damage(battle(), "TEST-companion-1", 8).state;
  const player = actor(fallen, "TEST-player");
  const rescued = rescueCombatant(player, { expectedRevision: player.revision, targetId: "TEST-companion-1" });
  ok(rescued);
  assert.deepEqual([rescued.state.revision, health(rescued.state, "TEST-companion-1"),
    rescued.state.combat?.lastAction?.type], [player.revision + 1,
    { maxHp: 8, currentHp: 1, lifeState: "active", dyingTurnsRemaining: null }, "rescue"]);
  assert.equal(rescued.state.combat?.participants.find((entry) => entry.id === "TEST-companion-1")?.row, "back");
  assert.deepEqual(rescued.state.combat?.skillCooldowns, player.combat?.skillCooldowns);
  assert.notEqual(rescued.state.combat?.currentActorId, "TEST-player");
  for (const targetId of ["TEST-player", "TEST-enemy-1", "TEST-enemy-2"]) {
    const rejected = rescueCombatant(player, { expectedRevision: player.revision, targetId });
    assert.equal(rejected.ok, false);
  }
  assert.equal(rescueCombatant(rescued.state, { expectedRevision: player.revision,
    targetId: "TEST-companion-1" }).ok, false);
});

test("companion Rescue overrides tactic and prioritizes urgency over Player; tie favors Player", () => {
  const state = battle();
  const playerDying = damage(state, "TEST-player", 20).state;
  const companion = actor(playerDying, "TEST-companion-1");
  const result = resolveCompanionTurn(companion, { expectedRevision: companion.revision }, { d20: () => {
    throw new Error("Rescue must not roll");
  } });
  ok(result);
  assert.equal(result.effect.selectedAction, "rescue");
  assert.equal(result.state.combat?.lastAction?.type, "rescue");
  assert.equal(health(result.state, "TEST-player").currentHp, 1);
});

test("companion chooses lower countdown before Player and turnOrder breaks companion ties", () => {
  const initial = createTestGameState();
  const extra = [2, 3].map((number) => ({
    id: `TEST-companion-${number}`, displayName: `TEST 隊友 ${number}`, side: "party" as const,
    row: "back" as const, dexterityModifier: 0, controlledBy: "companion" as const,
    normalAttack: { range: "melee" as const, perceptionModifier: 1, weaponMainStatModifier: 1, proficiencyModifier: 0 },
    health: { maxHp: 8, currentHp: 8, lifeState: "active" as const, dyingTurnsRemaining: null },
  }));
  const seed = createGameState({ ...initial, partyMembers: [...initial.partyMembers,
    ...extra.map((entry) => ({ id: entry.id, displayName: entry.displayName, tacticPreferenceId: "TEST-tactic-b" }))] });
  const started = startCombat(seed, { expectedRevision: 0 }, [...PHASE22_TEST_COMBAT_PARTICIPANTS, ...extra],
    new SequenceD20Roller([12, 17, 8, 4, 3, 2]));
  ok(started);
  let state = damage(started.state, "TEST-player", 10).state;
  state = damage(state, "TEST-companion-2", 8).state;
  state = damage(state, "TEST-companion-3", 8).state;
  const combat = state.combat!;
  state = createGameState({ ...state, combat: createCombatState({ ...combat,
    participants: combat.participants.map((entry) => entry.id === "TEST-companion-2"
      ? { ...entry, health: { ...entry.health, dyingTurnsRemaining: 1 } } : entry) }) });
  const urgent = resolveCompanionTurn(actor(state, "TEST-companion-1"), { expectedRevision: state.revision },
    { d20: () => { throw new Error("no roll"); } });
  ok(urgent);
  assert.equal(urgent.state.combat?.lastAction?.type, "rescue");
  if (urgent.state.combat?.lastAction?.type === "rescue") assert.equal(urgent.state.combat.lastAction.targetId, "TEST-companion-2");
  const tie = resolveCompanionTurn(actor(damage(battle(), "TEST-player", 10).state, "TEST-companion-1"),
    { expectedRevision: 2 }, { d20: () => { throw new Error("no roll"); } });
  ok(tie);
  if (tie.state.combat?.lastAction?.type === "rescue") assert.equal(tie.state.combat.lastAction.targetId, "TEST-player");
});

test("lethal damage interrupts casting without MP refund; Rescue leaves cooldowns intact", () => {
  const started = battle();
  const equipped = createGameState({ ...started, character: { ...started.character,
    equippedSkillIds: ["TEST-skill-2"] } });
  const casting = startCasting(actor(equipped, "TEST-player"), { expectedRevision: 1, skillId: "TEST-skill-2" });
  ok(casting);
  assert.equal(casting.state.character.currentMp, 18);
  const fallen = damage(casting.state, "TEST-player", 10);
  assert.equal(fallen.state.combat?.activeCastings.length, 0);
  assert.equal(fallen.state.character.currentMp, 18);
  assert.equal(fallen.state.combat?.lastAction?.type, "casting-start");
  assert.equal(isCombatStateView(fallen.state.combat), true);
  const rescued = resolveCompanionTurn(actor(fallen.state, "TEST-companion-1"),
    { expectedRevision: fallen.state.revision }, { d20: () => { throw new Error("no roll"); } });
  ok(rescued);
  assert.equal(rescued.state.combat?.activeCastings.length, 0);
  assert.equal(rescued.state.character.currentMp, 18);
});

test("enemy death skips current actor, front-row blocking clears, final enemy yields victory", () => {
  const start = actor(battle(), "TEST-enemy-1");
  const player = start.combat!.participants.find((entry) => entry.id === "TEST-player")!;
  const enemyAttacker = start.combat!.participants.find((entry) => entry.id === "TEST-enemy-2")!;
  assert.equal(checkNormalAttackTarget(start.combat!, player, "TEST-enemy-2", "melee").legal, false);
  assert.equal(checkNormalAttackTarget(start.combat!, enemyAttacker, "TEST-companion-1", "melee").legal, false);
  const dyingFront = damage(start, "TEST-player", 10).state.combat!;
  assert.equal(checkNormalAttackTarget(dyingFront, enemyAttacker, "TEST-companion-1", "melee").legal, true);
  const first = damage(start, "TEST-enemy-1", 50);
  assert.equal(health(first.state, "TEST-enemy-1").lifeState, "dead");
  assert.notEqual(first.state.combat?.currentActorId, "TEST-enemy-1");
  assert.equal(checkNormalAttackTarget(first.state.combat!, player, "TEST-enemy-2", "melee").legal, true);
  const second = damage(first.state, "TEST-enemy-2", 50);
  assert.deepEqual([second.state.combat?.status, second.state.combat?.endReason], ["ended", "victory"]);
  assert.equal(applyCombatDamage(second.state, { expectedRevision: second.state.revision,
    targetId: "TEST-player", amount: 1 }).ok, false);
});

test("no active Party and solo Player dying end combat while preserving dying health", () => {
  const playerDying = damage(battle(false), "TEST-player", 20);
  assert.deepEqual([playerDying.state.combat?.status, playerDying.state.combat?.endReason,
    health(playerDying.state, "TEST-player").lifeState,
    health(playerDying.state, "TEST-player").dyingTurnsRemaining], ["ended", "party-defeat", "dying", 2]);
  assert.equal(processDyingTurn(playerDying.state, { expectedRevision: playerDying.state.revision }).ok, false);
  const withCompanion = damage(battle(), "TEST-player", 20);
  assert.equal(withCompanion.state.combat?.status, "active");
  const both = damage(withCompanion.state, "TEST-companion-1", 20);
  assert.deepEqual([both.state.combat?.status, both.state.combat?.endReason], ["ended", "party-defeat"]);
});

test("Player death defeats Party despite active Companion; victory freezes companion dying", () => {
  const fallen = damage(battle(), "TEST-player", 10).state;
  const combat = fallen.combat!;
  const one = createGameState({ ...fallen, combat: createCombatState({ ...combat,
    participants: combat.participants.map((entry) => entry.id === "TEST-player"
      ? { ...entry, health: { ...entry.health, dyingTurnsRemaining: 1 } } : entry) }) });
  const died = processDyingTurn(actor(one, "TEST-player"), { expectedRevision: one.revision });
  ok(died);
  assert.deepEqual([died.state.combat?.status, died.state.combat?.endReason,
    health(died.state, "TEST-companion-1").lifeState], ["ended", "party-defeat", "active"]);
  const companionDown = damage(battle(), "TEST-companion-1", 8).state;
  const enemyOne = damage(companionDown, "TEST-enemy-1", 6).state;
  const won = damage(enemyOne, "TEST-enemy-2", 6).state;
  assert.deepEqual([won.combat?.endReason, health(won, "TEST-companion-1").dyingTurnsRemaining], ["victory", 2]);
  assert.equal(rescueCombatant(won, { expectedRevision: won.revision, targetId: "TEST-companion-1" }).ok, false);
});

test("simultaneous Party defeat and final Enemy death accepts only party-defeat", () => {
  const source = battle();
  const participants = source.combat!.participants.map((entry) => ({ ...entry, health: entry.side === "enemy"
    ? { ...entry.health, currentHp: 0, lifeState: "dead" as const, dyingTurnsRemaining: null }
    : { ...entry.health, currentHp: 0, lifeState: "dying" as const, dyingTurnsRemaining: 2 as const } }));
  assert.equal(createCombatState({ ...source.combat!, participants, status: "ended", endReason: "party-defeat",
    currentTurnIndex: null, currentActorId: null }).endReason, "party-defeat");
  assert.throws(() => createCombatState({ ...source.combat!, participants, status: "ended", endReason: "victory",
    currentTurnIndex: null, currentActorId: null }));
});

test("TEST damage endpoint requires both sandboxes, exact body, active target and expected revision", async () => {
  const session = createDomainSession(createTestGameState());
  const app = await buildApp({ domainSession: session, domainSandbox: true, combatSandbox: true,
    combatRoller: createPhase22CombatFixtureRoller("normal") });
  try {
    const start = await app.inject({ method: "POST", url: "/api/dev/combat/start", payload: { expectedRevision: 0 } });
    assert.equal(start.statusCode, 200);
    const payload = { expectedRevision: 1, targetId: "TEST-companion-1", amount: 8 };
    const response = await app.inject({ method: "POST", url: "/api/dev/combat/apply-damage", payload });
    assert.equal(response.statusCode, 200);
    assert.equal(isCombatLifeResponse(response.json()), true);
    assert.equal(response.json().state.revision, 2);
    assert.equal(response.json().state.combat.lastAction, null);
    assert.equal(response.json().state.combat.currentActorId, start.json().state.combat.currentActorId);
    for (const bad of [{ ...payload, expectedRevision: 1 }, { ...payload, expectedRevision: 2 },
      { ...payload, expectedRevision: 2, hp: 99 }, { ...payload, expectedRevision: 2, lifeState: "dead" }]) {
      const rejected = await app.inject({ method: "POST", url: "/api/dev/combat/apply-damage", payload: bad });
      assert.notEqual(rejected.statusCode, 200);
    }
    assert.equal(session.getState().revision, 2);
  } finally { await app.close(); }
  const blocked = await buildApp({ domainSandbox: false, combatSandbox: true });
  try { assert.equal((await blocked.inject({ method: "POST", url: "/api/dev/combat/apply-damage",
    payload: { expectedRevision: 0, targetId: "TEST-player", amount: 1 } })).statusCode, 404); }
  finally { await blocked.close(); }
});

test("dying route skips without narration; companion Rescue narrates after its committed action", async () => {
  let narrationCalls = 0;
  const session = createDomainSession(createTestGameState());
  const app = await buildApp({ domainSession: session, domainSandbox: true, combatSandbox: true,
    combatRoller: createPhase22CombatFixtureRoller("normal"), combatNarrator: {
      async narrate(facts) { narrationCalls += 1; return { text: buildCombatNarrationFallback(facts), source: "fallback" }; },
    } });
  try {
    const post = (url: string, payload: object) => app.inject({ method: "POST", url, payload });
    assert.equal((await post("/api/dev/combat/start", { expectedRevision: 0 })).statusCode, 200);
    assert.equal((await post("/api/dev/combat/apply-damage", {
      expectedRevision: 1, targetId: "TEST-player", amount: 10,
    })).statusCode, 200);
    assert.equal(narrationCalls, 0);
    assert.equal((await post("/api/dev/combat/advance", { expectedRevision: 2 })).statusCode, 200);
    const counted = await post("/api/combat/dying-turn", { expectedRevision: 3 });
    assert.equal(counted.statusCode, 200);
    assert.equal(counted.json().event.remaining, 1);
    assert.equal(counted.json().narration, undefined);
    assert.equal(narrationCalls, 0);
    assert.equal((await post("/api/dev/combat/advance", { expectedRevision: 4 })).statusCode, 200);
    const rescued = await post("/api/combat/companion/act", { expectedRevision: 5 });
    assert.equal(rescued.statusCode, 200);
    assert.equal(rescued.json().effect.selectedAction, "rescue");
    assert.equal(rescued.json().state.combat.lastAction.type, "rescue");
    assert.equal(rescued.json().state.combat.participants.find((entry: { id: string }) => entry.id === "TEST-player").health.currentHp, 1);
    assert.equal(narrationCalls, 1);
    assert.equal((await post("/api/combat/companion/act", { expectedRevision: 5 })).statusCode, 409);
    assert.equal(narrationCalls, 1);
  } finally { await app.close(); }
});

test("life narration receives committed facts; malformed model falls back without state rollback", async () => {
  const rescued = rescueCombatant(actor(damage(battle(), "TEST-companion-1", 20).state, "TEST-player"),
    { expectedRevision: 2, targetId: "TEST-companion-1" });
  ok(rescued);
  const facts = buildLifeEventNarrationFacts(rescued.state, rescued.event);
  assert.match(buildCombatNarrationFallback(facts), /救助.*1 HP/);
  const service = createCombatNarrationService({ generateText: async () => ({ text: JSON.stringify({ text: "骨折並大量失血。" }) }) });
  const narration = await service.narrate(facts);
  assert.equal(narration.source, "fallback");
  assert.equal(rescued.state.revision, 3);
});

test("JSONB snapshot round-trip retains health; known TEST backfills, unknown legacy rejects", () => {
  const state = damage(battle(), "TEST-companion-1", 8).state;
  const snapshot = { activity: state.activity, character: state.character, inventory: state.inventory,
    partyMembers: state.partyMembers, exploration: state.exploration, combat: state.combat };
  const row = { character_id: state.character.id, revision: String(state.revision), snapshot };
  assert.deepEqual(health(hydrateStateRow(row), "TEST-companion-1"), health(state, "TEST-companion-1"));
  const legacy = structuredClone(snapshot);
  for (const participant of legacy.combat!.participants as any[]) delete participant.health;
  assert.equal(health(hydrateStateRow({ ...row, snapshot: legacy }), "TEST-player").currentHp, 10);
  (legacy.combat!.participants.find((entry) => entry.id === "TEST-player") as any).row = "back";
  assert.equal(hydrateStateRow({ ...row, snapshot: legacy }).combat?.participants.find((entry) =>
    entry.id === "TEST-player")?.row, "back");
  (legacy.combat!.participants[0] as any).id = "UNKNOWN-1";
  assert.throws(() => hydrateStateRow({ ...row, snapshot: legacy }), InvalidPersistedStateError);
});

test("PostgreSQL keeps HP and Rescue across repository restart; concurrent same-revision Rescue commits once", {
  skip: !process.env.TEST_DATABASE_URL && "需提供隔離的 TEST_DATABASE_URL 並先執行既有 migration。",
}, async () => {
  const id = `TEST-phase25-${randomUUID()}`;
  const initial = createGameState({ ...createTestGameState(), character: {
    ...createTestGameState().character, id,
  } });
  const poolA = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 2 });
  const poolB = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 2 });
  try {
    const first = createPersistedDomainSession(new PostgresGameStateRepository(poolA), initial);
    const started = await first.startCombat({ expectedRevision: 0 }, PHASE22_TEST_COMBAT_PARTICIPANTS,
      createPhase22CombatFixtureRoller("normal"));
    ok(started);
    const damaged = await first.applyCombatDamage({ expectedRevision: 1, targetId: "TEST-companion-1", amount: 8 });
    ok(damaged);
    assert.equal(damaged.state.revision, 2);
    const restarted = createPersistedDomainSession(new PostgresGameStateRepository(poolB), initial);
    const loaded = await restarted.getState();
    assert.deepEqual(health(loaded, "TEST-companion-1"), health(damaged.state, "TEST-companion-1"));
    const enemy = await restarted.advanceCombat({ expectedRevision: 2 });
    ok(enemy);
    assert.equal(enemy.state.combat?.currentActorId, "TEST-player");
    const [a, b] = await Promise.all([
      first.rescueCombatant({ expectedRevision: 3, targetId: "TEST-companion-1" }),
      restarted.rescueCombatant({ expectedRevision: 3, targetId: "TEST-companion-1" }),
    ]);
    assert.equal([a, b].filter((entry) => entry.ok).length, 1);
    assert.equal([a, b].filter((entry) => !entry.ok).length, 1);
    const after = await new PostgresGameStateRepository(poolB).load(id);
    assert.equal(after?.revision, 4);
    assert.equal(after && health(after, "TEST-companion-1").currentHp, 1);
    assert.equal(after?.combat?.lastAction?.type, "rescue");
  } finally { await poolA.end(); await poolB.end(); }
});
