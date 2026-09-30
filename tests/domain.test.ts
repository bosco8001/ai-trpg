import assert from "node:assert/strict";
import test from "node:test";
import { applyCommand, createGameState } from "./helpers/phase26-fixture.js";
import type { GameState } from "./helpers/phase26-fixture.js";
import { startCombat } from "../src/domain/combat.js";
import { createDomainSession } from "../src/server/domain-session.js";
import { buildApp } from "../src/server/app.js";
import { createTestCombatInventory } from "../src/domain/combat-items.js";
import { createLegacyPartyMembers } from "../src/domain/party-tactics.js";

const learned = Array.from({ length: 7 }, (_, i) => `TEST-skill-${i + 1}`);
const seed = (): GameState => ({
  revision: 0, activity: "outside-combat",
  character: { id: "TEST-character", learnedActiveSkillIds: [...learned], equippedSkillIds: [], currentMp: 24,
    raceId: "dragonborn", dragonBreathElement: "fire" },
  inventory: createTestCombatInventory(),
  partyMembers: createLegacyPartyMembers("TEST-character"),
  exploration: { locationId: "TEST-forest-edge", lastObservationTargetId: null },
  combat: null,
});
const command = (skillIds: readonly string[], expectedRevision = 0) => ({
  type: "set-equipped-skills", expectedRevision, skillIds,
});

test("六格配置更新版本、保留七個已學技能；輸入與舊快照不變", () => {
  const initial = seed();
  const session = createDomainSession(initial);
  const old = session.getState();
  const selected = learned.slice(0, 6);
  const result = session.execute(command(selected));
  assert.equal(result.ok, true);
  selected.pop();
  assert.equal(session.getState().character.equippedSkillIds.length, 6);
  assert.equal(session.getState().character.learnedActiveSkillIds.length, 7);
  assert.equal(session.getState().revision, 1);
  assert.deepEqual(old, createGameState(initial));
  assert.equal(old.character.equippedSkillIds.length, 0);
  assert.throws(() => Object.assign(session.getState().character.equippedSkillIds, { 0: "tampered" }));
  assert.equal(session.execute(command([], 1)).ok, true);
  assert.equal(session.getState().character.equippedSkillIds.length, 0);
});

test("不合法技能選擇與過期版本不改動任何狀態", () => {
  const session = createDomainSession(seed());
  for (const [input, expected] of [
    [command(learned), "too-many-skills"],
    [command(["TEST-skill-1", "TEST-skill-1"]), "duplicate-skill"],
    [command(["unlearned"]), "skill-not-learned"],
    [command([], 1), "stale-revision"],
  ] as const) {
    const before = session.getState();
    const result = session.execute(input);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, expected);
    assert.equal(session.getState(), before);
  }
});

test("runtime boundary 拒絕直接狀態寫入、額外欄位與隱式型別轉換", () => {
  const session = createDomainSession(seed());
  for (const input of [
    null, [], {}, { type: "set-hp", hp: 999 },
    { ...command([]), hp: 999 }, { ...command([]), mp: 999 },
    { ...command([]), activity: "outside-combat" },
    { ...command([]), expectedRevision: "0" },
    command([], -1), command([], 0.5), command([], NaN),
    { ...command([]), skillIds: [1] }, command([""]), command([" TEST-skill-1"]),
  ]) {
    const before = session.getState();
    const result = session.execute(input);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "invalid-command");
    assert.equal(session.getState(), before);
  }
});

test("戰鬥標記只作命令守門，不允許更換配置", () => {
  const started = startCombat(createGameState({...seed(),partyMembers:[]}), { expectedRevision: 0 }, [
    { id: "TEST-player", displayName: "TEST 玩家", side: "party", row: "front", dexterityModifier: 0, normalAttack: null },
    { id: "TEST-enemy-1", displayName: "TEST 敵人 1", side: "enemy", row: "front", dexterityModifier: -1, normalAttack: null },
  ], { d20: () => 10 });
  assert.equal(started.ok, true);
  if (!started.ok) return;
  const result = applyCommand(started.state, command(["TEST-skill-1"], 1));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "in-combat");
  assert.deepEqual(started.state.character.equippedSkillIds, []);
});

test("初始狀態拒絕不一致配置，且不保留外部可變參照", () => {
  const initial = seed();
  const state = createGameState(initial);
  Object.assign(initial.character.learnedActiveSkillIds, { 0: "changed" });
  assert.equal(state.character.learnedActiveSkillIds[0], "TEST-skill-1");
  assert.throws(() => createGameState({ ...seed(), revision: -1 }));
  for (const equippedSkillIds of [learned, ["unknown"], ["TEST-skill-1", "TEST-skill-1"]]) {
    assert.throws(() => createGameState({ ...seed(), character: { ...seed().character, equippedSkillIds } }));
  }
});

test("同版本連續命令只有第一個生效，版本不溢位", () => {
  const session = createDomainSession(seed());
  assert.equal(session.execute(command(["TEST-skill-1"])).ok, true);
  assert.equal(session.execute(command(["TEST-skill-2"])).ok, false);
  assert.deepEqual(session.getState().character.equippedSkillIds, ["TEST-skill-1"]);
  const result = applyCommand(createGameState({ ...seed(), revision: Number.MAX_SAFE_INTEGER }), command([], Number.MAX_SAFE_INTEGER));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "revision-limit");
});

test("測試 API 使用 domain 驗證；失敗不變，重新建立服務後重置", async (t) => {
  const app = await buildApp({ domainSandbox: true });
  const other = await buildApp({ domainSandbox: true });
  t.after(() => app.close());
  t.after(() => other.close());
  const url = "/api/dev/domain/commands";
  const malformed = await app.inject({ method: "POST", url, payload: "{", headers: { "content-type": "application/json" } });
  assert.equal(malformed.statusCode, 400);
  const extra = await app.inject({ method: "POST", url, payload: { ...command([]), hp: 999 } });
  assert.equal(extra.statusCode, 400);
  assert.equal(extra.json().code, "invalid-command");
  const success = await app.inject({ method: "POST", url, payload: command(["TEST-skill-1"]) });
  assert.equal(success.statusCode, 200);
  assert.equal(success.json().state.revision, 1);
  const stale = await app.inject({ method: "POST", url, payload: command([]) });
  assert.equal(stale.statusCode, 409);
  const read = await app.inject({ method: "GET", url: "/api/dev/domain" });
  assert.equal(read.headers["cache-control"], "no-store");
  assert.equal(read.json().state.revision, 1);
  assert.deepEqual(read.json().state.character.equippedSkillIds, ["TEST-skill-1"]);
  assert.equal((await other.inject({ method: "GET", url: "/api/dev/domain" })).json().state.revision, 0);
});

test("測試 API 預設關閉，production 即使要求啟用也不開放", async (t) => {
  const normal = await buildApp();
  t.after(() => normal.close());
  assert.equal((await normal.inject("/api/dev/domain")).statusCode, 404);
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    const production = await buildApp({ domainSandbox: true });
    t.after(() => production.close());
    assert.equal((await production.inject("/api/dev/domain")).statusCode, 404);
    assert.equal((await production.inject({ method: "POST", url: "/api/dev/domain/commands", payload: command([]) })).statusCode, 404);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
