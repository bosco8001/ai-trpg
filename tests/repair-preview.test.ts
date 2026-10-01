import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import Fastify from "fastify";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildApp } from "../src/server/app.js";
import { createTestGameState } from "../src/server/test-game-state.js";
import { createDomainSession } from "../src/server/domain-session.js";
import { InMemorySaveGameRepository } from "../src/server/save-game/memory-repository.js";
import { createSaveSnapshot } from "../src/server/save-game/service.js";
import { analyzeRepairRecord, inspectRepairPreview, registerRepairPreviewRoute, repairFingerprint } from "../src/server/repair-preview.js";
import { createMemoryRepairReader, createPostgresRepairReader, type RepairPreviewReader } from "../src/server/repair-preview-reader.js";
import { createPostgresDiagnosticsPool } from "../src/server/postgres-data-diagnostics.js";
import { applyCommand, type GameState } from "../src/domain/game.js";
import { advanceCombatTurn, applyCombatDamage, startCasting, startCombat } from "../src/domain/combat.js";
import { PHASE22_TEST_COMBAT_PARTICIPANTS } from "../src/server/combat/fixtures.js";
import { createPhase22CombatFixtureRoller } from "../src/server/combat/dice.js";
import { isRepairPreviewReport, type RepairSource } from "../src/shared/repair-preview.js";
import { changedRepairSources, invalidateRepairSource, loadRepairPreview, repairEpochs, subscribeRepairChanges } from "../src/web/repair-preview.js";
import { RepairPreviewReportView } from "../src/web/RepairPreviewPanel.js";
import { saveGame, loadGame } from "../src/web/api.js";

const context = { storage: "memory" as const, characterId: "TEST-character" };
const capturedAt = "2026-10-01T00:00:00.000Z";
function inspect(raw: unknown, source: RepairSource = "current") {
  return analyzeRepairRecord(context, source, { capturedAt, raw: JSON.stringify(raw) });
}
function slot(state: GameState, id: 1 | 2 | 3 = 1) {
  return { slotId: id, formatVersion: 2, sourceRevision: state.revision, savedAt: capturedAt, snapshot: createSaveSnapshot(state).state };
}
function stateOf(result: { ok: boolean; state?: GameState }): GameState {
  assert.ok(result.ok); assert.ok(result.state); return result.state;
}
function castingState() {
  const equipped = stateOf(applyCommand(createTestGameState(), { type: "set-equipped-skills", skillIds: ["TEST-skill-2"], expectedRevision: 0 }));
  const started = stateOf(startCombat(equipped, { expectedRevision: 1 }, PHASE22_TEST_COMBAT_PARTICIPANTS, createPhase22CombatFixtureRoller("normal")));
  const advanced = stateOf(advanceCombatTurn(started, { expectedRevision: 2 }));
  return stateOf(startCasting(advanced, { expectedRevision: 3, skillId: "TEST-skill-2" }));
}

test("兩項同步差異合成一個有效候選，原稿、權威資源與完整 ledger 不變", () => {
  const state = createTestGameState();
  const entry = { id: "原有識別", type: "system", text: "不應出現在預覽回應的故事", source: "fallback", category: "placed", sequence: 1, sourceStateRevision: null, placementRevision: 0, sourceCombatId: null };
  const raw = { ...state, activity: "in-combat", character: { ...state.character, currentMp: 1 },
    phase26: { ...state.phase26, sequenceHighWater: 42, history: [], narrativeLedger: [entry] } };
  const before = structuredClone(raw), result = inspect(raw);
  assert.equal(result.status, "candidate");
  assert.deepEqual(result.changes.map(c => [c.path, c.before, c.after]), [["activity", "in-combat", "outside-combat"], ["character.currentMp", 1, 24]]);
  assert.deepEqual(raw, before);
  assert.notEqual(result.fingerprint, result.candidateFingerprint);
  assert.doesNotMatch(JSON.stringify(result), /不應出現在|原有識別/);
  const changedLedger = { ...raw, phase26: { ...raw.phase26, narrativeLedger: [{ ...entry, text: "另一份歷史" }] } };
  assert.notEqual(inspect(changedLedger).fingerprint, result.fingerprint);
});

test("詠唱中的 MP 相容欄位依長期主帳同步，不能改成 Combat MP", () => {
  const state = castingState(), player = state.combat!.participants.find(p => p.characterId === state.character.id)!;
  assert.equal(player.mp!.currentMp, 18);
  assert.equal(state.phase26!.characters[0]!.currentMp, 24);
  const raw = { ...state, activity: "outside-combat", character: { ...state.character, currentMp: 18 } };
  const result = inspect(raw);
  assert.equal(result.status, "candidate");
  assert.equal(result.changes.find(c => c.rule === "sync-player-mp")!.after, 24);
  assert.equal(raw.combat!.participants.find(p => p.id === "TEST-player")!.mp!.currentMp, 18);
});

test("active、victory、Game Over 都依 Combat 存在更正活動標記，不結算或清詠唱", () => {
  const active = castingState();
  const damage = (state: GameState, targetId: string, amount: number) => stateOf(applyCombatDamage(state, { expectedRevision: state.revision, targetId, amount }));
  const victory = damage(damage(active, "TEST-enemy-1", 6), "TEST-enemy-2", 6);
  const defeat = damage(damage(active, "TEST-companion-1", 8), "TEST-player", 10);
  for (const state of [active, victory, defeat]) {
    const raw = { ...state, activity: "outside-combat" }, before = structuredClone(raw);
    const result = inspect(raw);
    assert.equal(result.status, "candidate", JSON.stringify(result));
    assert.deepEqual(result.changes.map(c => c.after), ["in-combat"]);
    assert.deepEqual(raw, before);
    const saved = slot(state); saved.snapshot = { ...saved.snapshot, activity: "outside-combat" };
    assert.equal(inspect(saved, 1).status, "candidate");
  }
});

test("健康資料與 Save v2 無需修復；缺目前資料與空槽不建立內容", async () => {
  const state = createTestGameState();
  assert.equal(inspect(state).status, "unchanged"); assert.equal(inspect(slot(state), 1).status, "unchanged");
  const reader = createMemoryRepairReader(state.character.id, () => ({ current: undefined, slots: [] }));
  const report = await inspectRepairPreview(reader, new AbortController().signal);
  assert.deepEqual(report.results.map(r => r.status), ["missing", "empty", "empty", "empty"]);
  assert.ok(isRepairPreviewReport(report));
});

test("缺欄位、非法目標值、非法證據及身分衝突都拒絕，不列局部差異", () => {
  const seed = createTestGameState();
  const mutations: ((v: any) => void)[] = [
    v => { delete v.activity; }, v => { delete v.character.currentMp; }, v => { delete v.character.raceId; },
    v => { v.activity = "未知"; }, v => { v.character.currentMp = "1"; }, v => { v.character.currentMp = -1; },
    v => { v.character.currentMp = 25; }, v => { v.phase26.characters[0].currentMp = -1; },
    v => { v.phase26.characters[0].currentHp = 0; }, v => { v.phase26.characters[0].maxMp = 23; },
    v => { v.phase26.characters.push({ ...v.phase26.characters[0] }); }, v => { v.phase26.characters[0].characterId = "其他角色"; },
    v => { v.character.id = "其他角色"; }, v => { v.phase26.characters[1].maxHp = 0; },
    v => { v.exploration.locationId = "未知位置"; }, v => { v.inventory[0].quantity = -1; },
    v => { v.phase26.runId = ""; }, v => { v.phase26.narrativeLedger = "不合法"; },
    v => { v.phase26.history = [{ id: "無法證明的故事" }]; }, v => { v.phase26.schemaVersion = 99; },
  ];
  for (const mutate of mutations) {
    const raw = structuredClone(seed) as any; raw.activity = "in-combat"; raw.character.currentMp = 1; mutate(raw);
    const before = structuredClone(raw), result = inspect(raw);
    assert.equal(result.status, "blocked", JSON.stringify(result)); assert.deepEqual(result.changes, []);
    assert.equal(result.candidateFingerprint, null); assert.ok(result.issues.length > 0); assert.deepEqual(raw, before);
  }
});

test("不接受 hydrate 的隱式補值、缺 Combat lifecycle 或額外來源欄位", () => {
  const state = castingState();
  for (const key of ["lifecycle", "activeCastings", "racialAbilityCooldowns"]) {
    const raw = structuredClone(state) as any; raw.activity = "outside-combat"; delete raw.combat[key];
    const result = inspect(raw); assert.equal(result.status, "blocked"); assert.equal(result.issues[0]!.code, "missing-field");
  }
  const raw = structuredClone(state) as any; raw.activity = "outside-combat"; delete raw.combat.participants[0].health;
  assert.equal(inspect(raw).status, "blocked");
  const extra = { ...createTestGameState(), activity: "in-combat", extra: true };
  assert.equal(inspect(extra).status, "blocked");
});

test("舊 TEST v1、未知正式舊資料與未來版本不借映射補值", () => {
  const saved = slot(createTestGameState());
  for (const version of [1, 99]) {
    const result = inspect({ ...saved, formatVersion: version }, 1);
    assert.equal(result.status, "blocked"); assert.equal(result.issues[0]!.code, "unsupported-version");
  }
  const { phase26: _phase26, ...old } = createTestGameState();
  assert.equal(inspect(old).status, "blocked");
  assert.equal(inspect({ ...old, character: { ...old.character, id: "正式角色" } }).status, "blocked");
});

test("原始數字的精度不可先被 JS 四捨五入後當作合法證據", () => {
  const raw = JSON.stringify({ ...createTestGameState(), activity: "in-combat" });
  for (const literal of ["9007199254740993", "1.00000000000000001", "1e-99999"]) {
    const result = analyzeRepairRecord(context, "current", { capturedAt, raw: raw.replace('"currentMp":24', `"currentMp":${literal}`) });
    assert.equal(result.status, "blocked"); assert.deepEqual(result.changes, []);
  }
  const exact = analyzeRepairRecord(context, "current", { capturedAt, raw: raw.replace('"currentMp":24', '"currentMp":2.4e1') });
  assert.equal(exact.status, "candidate");
});

test("四項獨立讀取，不從健康槽搬值；失敗、超限與慢來源不隱藏已完成項目", async () => {
  const reader = createMemoryRepairReader("TEST-character", () => ({ current: { ...createTestGameState(), activity: "in-combat" }, slots: [slot(createTestGameState())] }));
  const mixed: RepairPreviewReader = { ...reader, read(source, max, signal) {
    if (source === 2) throw new Error("postgres://private SELECT password");
    if (source === 3) return new Promise(() => {});
    return reader.read(source, max, signal);
  } };
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20);
  const report = await inspectRepairPreview(mixed, controller.signal); clearTimeout(timer);
  assert.deepEqual(report.results.map(r => r.status), ["candidate", "unchanged", "unavailable", "unavailable"]);
  assert.doesNotMatch(JSON.stringify(report), /private|password|SELECT/);
  const limited = await inspectRepairPreview(reader, new AbortController().signal, 30);
  assert.equal(limited.results[0]!.issues[0]!.code, "too-large");
});

test("API 僅 GET、no-store、沒有初始化／寫入／LLM，也不影響既有 Save", async t => {
  const session = createDomainSession(createTestGameState()), repository = new InMemorySaveGameRepository(() => session.getState());
  const reservation = await session.reserveNarrative("system"); assert.ok(reservation);
  await session.appendNarrative(reservation, "原有故事", "fallback");
  const state = session.getState();
  await repository.writeIfLiveRevision(1, createSaveSnapshot(state), { characterId: state.character.id, expectedRevision: state.revision });
  const before = structuredClone({ state, slots: repository.readAllForBackup() });
  const app = await buildApp({ domainSession: { ...session, getState() { throw new Error("禁止一般讀取初始化"); } }, saveGameRepository: repository });
  t.after(() => app.close());
  for (let i = 0; i < 2; i++) {
    const response = await app.inject("/api/repair-preview"); assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.headers["cache-control"], "no-store"); assert.ok(isRepairPreviewReport(response.json()));
    assert.deepEqual({ state: session.getState(), slots: repository.readAllForBackup() }, before);
  }
  assert.equal((await app.inject({ method: "POST", url: "/api/repair-preview" })).statusCode, 404);
  assert.equal((await app.inject("/api/repair-preview?characterId=別人")).statusCode, 400);
});

test("預覽契約拒絕部分報告、非唯讀回應、無證據差異及受阻的局部候選", async () => {
  const report = await inspectRepairPreview(createMemoryRepairReader("TEST-character", () => ({ current: { ...createTestGameState(), activity: "in-combat" }, slots: [] })), new AbortController().signal);
  assert.ok(isRepairPreviewReport(report));
  assert.equal(isRepairPreviewReport({ ...report, results: report.results.slice(0, 3) }), false);
  assert.equal(isRepairPreviewReport({ ...report, readOnly: false }), false);
  assert.equal(isRepairPreviewReport({ ...report, storage: ["memory"] }), false);
  assert.equal(isRepairPreviewReport({ ...report, results: report.results.map(r => ({ ...r, capturedAt: "2026-02-31T00:00:00.000Z" })) }), false);
  for (const mutate of [(r: any) => { r.results[0].changes[0].evidence.value = true; },
    (r: any) => { r.results[0].changes[0].before = ["in-combat"]; },
    (r: any) => { r.results[0].status = "blocked"; }, (r: any) => { r.results[0].candidateFingerprint = null; }]) {
    const broken = structuredClone(report); mutate(broken); assert.equal(isRepairPreviewReport(broken), false);
  }
  const html = renderToStaticMarkup(createElement(RepairPreviewReportView, { report, stale: ["current"] }));
  assert.match(html, /結果已過期/); assert.match(html, /證據欄位/); assert.match(html, /尚未套用/); assert.doesNotMatch(html, /<button/);
});

test("前端有界限地接收完整報告，不重試，取消慢 body 後不採用結果", async () => {
  const report = await inspectRepairPreview(createMemoryRepairReader("TEST-character", () => ({ current: createTestGameState(), slots: [] })), new AbortController().signal);
  const text = JSON.stringify(report), controller = new AbortController();
  const response = () => new Response(text, { headers: { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(text)) } });
  assert.deepEqual(await loadRepairPreview(controller.signal, async () => response()), report);
  for (const length of [String(Buffer.byteLength(text) + 1), "99999999"]) {
    const value = response(); value.headers.set("Content-Length", length);
    await assert.rejects(loadRepairPreview(controller.signal, async () => value));
  }
  let calls = 0, cancelled = false;
  const slow = new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("{")); }, cancel() { cancelled = true; } }),
    { headers: { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(text)) } });
  const waiting = loadRepairPreview(controller.signal, async () => { calls++; return slow; });
  setTimeout(() => controller.abort(), 10); await assert.rejects(waiting);
  assert.equal(calls, 1); assert.equal(cancelled, true);
});

test("Save／Load 成功或回應不確定時，只失效受影響來源；等待中的預覽亦可察覺", async () => {
  const before = repairEpochs(), events: RepairSource[] = [], unsubscribe = subscribeRepairChanges(source => events.push(source));
  await assert.rejects(saveGame(2, 0, async () => { throw new Error("回應遺失"); }));
  assert.deepEqual(changedRepairSources(before), [2]);
  const afterSave = repairEpochs();
  await assert.rejects(loadGame(1, 0, async () => new Response("{}", { status: 503 })));
  assert.deepEqual(changedRepairSources(afterSave), ["current"]);
  assert.deepEqual(events, [2, 2, "current", "current"]);
  unsubscribe(); const baseline = repairEpochs(); invalidateRepairSource(3);
  assert.deepEqual(changedRepairSources(baseline), [3]);
});

const pgOptions = { skip: !process.env.TEST_DATABASE_URL && "需提供隔離 TEST_DATABASE_URL。" };
async function postgresFixture(t: TestContext) {
  const base = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL }), schema = "phase30_" + randomUUID().replaceAll("-", "");
  await base.query(`CREATE SCHEMA ${schema}`);
  const writer = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema}` });
  const url = new URL(process.env.TEST_DATABASE_URL!); url.searchParams.set("options", `-c search_path=${schema}`);
  const readonly = createPostgresDiagnosticsPool(url.href);
  await writer.query("CREATE TABLE game_states (character_id text PRIMARY KEY, revision bigint, snapshot jsonb)");
  await writer.query("CREATE TABLE save_slots (slot_id integer PRIMARY KEY, format_version integer, source_revision bigint, snapshot jsonb, saved_at timestamptz)");
  t.after(async () => { await readonly.end(); await writer.end(); await base.query(`DROP SCHEMA ${schema} CASCADE`); await base.end(); });
  return { writer, readonly, reader: createPostgresRepairReader(readonly, "TEST-character") };
}
test("PostgreSQL 原始讀取、微秒時間、候選指紋與原稿不變；不碰其他角色", pgOptions, async t => {
  const { writer, readonly, reader } = await postgresFixture(t);
  const { revision, ...snapshot } = createTestGameState();
  const raw = { ...snapshot, activity: "in-combat", character: { ...snapshot.character, currentMp: 1 } };
  await writer.query("INSERT INTO game_states VALUES ('TEST-character',$1,$2),('OTHER-character',0,'{}')", [revision, JSON.stringify(raw)]);
  await writer.query("INSERT INTO save_slots VALUES (1,2,0,$1,'2026-10-01T00:00:00.123456Z')", [JSON.stringify({ ...slot(createTestGameState()).snapshot, activity: "in-combat" })]);
  const before = (await writer.query("SELECT row_to_json(r)::text AS raw FROM save_slots r")).rows[0]!.raw;
  assert.match(before, /123456/); assert.equal((await readonly.query("SHOW default_transaction_read_only")).rows[0].default_transaction_read_only, "on");
  const original = (await reader.read(1, 10485760, new AbortController().signal)).raw!;
  assert.equal(original, before);
  for (let i = 0; i < 2; i++) {
    const report = await inspectRepairPreview(reader, new AbortController().signal);
    assert.deepEqual(report.results.map(r => r.status), ["candidate", "candidate", "empty", "empty"]);
    assert.equal(report.results[1]!.fingerprint, repairFingerprint(reader, 1, original));
    assert.deepEqual(report.results[0]!.changes.map(c => c.after), ["outside-combat", 24]);
    assert.doesNotMatch(JSON.stringify(report), /OTHER-character/);
  }
  assert.equal((await writer.query("SELECT row_to_json(r)::text AS raw FROM save_slots r")).rows[0]!.raw, before);
  assert.deepEqual((await writer.query("SELECT snapshot FROM game_states WHERE character_id='TEST-character'")).rows[0]!.snapshot, raw);
});
test("PostgreSQL 不存在的資料不初始化，壞列與超限逐項隔離", pgOptions, async t => {
  const { writer, reader } = await postgresFixture(t);
  let report = await inspectRepairPreview(reader, new AbortController().signal);
  assert.equal(report.results[0]!.status, "missing"); assert.equal((await writer.query("SELECT count(*) FROM game_states")).rows[0].count, "0");
  await writer.query("INSERT INTO save_slots VALUES (1,2,0,$1,now()),(2,99,9007199254740993,'{}',now()),(3,2,0,$2,now())",
    [JSON.stringify(slot(createTestGameState()).snapshot), JSON.stringify({ text: "字".repeat(1000) })]);
  report = await inspectRepairPreview(reader, new AbortController().signal, 2500);
  assert.deepEqual(report.results.map(r => r.status), ["missing", "unchanged", "blocked", "unavailable"]);
  assert.equal(report.results[3]!.issues[0]!.code, "too-large");
});
test("PostgreSQL 卡住的槽查詢兩秒停止，目前資料獨立完成，解除後可手動重試", { ...pgOptions, timeout: 10000 }, async t => {
  const { writer, reader } = await postgresFixture(t);
  const { revision, ...snapshot } = createTestGameState(); await writer.query("INSERT INTO game_states VALUES ('TEST-character',$1,$2)", [revision, JSON.stringify(snapshot)]);
  const lock = await writer.connect(); await lock.query("BEGIN"); await lock.query("LOCK TABLE save_slots IN ACCESS EXCLUSIVE MODE");
  try {
    const app = Fastify(); registerRepairPreviewRoute(app, reader); t.after(() => app.close());
    const start = Date.now(), response = await app.inject("/api/repair-preview");
    assert.ok(Date.now() - start < 6000); assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().results.map((r: any) => r.status), ["unchanged", "unavailable", "unavailable", "unavailable"]);
  } finally { await lock.query("ROLLBACK"); lock.release(); }
  assert.deepEqual((await inspectRepairPreview(reader, new AbortController().signal)).results.map(r => r.status), ["unchanged", "empty", "empty", "empty"]);
});
test("server deadline 對不合作 reader 亦有上限，取消結果不暴露內部錯誤", async t => {
  const app = Fastify(); registerRepairPreviewRoute(app, { ...context, read: () => new Promise(() => {}) }, 20);
  t.after(() => app.close());
  const result = await app.inject("/api/repair-preview"); assert.equal(result.statusCode, 200);
  assert.ok(isRepairPreviewReport(result.json())); assert.ok(result.json().results.every((r: any) => r.status === "unavailable"));
});
