import {createTestGameState as fullTestState} from "../src/server/test-game-state.js";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { applyCommand, createGameState, type GameState } from "./helpers/phase26-fixture.js";
import type { GameStateRepository } from "../src/domain/game-state-repository.js";
import { advanceCombatTurn, cancelCasting, continueCasting, defendCombatTurn, moveCombatRow,
  resolveCompanionTurn, resolveNormalAttack, runFromCombat, startCasting, startCombat, useCombatItem,
  useDragonBreath, usePhysicalSkill } from "../src/domain/combat.js";
import { setCompanionTacticPreference } from "../src/domain/party.js";
import { createLegacyPartyMembers } from "../src/domain/party-tactics.js";
import { TEST_COMBAT_CONSUMABLE_ID } from "../src/domain/combat-items.js";
import { buildApp } from "./helpers/phase26-fixture.js";
import { createCombatFixtureRoller, createPhase22CombatFixtureRoller, SequenceD20Roller } from "../src/server/combat/dice.js";
import { PHASE22_TEST_COMBAT_PARTICIPANTS, TEST_COMBAT_PARTICIPANTS } from "../src/server/combat/fixtures.js";
import { buildCombatNarrationFacts, buildCombatNarrationFallback, createCombatNarrationService,
  type CombatNarrationFacts } from "../src/server/combat/narration.js";
import { FixtureCombatNarrationAdapter } from "../src/server/combat/narration-fixture-adapter.js";
import { createDomainSession, createPersistedDomainSession } from "../src/server/domain-session.js";
import { createLanguageModel } from "../src/server/llm/language-model.js";
import type { GenerateRequest, LanguageModel } from "../src/server/llm/contracts.js";
import { PostgresGameStateRepository } from "../src/server/postgres-game-state-repository.js";
import { createTestGameState } from "./helpers/phase26-fixture.js";
import { isCombatNormalAttackResponse } from "../src/shared/game-state.js";
import { CombatPage } from "../src/web/CombatPage.js";

function ok<T extends { readonly ok: boolean }>(result: T): asserts result is Extract<T, { ok: true }> {
  assert.equal(result.ok, true);
}
function player(initial = createTestGameState(), participants = TEST_COMBAT_PARTICIPANTS): GameState {
  const started = startCombat(initial, { expectedRevision: initial.revision }, participants,
    (participants.some(p=>p.controlledBy === "companion") ? createPhase22CombatFixtureRoller("normal") : createCombatFixtureRoller("normal"))); ok(started);
  const advanced = advanceCombatTurn(started.state, { expectedRevision: started.state.revision }); ok(advanced);
  return advanced.state;
}
function nextPlayer(state: GameState) {
  let next = state;
  for (let i = 0; i < 2; i += 1) {
    const advanced = advanceCombatTurn(next, { expectedRevision: next.revision }); ok(advanced); next = advanced.state;
  }
  return next;
}
function equipped(skillId: string) {
  const changed = applyCommand(createTestGameState(), { type: "set-equipped-skills", expectedRevision: 0,
    skillIds: [skillId] }); ok(changed); return changed.state;
}
function fixture(mode: "normal" | "unavailable" | "timeout" | "malformed" = "normal") {
  return createCombatNarrationService(createLanguageModel(new FixtureCombatNarrationAdapter(mode), { timeoutMs: 15 }));
}
function plain(facts: CombatNarrationFacts) {
  return JSON.parse(JSON.stringify(facts)) as unknown;
}
function assertNoUnconfirmedMechanics(facts: CombatNarrationFacts) {
  assert.doesNotMatch(JSON.stringify(Object.keys(facts)), /damage|hp|mp|revision|currentActor|inventory|tacticPreference/i);
  assert.doesNotMatch(buildCombatNarrationFallback(facts), /傷害|受傷|血量|死亡|恢復|減傷|灼傷/);
}

test("HIT／MISS facts 只用 lastAction actor；模型在提交之後呼叫一次", async () => {
  for (const [rolls, outcome] of [[[10, 8], "hit"], [[2, 18], "miss"]] as const) {
    const initial = player();
    let stored = initial;
    let saves = 0;
    const repository: GameStateRepository = {
      async load() { return stored; }, async createIfAbsent() { return stored; },
      async saveIfRevision(expectedRevision, next) {
        assert.equal(expectedRevision, stored.revision); saves += 1; stored = next; return true;
      },
    };
    const calls: GenerateRequest[] = [];
    const model: LanguageModel = { async generateText(request) {
      assert.equal(saves, 1);
      assert.equal(stored.revision, initial.revision + 1);
      calls.push(request);
      const facts = (JSON.parse(request.input) as { data: CombatNarrationFacts }).data;
      return { text: JSON.stringify({ text: buildCombatNarrationFallback(facts) }) };
    } };
    const session = createPersistedDomainSession(repository, initial);
    const app = await buildApp({ domainSession: session, combatNarrator: createCombatNarrationService(model),
      combatActionRoller: new SequenceD20Roller([...rolls]) });
    try {
      const response = await app.inject({ method: "POST", url: "/api/combat/normal-attack",
        payload: { expectedRevision: initial.revision, targetId: "TEST-enemy-1" } });
      assert.equal(response.statusCode, 200);
      assert.equal(isCombatNormalAttackResponse(response.json()), true);
      assert.equal(response.json().narration.source, "model");
      assert.equal(response.json().state.combat.currentActorId, "TEST-enemy-2");
      assert.equal(calls.length, 1);
      const request = calls[0]!;
      assert.match(request.instruction ?? "", /資料/);
      const facts = (JSON.parse(request.input) as { data: CombatNarrationFacts }).data;
      assert.deepEqual(plain(facts), { round: 1, actorName: "TEST 玩家", kind: "normal-attack",
        targetName: "TEST 敵人 1", outcome });
      assertNoUnconfirmedMechanics(facts);
      assert.match(response.json().narration.text, outcome === "hit" ? /命中/ : /沒有命中/);
      assert.equal(saves, 1);
    } finally { await app.close(); }
  }
});

test("所有已存在的戰鬥行動映射為最少事實，備援不虛構效果", () => {
  const ready = player();
  const attack = resolveNormalAttack(ready, { expectedRevision: ready.revision, targetId: "TEST-enemy-1" },
    new SequenceD20Roller([10, 8])); ok(attack);
  const defend = defendCombatTurn(ready, { expectedRevision: ready.revision }); ok(defend);
  const move = moveCombatRow(ready, { expectedRevision: ready.revision, targetRow: "back" }); ok(move);
  const item = useCombatItem(ready, { expectedRevision: ready.revision, itemId: TEST_COMBAT_CONSUMABLE_ID }); ok(item);
  const runSuccess = runFromCombat(ready, { expectedRevision: ready.revision }, new SequenceD20Roller([20])); ok(runSuccess);
  const runFailure = runFromCombat(ready, { expectedRevision: ready.revision }, new SequenceD20Roller([1])); ok(runFailure);
  const skillReady = player(equipped("TEST-skill-1"));
  const skill = usePhysicalSkill(skillReady, { expectedRevision: skillReady.revision,
    skillId: "TEST-skill-1", targetId: "TEST-enemy-1" }, new SequenceD20Roller([2, 18])); ok(skill);
  const twoFront = TEST_COMBAT_PARTICIPANTS.map((entry) => entry.id === "TEST-enemy-2"
    ? { ...entry, row: "front" as const } : entry);
  const breathReady = player(createTestGameState(), twoFront);
  const breath = useDragonBreath(breathReady, { expectedRevision: breathReady.revision, targetRow: "front" },
    new SequenceD20Roller([19, 8, 2, 18])); ok(breath);
  const facts = [defend, move, item, runSuccess, runFailure, skill, breath].map((result) =>
    buildCombatNarrationFacts(result.state));
  assert.deepEqual(facts.map((entry) => entry.kind), ["defend", "row-move", "item-use", "run", "run",
    "physical-skill", "dragon-breath"]);
  assert.deepEqual(plain(facts[1]!), { round: 1, actorName: "TEST 玩家", kind: "row-move",
    fromRow: "front", toRow: "back" });
  assert.match(buildCombatNarrationFallback(facts[0]!), /防禦行動/);
  assert.match(buildCombatNarrationFallback(facts[2]!), /使用了TEST/);
  assert.match(buildCombatNarrationFallback(facts[3]!), /成功脫離戰鬥/);
  assert.match(buildCombatNarrationFallback(facts[4]!), /未能成功逃離/);
  assert.equal((facts[5] as { outcome: string }).outcome, "miss");
  assert.deepEqual(plain(facts[6]!), { round: 1, actorName: "TEST 玩家", kind: "dragon-breath",
    element: "fire", targetRow: "front", targets: [
      { targetName: "TEST 敵人 1", outcome: "hit", critical: true },
      { targetName: "TEST 敵人 2", outcome: "miss", critical: false },
    ] });
  for (const entry of facts) assertNoUnconfirmedMechanics(entry);
});

test("龍息敘事逐目標清楚標示命中、暴擊與閃避，且不改動權威戰鬥狀態", async () => {
  const twoFront = TEST_COMBAT_PARTICIPANTS.map((entry) => entry.id === "TEST-enemy-2"
    ? { ...entry, row: "front" as const } : entry);
  const ready = player(createTestGameState(), twoFront);
  const rolls = [19, 8, 2, 18] as const;
  const expected = useDragonBreath(ready, { expectedRevision: ready.revision, targetRow: "front" },
    new SequenceD20Roller([...rolls])); ok(expected);
  const facts = buildCombatNarrationFacts(expected.state);
  assert.deepEqual(plain(facts), { round: 1, actorName: "TEST 玩家", kind: "dragon-breath",
    element: "fire", targetRow: "front", targets: [
      { targetName: "TEST 敵人 1", outcome: "hit", critical: true },
      { targetName: "TEST 敵人 2", outcome: "miss", critical: false },
    ] });

  const fallbackText = buildCombatNarrationFallback(facts);
  assert.match(fallbackText, /TEST 敵人 1被火焰龍息命中/u);
  assert.match(fallbackText, /TEST 敵人 1[^。；]*暴擊/u);
  assert.match(fallbackText, /TEST 敵人 2[^。；]*(?:避開|未被命中)/u);
  assert.doesNotMatch(fallbackText, /TEST 敵人 1命中/u);
  const fake = await fixture().narrate(facts);
  assert.equal(fake.source, "model");
  assert.match(fake.text, /TEST 敵人 1被火焰龍息命中/u);
  assert.match(fake.text, /TEST 敵人 1[^。；]*暴擊/u);
  assert.match(fake.text, /TEST 敵人 2[^。；]*(?:避開|未被命中)/u);
  assert.doesNotMatch(fake.text, /TEST 敵人 1命中/u);
  assertNoUnconfirmedMechanics(facts);

  for (const text of [
    "TEST 玩家在敵方前排施放火焰龍息；TEST 敵人 1被火焰龍息命中，似乎是暴擊；TEST 敵人 2避開了火焰龍息。",
    "TEST 玩家在敵方前排施放火焰龍息；TEST 敵人 1被火焰龍息命中，本次判定為暴擊；TEST 敵人 2避開了火焰龍息，並格外精準。",
  ]) {
    const untrusted: LanguageModel = { async generateText() { return { text: JSON.stringify({ text }) }; } };
    const result = await createCombatNarrationService(untrusted).narrate(facts);
    assert.equal(result.source, "fallback");
    assert.match(result.text, /TEST 敵人 1[^。；]*本次判定為暴擊/u);
  }

  let request: GenerateRequest | undefined;
  const model: LanguageModel = { async generateText(value) {
    request = value;
    return { text: JSON.stringify({ text:
      "TEST 玩家向敵方前排施放龍息；TEST 敵人 1命中（暴擊），TEST 敵人 2未命中。" }) };
  } };
  const session = createDomainSession(ready);
  const app = await buildApp({ domainSession: session, combatNarrator: createCombatNarrationService(model),
    combatActionRoller: new SequenceD20Roller([...rolls]) });
  try {
    const response = await app.inject({ method: "POST", url: "/api/combat/dragon-breath",
      payload: { expectedRevision: ready.revision, targetRow: "front" } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().narration.source, "fallback");
    const text = response.json().narration.text as string;
    assert.match(text, /TEST 敵人 1被火焰龍息命中/u);
    assert.match(text, /TEST 敵人 1[^。；]*暴擊/u);
    assert.match(text, /TEST 敵人 2[^。；]*(?:避開|未被命中)/u);
    assert.doesNotMatch(text, /TEST 敵人 1命中/u);
    assert.match(request?.instruction ?? "", /<targetName>被<元素龍息>命中/u);
    assert.match(request?.instruction ?? "", /<targetName>避開了<元素龍息>/u);

    const state = response.json().state as GameState;
    assert.deepEqual(state, expected.state);
    assert.deepEqual(await session.getState(), expected.state);
    assert.equal(state.revision, ready.revision + 1);
    assert.equal(state.combat?.round, expected.state.combat?.round);
    assert.equal(state.combat?.currentTurnIndex, expected.state.combat?.currentTurnIndex);
    assert.equal(state.combat?.currentActorId, expected.state.combat?.currentActorId);
    assert.deepEqual(state.combat?.racialAbilityCooldowns, expected.state.combat?.racialAbilityCooldowns);
  } finally { await app.close(); }
});

test("詠唱 start、continue、complete、cancel 的進度與法術效果分離", () => {
  const ready = player(equipped("TEST-skill-2"));
  const started = startCasting(ready, { expectedRevision: ready.revision, skillId: "TEST-skill-2" }); ok(started);
  const second = nextPlayer(started.state);
  const continued = continueCasting(second, { expectedRevision: second.revision }); ok(continued);
  const third = nextPlayer(continued.state);
  const completed = continueCasting(third, { expectedRevision: third.revision }); ok(completed);
  const cancelled = cancelCasting(second, { expectedRevision: second.revision }); ok(cancelled);
  const facts = [started, continued, completed, cancelled].map((result) => buildCombatNarrationFacts(result.state));
  assert.deepEqual(facts.map((entry) => [entry.kind, "progress" in entry ? entry.progress : null]), [
    ["casting-start", 1], ["casting-continue", 2], ["casting-complete", 3], ["casting-cancel", 1],
  ]);
  assert.match(buildCombatNarrationFallback(facts[2]!), /詠唱/);
  for (const entry of facts) assertNoUnconfirmedMechanics(entry);
});

test("同伴 A 攻擊與 B 防禦只收到 policy 已選的結果", () => {
  const started = startCombat(fullTestState(), { expectedRevision: 0 },
    PHASE22_TEST_COMBAT_PARTICIPANTS, createPhase22CombatFixtureRoller("normal")); ok(started);
  let state = started.state;
  while (state.combat?.status === "active" && state.combat.currentActorId !== "TEST-companion-1") {
    const next = advanceCombatTurn(state, { expectedRevision: state.revision }); ok(next); state = next.state;
  }
  const attacked = resolveCompanionTurn(state, { expectedRevision: state.revision }, new SequenceD20Roller([10, 8])); ok(attacked);
  const a = buildCombatNarrationFacts(attacked.state);
  assert.deepEqual(plain(a), { round: 1, actorName: "TEST 隊友", kind: "normal-attack",
    targetName: "TEST 敵人 1", outcome: "hit" });
  const changed = setCompanionTacticPreference(state, { expectedRevision: state.revision,
    companionId: "TEST-companion-1", tacticPreferenceId: "TEST-tactic-b" }); ok(changed);
  const defended = resolveCompanionTurn(changed.state, { expectedRevision: changed.state.revision },
    new SequenceD20Roller([])); ok(defended);
  const b = buildCombatNarrationFacts(defended.state);
  assert.deepEqual(plain(b), { round: 1, actorName: "TEST 隊友", kind: "defend" });
  assertNoUnconfirmedMechanics(a); assertNoUnconfirmedMechanics(b);
});

test("每個正式 action route 成功後都只送一次已確認事實，並保持 revision +1", async () => {
  const ready = player();
  const skillReady = player(equipped("TEST-skill-1"));
  const magicReady = player(equipped("TEST-skill-2"));
  const cast1 = startCasting(magicReady, { expectedRevision: magicReady.revision, skillId: "TEST-skill-2" }); ok(cast1);
  const magicRound2 = nextPlayer(cast1.state);
  const cast2 = continueCasting(magicRound2, { expectedRevision: magicRound2.revision }); ok(cast2);
  const magicRound3 = nextPlayer(cast2.state);
  const twoFront = TEST_COMBAT_PARTICIPANTS.map((entry) => entry.id === "TEST-enemy-2"
    ? { ...entry, row: "front" as const } : entry);
  const cases: readonly { state: GameState; url: string; payload: Record<string, unknown>;
    kind: CombatNarrationFacts["kind"]; rolls?: readonly number[]; escapeRolls?: readonly number[] }[] = [
    { state: ready, url: "/api/combat/row-move", payload: { targetRow: "back" }, kind: "row-move" },
    { state: ready, url: "/api/combat/items/use", payload: { itemId: TEST_COMBAT_CONSUMABLE_ID }, kind: "item-use" },
    { state: ready, url: "/api/combat/defend", payload: {}, kind: "defend" },
    { state: ready, url: "/api/combat/run", payload: {}, kind: "run", escapeRolls: [20] },
    { state: ready, url: "/api/combat/run", payload: {}, kind: "run", escapeRolls: [1] },
    { state: skillReady, url: "/api/combat/physical-skills/use",
      payload: { skillId: "TEST-skill-1", targetId: "TEST-enemy-1" }, kind: "physical-skill", rolls: [10, 8] },
    { state: magicReady, url: "/api/combat/casting/start", payload: { skillId: "TEST-skill-2" }, kind: "casting-start" },
    { state: magicRound2, url: "/api/combat/casting/continue", payload: {}, kind: "casting-continue" },
    { state: magicRound3, url: "/api/combat/casting/continue", payload: {}, kind: "casting-complete" },
    { state: magicRound2, url: "/api/combat/casting/cancel", payload: {}, kind: "casting-cancel" },
    { state: player(createTestGameState(), twoFront), url: "/api/combat/dragon-breath",
      payload: { targetRow: "front" }, kind: "dragon-breath", rolls: [10, 8, 2, 18] },
  ];
  for (const scenario of cases) {
    const requests: GenerateRequest[] = [];
    const model: LanguageModel = { async generateText(request) {
      requests.push(request);
      const facts = (JSON.parse(request.input) as { data: CombatNarrationFacts }).data;
      return { text: JSON.stringify({ text: buildCombatNarrationFallback(facts) }) };
    } };
    const app = await buildApp({ domainSession: createDomainSession(scenario.state),
      combatNarrator: createCombatNarrationService(model),
      combatActionRoller: new SequenceD20Roller([...(scenario.rolls ?? [])]),
      combatEscapeRoller: new SequenceD20Roller([...(scenario.escapeRolls ?? [])]) });
    try {
      const response = await app.inject({ method: "POST", url: scenario.url,
        payload: { expectedRevision: scenario.state.revision, ...scenario.payload } });
      assert.equal(response.statusCode, 200, `${scenario.url}: ${response.body}`);
      assert.equal(response.json().state.revision, scenario.state.revision + 1);
      assert.equal(response.json().narration.source, "model");
      assert.equal(requests.length, 1);
      const facts = (JSON.parse(requests[0]!.input) as { data: CombatNarrationFacts }).data;
      assert.equal(facts.kind, scenario.kind);
      assert.deepEqual(plain(facts), plain(buildCombatNarrationFacts(response.json().state)));
      assertNoUnconfirmedMechanics(facts);
    } finally { await app.close(); }
  }
});

test("拒絕、GET、TEST advance 與 tactic 設定不呼叫模型", async () => {
  let calls = 0;
  const model: LanguageModel = { async generateText() { calls += 1; return { text: "{}" }; } };
  const ready = player(fullTestState(),PHASE22_TEST_COMBAT_PARTICIPANTS);
  const session = createDomainSession(ready);
  const app = await buildApp({ domainSession: session, domainSandbox: true, combatSandbox: true,
    combatNarrator: createCombatNarrationService(model), combatActionRoller: new SequenceD20Roller([10, 8]) });
  try {
    const requests = [
      { url: "/api/combat/normal-attack", payload: { expectedRevision: ready.revision - 1, targetId: "TEST-enemy-1" } },
      { url: "/api/combat/normal-attack", payload: { expectedRevision: ready.revision, targetId: "TEST-enemy-2" } },
      { url: "/api/combat/normal-attack", payload: { expectedRevision: ready.revision, targetId: "TEST-enemy-1", hp: 0 } },
      { url: "/api/combat/defend", payload: { expectedRevision: ready.revision, actorId: "TEST-enemy-1" } },
    ];
    for (const request of requests) assert.notEqual((await app.inject({ method: "POST", ...request })).statusCode, 200);
    await app.inject({ method: "GET", url: "/api/game-state" });
    await app.inject({ method: "GET", url: "/api/combat/normal-attack/options" });
    await app.inject({ method: "GET", url: "/api/combat/party" });
    const tactic = await app.inject({ method: "POST", url: "/api/combat/party/tactic", payload: {
      expectedRevision: ready.revision, companionId: "TEST-companion-1", tacticPreferenceId: "TEST-tactic-b",
    } });
    assert.equal(tactic.statusCode, 200);
    const advanced = await app.inject({ method: "POST", url: "/api/dev/combat/advance",
      payload: { expectedRevision: ready.revision + 1 } });
    assert.equal(advanced.statusCode, 200);
    assert.equal(calls, 0);
  } finally { await app.close(); }
  const started = startCombat(createTestGameState(), { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS,
    createCombatFixtureRoller("normal")); ok(started);
  const enemyTurnApp = await buildApp({ domainSession: createDomainSession(started.state),
    combatNarrator: createCombatNarrationService(model) });
  try {
    const wrongActor = await enemyTurnApp.inject({ method: "POST", url: "/api/combat/normal-attack",
      payload: { expectedRevision: started.state.revision, targetId: "TEST-enemy-1" } });
    assert.equal(wrongActor.statusCode, 409);
    assert.equal(calls, 0);
  } finally { await enemyTurnApp.close(); }
});

test("repository save 失敗不敘事；模型失敗、逾時、格式錯誤仍回成功且只提交一次", async () => {
  const ready = player();
  for (const mode of ["unavailable", "timeout", "malformed"] as const) {
    const session = createDomainSession(ready);
    const app = await buildApp({ domainSession: session, combatNarrator: fixture(mode),
      combatActionRoller: new SequenceD20Roller([10, 8]) });
    try {
      const response = await app.inject({ method: "POST", url: "/api/combat/normal-attack",
        payload: { expectedRevision: ready.revision, targetId: "TEST-enemy-1" } });
      assert.equal(response.statusCode, 200);
      assert.equal(response.json().narration.source, "fallback");
      assert.equal(session.getState().revision, ready.revision + 1);
      assert.equal(response.json().state.combat.currentActorId, "TEST-enemy-2");
    } finally { await app.close(); }
  }
  let calls = 0;
  const repository: GameStateRepository = {
    async load() { return ready; }, async createIfAbsent() { return ready; },
    async saveIfRevision() { throw new Error("TEST save failed"); },
  };
  const model: LanguageModel = { async generateText() { calls += 1; return { text: "{}" }; } };
  const app = await buildApp({ domainSession: createPersistedDomainSession(repository, ready),
    combatNarrator: createCombatNarrationService(model), combatActionRoller: new SequenceD20Roller([10, 8]) });
  try {
    const response = await app.inject({ method: "POST", url: "/api/combat/normal-attack",
      payload: { expectedRevision: ready.revision, targetId: "TEST-enemy-1" } });
    assert.equal(response.statusCode, 500);
    assert.equal(calls, 0);
  } finally { await app.close(); }
  const throwingSession = createDomainSession(ready);
  const throwingApp = await buildApp({ domainSession: throwingSession,
    combatNarrator: { async narrate() { throw new Error("TEST narrator failure"); } },
    combatActionRoller: new SequenceD20Roller([10, 8]) });
  try {
    const response = await throwingApp.inject({ method: "POST", url: "/api/combat/normal-attack",
      payload: { expectedRevision: ready.revision, targetId: "TEST-enemy-1" } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().narration.source, "fallback");
    assert.equal(throwingSession.getState().revision, ready.revision + 1);
  } finally { await throwingApp.close(); }
});

test("模型 output exact schema、非空與語意禁語；失敗全部落回事實備援", async () => {
  const ready = player();
  const action = resolveNormalAttack(ready, { expectedRevision: ready.revision, targetId: "TEST-enemy-1" },
    new SequenceD20Roller([10, 8])); ok(action);
  const facts = buildCombatNarrationFacts(action.state);
  for (const raw of ["not-json", JSON.stringify({ text: "" }),
    JSON.stringify({ text: "TEST 玩家攻擊 TEST 敵人 1，攻擊命中。", hp: 0, revision: 999 }),
    JSON.stringify({ text: "TEST 玩家攻擊 TEST 敵人 1，造成傷害並死亡。" }),
    JSON.stringify({ text: "TEST 玩家攻擊 TEST 敵人 1，但沒有命中。" }),
  ]) {
    const model: LanguageModel = { async generateText() { return { text: raw }; } };
    const result = await createCombatNarrationService(model).narrate(facts);
    assert.equal(result.source, "fallback");
  }
  const normal = await fixture().narrate(facts);
  assert.equal(normal.source, "model");
  assertNoUnconfirmedMechanics(facts);
});

test("畫面保留系統裁定，敘事區初始不重叫模型且可由鍵盤讀取", () => {
  const state = player();
  const html = renderToStaticMarkup(createElement(CombatPage, { gameState: { sandbox: true,
    storage: "memory", state }, stateError: null, onStateUpdate: () => undefined,
  onRetryState: async () => ({ sandbox: true, storage: "memory" as const, state }) }));
  assert.match(html, /AI 戰鬥敘事/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /目前沒有戰鬥敘事/);
  assert.match(html, /最近裁定/);
});

test("PostgreSQL 已提交的戰鬥在模型故障後可由新 session 讀回，無敘事 snapshot", {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  const id = `TEST-phase23-${randomUUID()}`;
  const base = createTestGameState();
  const seed = player(createGameState({ ...base, character: { ...base.character, id },
    partyMembers: createLegacyPartyMembers("TEST-character") }), PHASE22_TEST_COMBAT_PARTICIPANTS);
  const poolA = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 2 });
  let poolB: pg.Pool | undefined;
  try {
    const sessionA = createPersistedDomainSession(new PostgresGameStateRepository(poolA), seed);
    const app = await buildApp({ domainSession: sessionA, combatNarrator: fixture("unavailable"),
      combatActionRoller: new SequenceD20Roller([10, 8]), storage: "postgres" });
    let saved: GameState;
    try {
      const response = await app.inject({ method: "POST", url: "/api/combat/normal-attack",
        payload: { expectedRevision: seed.revision, targetId: "TEST-enemy-1" } });
      assert.equal(response.statusCode, 200);
      assert.equal(response.json().narration.source, "fallback");
      saved = await sessionA.getState();
    } finally { await app.close(); }
    await poolA.end();
    poolB = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 2 });
    const sessionB = createPersistedDomainSession(new PostgresGameStateRepository(poolB), seed);
    assert.deepEqual(await sessionB.getState(), saved!);
    assert.equal(saved!.revision, seed.revision + 1);
    assert.equal(saved!.combat?.lastAction?.type, "normal-attack");
    assert.equal(saved!.combat?.currentActorId, "TEST-enemy-2");
    const raw = await poolB.query("SELECT snapshot FROM game_states WHERE character_id = $1", [id]);
    assert.equal(Object.hasOwn(raw.rows[0]?.snapshot ?? {}, "narration"), false);
  } finally {
    if (poolB) { await poolB.query("DELETE FROM game_states WHERE character_id = $1", [id]); await poolB.end(); }
    else await poolA.end().catch(() => {});
  }
});
