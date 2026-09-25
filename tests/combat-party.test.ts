import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import pg from "pg";
import {
  advanceCombatTurn,
  runFromCombat,
  startCasting,
  startCombat,
} from "../src/domain/combat.js";
import { createGameState, type GameState } from "../src/domain/game.js";
import { createTestCombatInventory } from "../src/domain/combat-items.js";
import { getCombatPartyOptions, setCompanionTacticPreference } from "../src/domain/party.js";
import { createLegacyPartyMembers } from "../src/domain/party-tactics.js";
import { buildApp } from "../src/server/app.js";
import { createCombatEscapeFixtureRoller, createCombatFixtureRoller } from "../src/server/combat/dice.js";
import { TEST_COMBAT_PARTICIPANTS } from "../src/server/combat/fixtures.js";
import { createDomainSession, createPersistedDomainSession } from "../src/server/domain-session.js";
import { hydrateStateRow, PostgresGameStateRepository } from "../src/server/postgres-game-state-repository.js";
import { isCombatPartyOptionsResponse, isCompanionTacticPreferenceResponse } from "../src/shared/game-state.js";
import { CombatPage } from "../src/web/CombatPage.js";
import { CombatPartyDialog } from "../src/web/CombatPartyDialog.js";
import { loadCombatPartyOptions, setCombatCompanionTacticPreference } from "../src/web/api.js";

function seed(characterId = "TEST-character", withCastingSkill = false): GameState {
  return createGameState({
    revision: 0,
    activity: "outside-combat",
    character: {
      id: characterId,
      learnedActiveSkillIds: withCastingSkill ? ["TEST-skill-2"] : [],
      equippedSkillIds: withCastingSkill ? ["TEST-skill-2"] : [],
      currentMp: 24,
      raceId: characterId === "TEST-character" ? "dragonborn" : null,
      dragonBreathElement: characterId === "TEST-character" ? "fire" : null,
    },
    inventory: createTestCombatInventory(),
    partyMembers: createLegacyPartyMembers(characterId),
    exploration: { locationId: "TEST-forest-edge", lastObservationTargetId: null },
    combat: null,
  });
}

function requireOk<T extends { readonly ok: boolean }>(result: T): asserts result is Extract<T, { readonly ok: true }> {
  assert.equal(result.ok, true);
}

function activeCombat(initial = seed()): GameState {
  const result = startCombat(initial, { expectedRevision: initial.revision }, TEST_COMBAT_PARTICIPANTS,
    createCombatFixtureRoller("normal"));
  requireOk(result);
  return result.state;
}

function partyView(state: GameState, context: "outside-combat" | "active-combat" | "ended-combat" = "active-combat") {
  const companion = state.partyMembers[0];
  assert.ok(companion);
  return {
    revision: state.revision,
    context,
    canChangeTacticPreference: context === "active-combat",
    companions: [{
      id: companion.id, displayName: companion.displayName, level: null, row: null,
      hp: null, mp: null, tacticPreferenceId: companion.tacticPreferenceId,
    }],
    tacticPreferences: getCombatPartyOptions(state).tacticPreferences,
  };
}

test("Party options 是伺服器推導唯讀資料，顯示明確的權威資料缺口", () => {
  const initial = activeCombat();
  const session = createDomainSession(initial);
  const before = session.getState();
  const options = session.partyOptions();
  assert.equal(isCombatPartyOptionsResponse(options), true);
  assert.equal(options.revision, before.revision);
  assert.equal(options.context, "active-combat");
  assert.equal(options.canChangeTacticPreference, true);
  assert.equal(options.companions[0]?.id, "TEST-companion-1");
  assert.equal(options.companions[0]?.level, null);
  assert.equal(options.companions[0]?.row, null);
  assert.equal(options.companions[0]?.hp, null);
  assert.equal(options.companions[0]?.mp, null);
  assert.deepEqual(session.getState(), before);
  assert.deepEqual(initial.combat?.turnOrder, ["TEST-enemy-1", "TEST-player", "TEST-enemy-2"]);
  assert.ok(!initial.combat?.turnOrder.includes("TEST-companion-1"));
});

test("偏好變更只更新偏好與 revision，回合及所有 combat facts 原樣保留", () => {
  const before = activeCombat();
  const result = setCompanionTacticPreference(before, {
    expectedRevision: before.revision,
    companionId: "TEST-companion-1",
    tacticPreferenceId: "TEST-tactic-b",
  });
  requireOk(result);
  assert.equal(result.state.revision, before.revision + 1);
  assert.equal(result.state.partyMembers[0]?.tacticPreferenceId, "TEST-tactic-b");
  assert.deepEqual(result.state.combat, before.combat);
  assert.deepEqual(result.state.character, before.character);
  assert.deepEqual(result.state.inventory, before.inventory);
  assert.deepEqual(result.effect, {
    type: "tactic-preference-updated", companionId: "TEST-companion-1", tacticPreferenceId: "TEST-tactic-b",
  });
  assert.equal(result.state.combat?.currentActorId, "TEST-enemy-1");
  assert.equal(result.state.combat?.currentTurnIndex, 0);
  assert.equal(result.state.combat?.round, 1);
  assert.equal(result.state.combat?.lastAction, null);
});

test("敵方回合可更改偏好，敵方仍是目前行動者", () => {
  const before = activeCombat();
  assert.equal(before.combat?.currentActorId, "TEST-enemy-1");
  const result = setCompanionTacticPreference(before, {
    expectedRevision: before.revision, companionId: "TEST-companion-1", tacticPreferenceId: "TEST-tactic-b",
  });
  requireOk(result);
  assert.equal(result.state.revision, 2);
  assert.equal(result.state.combat?.currentActorId, "TEST-enemy-1");
  assert.equal(result.state.combat?.currentTurnIndex, 0);
  assert.equal(result.state.combat?.round, 1);
});

test("active casting 期間可更改偏好，詠唱、MP 與目前 actor 不變", () => {
  let state = activeCombat(seed("TEST-character", true));
  let advanced = advanceCombatTurn(state, { expectedRevision: state.revision });
  requireOk(advanced);
  state = advanced.state;
  const started = startCasting(state, { expectedRevision: state.revision, skillId: "TEST-skill-2" });
  requireOk(started);
  state = started.state;
  for (let i = 0; i < 2; i += 1) {
    const next = advanceCombatTurn(state, { expectedRevision: state.revision });
    requireOk(next);
    state = next.state;
  }
  assert.equal(state.combat?.currentActorId, "TEST-player");
  assert.equal(state.combat?.activeCastings[0]?.completedCastingTurns, 1);
  const beforeMp = state.character.currentMp;
  const beforeCombat = state.combat;
  const result = setCompanionTacticPreference(state, {
    expectedRevision: state.revision, companionId: "TEST-companion-1", tacticPreferenceId: "TEST-tactic-b",
  });
  requireOk(result);
  assert.equal(result.state.revision, state.revision + 1);
  assert.equal(result.state.character.currentMp, beforeMp);
  assert.deepEqual(result.state.combat, beforeCombat);
  assert.equal(result.state.combat?.currentActorId, "TEST-player");
});

test("同一偏好選擇是無 revision 的 idempotent no-op", () => {
  const before = activeCombat();
  const result = setCompanionTacticPreference(before, {
    expectedRevision: before.revision, companionId: "TEST-companion-1", tacticPreferenceId: "TEST-tactic-a",
  });
  requireOk(result);
  assert.equal(result.state, before);
  assert.equal(result.state.revision, before.revision);
  assert.equal(result.effect.type, "tactic-preference-unchanged");
});

test("嚴格驗證 stale revision、不明隊友、不明偏好與注入欄位，全部拒絕且不改 state", async (t) => {
  const session = createDomainSession(seed());
  const app = await buildApp({ domainSession: session, combatSandbox: true, combatRoller: createCombatFixtureRoller("normal") });
  t.after(() => app.close());
  const started = await app.inject({ method: "POST", url: "/api/dev/combat/start", payload: { expectedRevision: 0 } });
  assert.equal(started.statusCode, 200);
  const before = session.getState();
  const cases = [
    [{ expectedRevision: before.revision - 1, companionId: "TEST-companion-1", tacticPreferenceId: "TEST-tactic-b" }, "stale-revision"],
    [{ expectedRevision: before.revision, companionId: "UNKNOWN-companion", tacticPreferenceId: "TEST-tactic-b" }, "companion-not-found"],
    [{ expectedRevision: before.revision, companionId: "TEST-companion-1", tacticPreferenceId: "UNKNOWN-tactic" }, "tactic-preference-not-found"],
    [{ expectedRevision: before.revision, companionId: "TEST-companion-1", tacticPreferenceId: "TEST-tactic-b", hp: 9999 }, "invalid-command"],
    [{ expectedRevision: before.revision, companionId: "TEST-companion-1", tacticPreferenceId: "TEST-tactic-b", currentMp: 9999, row: "front", nextAction: "attack", targetId: "TEST-enemy-1" }, "invalid-command"],
  ] as const;
  for (const [payload, code] of cases) {
    const response = await app.inject({ method: "POST", url: "/api/combat/party/tactic", payload });
    assert.equal(response.json().error, code);
    assert.equal(response.statusCode, code === "invalid-command" ? 400 : code === "companion-not-found" || code === "tactic-preference-not-found" ? 404 : 409);
    assert.deepEqual(session.getState(), before);
  }
});

test("GET Party options 不改狀態； ended combat 保持可讀且偏好唯讀", async (t) => {
  const session = createDomainSession(seed());
  const app = await buildApp({ domainSession: session, combatSandbox: true,
    combatRoller: createCombatFixtureRoller("normal"), combatEscapeRoller: createCombatEscapeFixtureRoller("success") });
  t.after(() => app.close());
  await app.inject({ method: "POST", url: "/api/dev/combat/start", payload: { expectedRevision: 0 } });
  const readBefore = session.getState();
  const read = await app.inject("/api/combat/party");
  assert.equal(read.statusCode, 200);
  assert.equal(read.headers["cache-control"], "no-store");
  assert.equal(isCombatPartyOptionsResponse(read.json()), true);
  assert.deepEqual(session.getState(), readBefore);

  const toPlayer = await app.inject({ method: "POST", url: "/api/dev/combat/advance", payload: { expectedRevision: 1 } });
  assert.equal(toPlayer.statusCode, 200);
  const ended = await app.inject({ method: "POST", url: "/api/combat/run", payload: { expectedRevision: 2 } });
  assert.equal(ended.statusCode, 200);
  const afterEnd = session.getState();
  const endedParty = await app.inject("/api/combat/party");
  assert.equal(endedParty.statusCode, 200);
  assert.equal(endedParty.json().context, "ended-combat");
  assert.equal(endedParty.json().canChangeTacticPreference, false);
  const rejected = await app.inject({ method: "POST", url: "/api/combat/party/tactic", payload: {
    expectedRevision: afterEnd.revision, companionId: "TEST-companion-1", tacticPreferenceId: "TEST-tactic-b",
  } });
  assert.equal(rejected.statusCode, 409);
  assert.equal(rejected.json().error, "combat-ended");
  assert.deepEqual(session.getState(), afterEnd);
  assert.equal(session.getState().combat?.status, "ended");
});

test("Memory API 設定偏好後再次 GET，偏好保存且 combat snapshot 不變", async (t) => {
  const session = createDomainSession(seed());
  const app = await buildApp({ domainSession: session, combatSandbox: true,
    combatRoller: createCombatFixtureRoller("normal") });
  t.after(() => app.close());
  const started = await app.inject({ method: "POST", url: "/api/dev/combat/start", payload: { expectedRevision: 0 } });
  assert.equal(started.statusCode, 200);
  const beforeResponse = await app.inject("/api/game-state");
  const before = beforeResponse.json().state;
  const opened = await app.inject("/api/combat/party");
  assert.equal(opened.statusCode, 200);
  assert.equal(opened.json().revision, before.revision);
  assert.deepEqual(session.getState(), before);

  const changed = await app.inject({ method: "POST", url: "/api/combat/party/tactic", payload: {
    expectedRevision: before.revision, companionId: "TEST-companion-1", tacticPreferenceId: "TEST-tactic-b",
  } });
  assert.equal(changed.statusCode, 200);
  assert.equal(changed.json().state.revision, before.revision + 1);
  const refreshedState = await app.inject("/api/game-state");
  const refreshedParty = await app.inject("/api/combat/party");
  assert.equal(refreshedState.json().state.partyMembers[0].tacticPreferenceId, "TEST-tactic-b");
  assert.equal(refreshedParty.json().companions[0].tacticPreferenceId, "TEST-tactic-b");
  assert.deepEqual(refreshedState.json().state.combat, before.combat);
  assert.equal(refreshedState.json().state.revision, before.revision + 1);
});

test("舊 Phase 1–20 snapshot 只替 TEST 隊友補工程偏好；正式角色不補選項", () => {
  const legacyTest = seed();
  const hydratedTest = createGameState({
    revision: legacyTest.revision, activity: legacyTest.activity, character: legacyTest.character,
    inventory: legacyTest.inventory, exploration: legacyTest.exploration, combat: legacyTest.combat,
  });
  assert.deepEqual(hydratedTest.partyMembers, [{
    id: "TEST-companion-1", displayName: "TEST 隊友", tacticPreferenceId: "TEST-tactic-a",
  }]);

  const { partyMembers: _legacyParty, ...legacyBase } = legacyTest;
  const formal = createGameState({ ...legacyBase, character: {
    ...legacyTest.character, id: "PLAYER-1", raceId: null, dragonBreathElement: null,
  } });
  assert.deepEqual(formal.partyMembers, []);
  const unknownPreference = createGameState({ ...legacyTest, partyMembers: [
    { id: "COMPANION-1", displayName: "同行者", tacticPreferenceId: "legacy-static-id" },
  ] });
  assert.equal(unknownPreference.partyMembers[0]?.tacticPreferenceId, "legacy-static-id");
});

test("PostgreSQL 舊 snapshot hydrate 時補 TEST fixture，不替正式角色指定偏好", () => {
  const legacyTest = seed();
  const snapshotWithoutParty = {
    activity: legacyTest.activity,
    character: legacyTest.character,
    inventory: legacyTest.inventory,
    exploration: legacyTest.exploration,
    combat: legacyTest.combat,
  };
  const hydratedTest = hydrateStateRow({
    character_id: "TEST-character", revision: String(legacyTest.revision), snapshot: snapshotWithoutParty,
  });
  assert.equal(hydratedTest.partyMembers[0]?.id, "TEST-companion-1");
  assert.equal(hydratedTest.partyMembers[0]?.tacticPreferenceId, "TEST-tactic-a");

  const formal = createGameState({ ...legacyTest, character: {
    ...legacyTest.character, id: "PLAYER-1", raceId: null, dragonBreathElement: null,
  } });
  const hydratedFormal = hydrateStateRow({
    character_id: "PLAYER-1",
    revision: String(formal.revision),
    snapshot: {
      activity: formal.activity,
      character: formal.character,
      inventory: formal.inventory,
      exploration: formal.exploration,
      combat: formal.combat,
    },
  });
  assert.deepEqual(hydratedFormal.partyMembers, []);
});

test("Party UI 提供 modal、可及標籤與真實缺口文字，不捏造數值或固定選項", async () => {
  const state = activeCombat();
  const markup = renderToStaticMarkup(createElement(CombatPage, {
    gameState: { sandbox: true, storage: "memory", state }, stateError: null,
    onStateUpdate: () => undefined, onRetryState: async () => ({ sandbox: true, storage: "memory" as const, state }),
  }));
  assert.match(markup, /data-command="party"/);
  assert.match(markup, /aria-expanded="false"/);

  const dialog = renderToStaticMarkup(createElement(CombatPartyDialog, {
    open: false,
    party: partyView(state), loading: false, error: null, busy: false, status: "",
    onClose: () => undefined, onClosed: () => undefined, onRetry: () => undefined, onPreferenceChange: () => undefined,
  }));
  for (const text of ["role=\"dialog\"", "aria-labelledby=\"combat-party-heading\"", "TEST 隊友", "等級", "尚未接入權威隊伍站位", "尚未接入權威戰鬥狀態", "戰術偏好", "TEST：戰術偏好 A", "工程測試選項"]) {
    assert.ok(dialog.includes(text), `Party UI 缺少 ${text}`);
  }
  assert.doesNotMatch(dialog, /100\s*\/\s*100/);
  assert.doesNotMatch(await readFile(new URL("../src/web/CombatPartyDialog.tsx", import.meta.url), "utf8"), /TEST-tactic-a|TEST-tactic-b/);
});

test("前端 Party API 只送最小偏好 body，並驗證 server-derived 選項與 mutation", async () => {
  const options = partyView(activeCombat());
  const loaded = await loadCombatPartyOptions(async (url, init) => {
    assert.equal(url, "/api/combat/party");
    assert.equal(init?.cache, "no-store");
    return Response.json(options);
  });
  assert.equal(loaded.revision, options.revision);

  const before = activeCombat();
  const result = setCompanionTacticPreference(before, {
    expectedRevision: before.revision, companionId: "TEST-companion-1", tacticPreferenceId: "TEST-tactic-b",
  });
  requireOk(result);
  const body = { sandbox: true, storage: "memory", effect: result.effect, state: result.state };
  assert.equal(isCompanionTacticPreferenceResponse(body), true);
  const response = await setCombatCompanionTacticPreference(before.revision, "TEST-companion-1", "TEST-tactic-b",
    async (url, init) => {
      assert.equal(url, "/api/combat/party/tactic");
      assert.equal(init?.body, JSON.stringify({ expectedRevision: before.revision, companionId: "TEST-companion-1", tacticPreferenceId: "TEST-tactic-b" }));
      return Response.json(body);
    });
  assert.equal(response.state.revision, before.revision + 1);
});

test("PostgreSQL Party preference survives a new API session and pool", {
  skip: !process.env.TEST_DATABASE_URL && "需明確提供隔離的 TEST_DATABASE_URL，並先執行 migration。",
}, async () => {
  const characterId = `TEST-phase21-${randomUUID()}`;
  const initial = createGameState({
    ...seed(characterId),
    partyMembers: [{ id: "TEST-companion-1", displayName: "TEST 隊友", tacticPreferenceId: "TEST-tactic-a" }],
  });
  const poolA = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 2 });
  const repositoryA = new PostgresGameStateRepository(poolA);
  const sessionA = createPersistedDomainSession(repositoryA, initial);
  const appA = await buildApp({ domainSession: sessionA, storage: "postgres", combatSandbox: true,
    combatRoller: createCombatFixtureRoller("normal") });
  let poolB: pg.Pool | undefined;
  let appB: Awaited<ReturnType<typeof buildApp>> | undefined;
  let appAClosed = false;
  let poolAClosed = false;
  try {
    const started = await appA.inject({ method: "POST", url: "/api/dev/combat/start", payload: { expectedRevision: 0 } });
    assert.equal(started.statusCode, 200);
    const options = await appA.inject("/api/combat/party");
    assert.equal(options.statusCode, 200);
    const changed = await appA.inject({ method: "POST", url: "/api/combat/party/tactic", payload: {
      expectedRevision: 1, companionId: "TEST-companion-1", tacticPreferenceId: "TEST-tactic-b",
    } });
    assert.equal(changed.statusCode, 200);
    assert.equal(changed.json().state.revision, 2);
    const saved = changed.json().state;

    await appA.close();
    appAClosed = true;
    await poolA.end();
    poolAClosed = true;
    poolB = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 2 });
    const repositoryB = new PostgresGameStateRepository(poolB);
    const sessionB = createPersistedDomainSession(repositoryB, initial);
    appB = await buildApp({ domainSession: sessionB, storage: "postgres", combatSandbox: true,
      combatRoller: createCombatFixtureRoller("normal") });
    const stateResponse = await appB.inject("/api/game-state");
    assert.equal(stateResponse.statusCode, 200);
    const reloaded = stateResponse.json().state;
    assert.equal(reloaded.revision, saved.revision);
    assert.equal(reloaded.combat.round, saved.combat.round);
    assert.equal(reloaded.combat.currentActorId, saved.combat.currentActorId);
    assert.equal(reloaded.combat.currentTurnIndex, saved.combat.currentTurnIndex);
    assert.equal(reloaded.partyMembers[0].tacticPreferenceId, "TEST-tactic-b");
    assert.deepEqual(reloaded.combat, saved.combat);
    const partyAfterRestart = await appB.inject("/api/combat/party");
    assert.equal(partyAfterRestart.json().companions[0].tacticPreferenceId, "TEST-tactic-b");
  } finally {
    if (!appAClosed) await appA.close();
    if (appB) await appB.close();
    try {
      if (poolB) await poolB.query("DELETE FROM game_states WHERE character_id = $1", [characterId]);
      else if (!poolAClosed) await poolA.query("DELETE FROM game_states WHERE character_id = $1", [characterId]);
    } catch { /* 保留原始測試結果；資料列使用隨機識別碼。 */ }
    if (poolB) await poolB.end();
    try { await poolA.end(); } catch { /* Pool may already be closed. */ }
  }
});
