// 尚未由開發代理執行；交由 AI TRPG Architecture Critic 在隔離環境驗證。
import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import pg from "pg";
import { createTestGameState } from "../src/server/test-game-state.js";
import { createDomainSession } from "../src/server/domain-session.js";
import { InMemorySaveGameRepository } from "../src/server/save-game/memory-repository.js";
import { createSaveSnapshot } from "../src/server/save-game/service.js";
import { createMemoryRepairReader, createPostgresRepairReader, type RepairPreviewReader } from "../src/server/repair-preview-reader.js";
import { analyzeRepairRecord } from "../src/server/repair-preview.js";
import { createRepairPreparationService, registerRepairPreparationRoutes } from "../src/server/repair-preparation.js";
import { FileRepairArchive } from "../src/server/file-repair-archive.js";
import { PostgresRepairArchive, createRepairArchivePool } from "../src/server/postgres-repair-archive.js";
import { MemoryRepairApplication } from "../src/server/memory-repair-application.js";
import { PostgresRepairApplication } from "../src/server/postgres-repair-application.js";
import { registerRepairApplicationRoutes } from "../src/server/repair-application-routes.js";
import { ApplicationFailure } from "../src/server/repair-application-core.js";
import { isRepairApplication, parseRepairReport, REPAIR_REPORT_MAX_BYTES, type RepairApplyRequest } from "../src/shared/repair-application.js";
import { applyRepair, loadRepairReport } from "../src/web/repair-application.js";
import { append } from "../src/server/history.js";
import { makeRepairBackup } from "../src/server/repair-archive.js";
import { REPAIR_BACKUP_MAX_BYTES } from "../src/shared/repair-preparation.js";
import { prepareRepair, PreparationClientFailure } from "../src/web/repair-preparation.js";

const signal = () => new AbortController().signal;
const sourceLimit = 10 * 1024 * 1024;
async function requestFor(reader: RepairPreviewReader, source: "current" | 1 | 2 | 3 = "current"): Promise<RepairApplyRequest> {
  const result = analyzeRepairRecord(reader, source, await reader.read(source, sourceLimit, signal()));
  assert.equal(result.status, "candidate");
  return { repairId: randomUUID(), source, storage: reader.storage, previewVersion: 1, rulesVersion: 1,
    fingerprint: result.fingerprint!, candidateFingerprint: result.candidateFingerprint!, confirm: true };
}
function preparationRequest({ confirm: _confirm, ...request }: RepairApplyRequest) { return request; }
async function memoryFixture(t: TestContext, runtimeId = randomUUID(), directory?: string) {
  const parent = directory ?? await mkdtemp(join(tmpdir(), "phase32-"));
  if (!directory) t.after(() => rm(parent, { recursive: true, force: true }));
  const session = createDomainSession(createTestGameState());
  const savedStory = await session.reserveNarrative("system"); assert.ok(savedStory);
  await session.appendNarrative(savedStory, "既有已保存故事，修復後必須保留。", "fallback");
  const pendingStory = await session.reserveNarrative("tutorial"); assert.ok(pendingStory);
  // Corruption is injected only into this isolated raw fixture, never through a product endpoint.
  session.repairRaw(raw => ({ result: undefined, nextState: { ...raw, activity: "in-combat", character: { ...raw.character, currentMp: 23 } } }));
  const slots = new InMemorySaveGameRepository(() => session.getState());
  const reader = createMemoryRepairReader("TEST-character", () => ({ current: session.readStateForBackup(), slots: slots.readAllForBackup() }),
    () => new Date(), source => {
      const guard = source === "current" ? session.readRepairGuard() : slots.readRepairGuard(source);
      return guard ? `${runtimeId}:${guard}` : null;
    });
  const archive = new FileRepairArchive(parent);
  const backend = new MemoryRepairApplication(reader, archive, session, slots, runtimeId);
  const prepare = createRepairPreparationService(reader, archive, undefined, runtimeId, () => new Date(), backend.bind.bind(backend));
  return { parent, session, slots, reader, archive, backend, prepare, runtimeId, pendingStory };
}
test("Memory：完整原稿先保存，兩欄單次修復，版本只加一且換世代，保存故事與配置不變", async t => {
  const f = await memoryFixture(t), before = structuredClone(f.session.getState()), request = await requestFor(f.reader);
  const receipt = await f.prepare.prepare(preparationRequest(request), signal());
  const original = await f.prepare.download(request.repairId, signal());
  assert.deepEqual(f.session.getState(), before);
  const result = await f.backend.apply(request, signal());
  assert.ok(isRepairApplication(result)); assert.equal(result.status, "applied");
  const after = f.session.getState();
  assert.equal(after.revision, before.revision + 1);
  assert.notEqual(after.phase26!.runtimeGeneration, before.phase26!.runtimeGeneration);
  assert.deepEqual(after, { ...before, activity: "outside-combat", revision: before.revision + 1,
    character: { ...before.character, currentMp: 24 }, phase26: { ...before.phase26!, runtimeGeneration: after.phase26!.runtimeGeneration } });
  assert.equal(await f.prepare.download(request.repairId, signal()), original);
  assert.equal(result.report?.preparation.backupChecksum, receipt.backupChecksum);
  assert.doesNotMatch(JSON.stringify(result), /"raw"|"narrativeLedger"/);
  const staleReservation = { id: randomUUID(), runId: before.phase26!.runId, generation: before.phase26!.runtimeGeneration,
    sequence: 1, sourceStateRevision: before.revision, type: "exploration" as const, sourceCombatId: null };
  assert.equal(append(after, staleReservation, "舊工作不得保存或發布", "fallback").result.status, "discarded");
  assert.equal((await f.session.appendNarrative(f.pendingStory, "未完成舊回覆", "model")).status, "discarded");
  assert.deepEqual(f.session.getState(), after);
});
test("Memory：同識別碼並行及重送只套用一次，衝突不改原結果", async t => {
  const f = await memoryFixture(t), request = await requestFor(f.reader);
  await f.prepare.prepare(preparationRequest(request), signal());
  const results = await Promise.all(Array.from({ length: 6 }, () => f.backend.apply(request, signal())));
  assert.equal(f.session.getState().revision, 1);
  assert.ok(results.every(r => r.status === "unknown" || r.status === "applied"));
  const final = await f.backend.lookup(request.repairId, signal()); assert.equal(final.status, "applied");
  assert.deepEqual(await f.backend.apply(request, signal()), final);
  await assert.rejects(f.backend.apply({ ...request, fingerprint: "0".repeat(64) }, signal()),
    (e: unknown) => e instanceof ApplicationFailure && e.code === "conflict");
  assert.deepEqual(await f.backend.lookup(request.repairId, signal()), final);
});
test("Memory：來源改動後改回仍拒絕，拒絕報告持久保存且不改版本", async t => {
  const f = await memoryFixture(t), request = await requestFor(f.reader), before = structuredClone(f.session.getState());
  await f.prepare.prepare(preparationRequest(request), signal());
  f.session.repairRaw(raw => ({ result: undefined, nextState: { ...raw, character: { ...raw.character, currentMp: 22 } } }));
  f.session.repairRaw(() => ({ result: undefined, nextState: before }));
  const result = await f.backend.apply(request, signal());
  assert.equal(result.status, "rejected"); assert.equal(result.report?.reason, "stale");
  assert.deepEqual(f.session.getState(), before);
  assert.equal(parseRepairReport(await f.backend.download(request.repairId, signal())).report.status, "rejected");
  assert.deepEqual(await f.backend.apply(request, signal()), result);
});
test("Memory：槽單獨修復保留保存時間、來源版本與舊 Run，不載入或改其他槽", async t => {
  const f = await memoryFixture(t), current = structuredClone(f.session.getState());
  const snapshot = createSaveSnapshot(createTestGameState()).state;
  const old = { ...snapshot, activity: "in-combat", character: { ...snapshot.character, currentMp: 23 },
    phase26: { ...snapshot.phase26!, runId: "OLD-run", worldId: "OLD-world",
      encounters: snapshot.phase26!.encounters.map(e => ({ ...e, worldId: "OLD-world" })) } };
  for (const slotId of [1, 2, 3] as const) f.slots.repairRaw(slotId, () => ({ result: undefined,
    next: { slotId, formatVersion: 2, sourceRevision: 7, savedAt: "2026-10-04T00:00:00.123456Z", snapshot: old } }));
  const before = await f.slots.list(), request = await requestFor(f.reader, 2);
  await f.prepare.prepare(preparationRequest(request), signal());
  const result = await f.backend.apply(request, signal());
  assert.equal(result.status, "applied"); assert.equal(result.report?.effects.savedAt, before[1]!.savedAt);
  const after = await f.slots.list(); assert.deepEqual(after[0], before[0]); assert.deepEqual(after[2], before[2]);
  assert.deepEqual(after[1], { ...before[1]!, snapshot: { ...old, activity: "outside-combat", character: { ...old.character, currentMp: 24 } } });
  assert.deepEqual(f.session.getState(), current);
});
test("Memory：報告發布失敗保持未知，同程序只補報告；重啟不重做未決 ID", async t => {
  const f = await memoryFixture(t), request = await requestFor(f.reader);
  await f.prepare.prepare(preparationRequest(request), signal());
  const publish = f.archive.publishAuxiliary.bind(f.archive);
  f.archive.publishAuxiliary = async (id, kind, text, requestSignal) => {
    if (kind === "report") throw new Error("isolated publication failure");
    return publish(id, kind, text, requestSignal);
  };
  await assert.rejects(f.backend.apply(request, signal())); assert.equal(f.session.getState().revision, 1);
  const restarted = await memoryFixture(t, randomUUID(), f.parent);
  assert.equal((await restarted.backend.lookup(request.repairId, signal())).status, "unknown");
  assert.equal((await restarted.backend.apply(request, signal())).status, "unknown");
  assert.equal(restarted.session.getState().revision, 0);
  f.archive.publishAuxiliary = publish;
  assert.equal((await f.backend.lookup(request.repairId, signal())).status, "applied");
  assert.equal(f.session.getState().revision, 1);
  assert.equal((await restarted.backend.lookup(request.repairId, signal())).status, "applied");
});
test("Memory：開始紀錄已發布但回應遺失，不改來源、不重做、不冒稱拒絕", async t => {
  const f = await memoryFixture(t), request = await requestFor(f.reader), before = structuredClone(f.session.getState());
  await f.prepare.prepare(preparationRequest(request), signal());
  const publish = f.archive.publishAuxiliary.bind(f.archive);
  f.archive.publishAuxiliary = async (id, kind, text, requestSignal) => {
    await publish(id, kind, text, requestSignal); if (kind === "started") throw new Error("lost durable-start response");
  };
  await assert.rejects(f.backend.apply(request, signal())); f.archive.publishAuxiliary = publish;
  assert.equal((await f.backend.apply(request, signal())).status, "unknown");
  assert.deepEqual(f.session.getState(), before);
});
test("舊備份缺守衛或新程序準備均無資格；容量不足在來源寫入前拒絕", async t => {
  const f = await memoryFixture(t), old = createRepairPreparationService(f.reader, f.archive), legacy = await requestFor(f.reader);
  await old.prepare(preparationRequest(legacy), signal());
  assert.equal((await f.backend.apply(legacy, signal())).status, "ineligible");
  const request = await requestFor(f.reader); await f.prepare.prepare(preparationRequest(request), signal());
  const restarted = await memoryFixture(t, randomUUID(), f.parent);
  assert.equal((await restarted.backend.apply(request, signal())).status, "ineligible");
  const small = new FileRepairArchive(f.parent, undefined, 1);
  const limited = new MemoryRepairApplication(f.reader, small, f.session, f.slots, f.runtimeId);
  await assert.rejects(limited.apply(request, signal()), (e: unknown) => e instanceof ApplicationFailure && e.code === "capacity");
  assert.equal(f.session.getState().revision, 0); assert.equal((await f.backend.lookup(request.repairId, signal())).status, "ready");
});
test("資格容量不足回 507，原稿仍可下載，同 ID 不補發資格或修改來源", async t => {
  const f = await memoryFixture(t), request = await requestFor(f.reader), before = structuredClone(f.session.getState());
  let bindings = 0;
  const preparation = createRepairPreparationService(f.reader, f.archive, undefined, f.runtimeId, () => new Date(), async () => {
    bindings++; throw new ApplicationFailure("capacity");
  });
  const app = Fastify(); registerRepairPreparationRoutes(app, preparation); t.after(() => app.close());
  const response = await app.inject({ method: "POST", url: "/api/repair-preparations", payload: preparationRequest(request) });
  assert.equal(response.statusCode, 507); assert.equal(response.json().code, "capacity-after-backup");
  const backup = await preparation.download(request.repairId, signal());
  assert.equal((await f.backend.lookup(request.repairId, signal())).status, "ineligible");
  assert.equal((await app.inject({ method: "POST", url: "/api/repair-preparations", payload: preparationRequest(request) })).statusCode, 200);
  assert.equal(bindings, 1);
  assert.equal(await preparation.download(request.repairId, signal()), backup);
  assert.equal((await f.backend.lookup(request.repairId, signal())).status, "ineligible");
  assert.deepEqual(f.session.getState(), before);
});
// Size a real archive to fit the backup exactly, leaving no room for its certificate.
async function backupOnlyBytes(reader: RepairPreviewReader, request: RepairApplyRequest, runtimeId: string, now: Date) {
  const record = reader.readGuarded ? await reader.readGuarded(request.source, sourceLimit, signal())
    : await reader.read(request.source, sourceLimit, signal());
  const result = analyzeRepairRecord(reader, request.source, record);
  assert.equal(result.status, "candidate"); assert.ok(record.raw); assert.notEqual(result.revision, null);
  return Buffer.byteLength(makeRepairBackup({ ...preparationRequest(request), characterId: reader.characterId,
    runtimeId: reader.storage === "memory" ? runtimeId : null, capturedAt: record.capturedAt, preparedAt: now.toISOString(),
    revision: result.revision!, formatVersion: 2, changes: result.changes, raw: record.raw }, REPAIR_BACKUP_MAX_BYTES));
}
async function checkCapacityResponse(t: TestContext, reader: RepairPreviewReader, request: RepairApplyRequest,
  preparation: ReturnType<typeof createRepairPreparationService>, backend: MemoryRepairApplication | PostgresRepairApplication,
  saved: boolean) {
  const capture = () => Promise.all((["current", 1, 2, 3] as const).map(async source => {
    const record = reader.readGuarded ? await reader.readGuarded(source, sourceLimit, signal())
      : await reader.read(source, sourceLimit, signal());
    return { source, raw: record.raw, sourceGuard: record.sourceGuard };
  }));
  const before = await capture();
  const app = Fastify(); registerRepairPreparationRoutes(app, preparation); t.after(() => app.close());
  const response = await app.inject({ method: "POST", url: "/api/repair-preparations", payload: preparationRequest(request) });
  assert.equal(response.statusCode, 507);
  assert.equal(response.json().code, saved ? "capacity-after-backup" : "capacity");
  if (saved) {
    assert.match(response.json().message, /完整備份已保存/);
    assert.match(response.json().message, /未取得套用資格/);
    assert.doesNotMatch(response.json().message, /未新增備份/);
  } else assert.match(response.json().message, /未新增備份/);
  // The client must use its safe dictionary, even when the server message is untrusted.
  const body = JSON.stringify({ ...response.json(), message: "untrusted SQL /private/secret" });
  await assert.rejects(prepareRepair(preparationRequest(request), signal(), async () => new Response(body, {
    status: 507, headers: { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(body)) },
  })), (error: unknown) => error instanceof PreparationClientFailure
    && error.code === response.json().code && error.message === response.json().message);
  const download = await app.inject(`/api/repair-preparations/${request.repairId}/backup`);
  assert.equal(download.statusCode, saved ? 200 : 404);
  if (saved) {
    assert.equal(download.body, await preparation.download(request.repairId, signal()));
    assert.equal((await backend.lookup(request.repairId, signal())).status, "ineligible");
    assert.equal((await app.inject({ method: "POST", url: "/api/repair-preparations", payload: preparationRequest(request) })).statusCode, 200);
    assert.equal((await backend.lookup(request.repairId, signal())).status, "ineligible");
    assert.equal(await preparation.download(request.repairId, signal()), download.body);
  }
  assert.deepEqual(await capture(), before);
}
test("Memory 真容量：備份前與資格階段 507 提示分開，同 ID 不補資格，新 ID 可準備", async t => {
  const f = await memoryFixture(t), now = new Date("2026-10-04T00:00:00.000Z"), request = await requestFor(f.reader);
  const full = new FileRepairArchive(f.parent, undefined, 1);
  await checkCapacityResponse(t, f.reader, request, createRepairPreparationService(f.reader, full), f.backend, false);
  const archive = new FileRepairArchive(f.parent, undefined, await backupOnlyBytes(f.reader, request, f.runtimeId, now) + 4096);
  const backend = new MemoryRepairApplication(f.reader, archive, f.session, f.slots, f.runtimeId);
  const prepare = createRepairPreparationService(f.reader, archive, undefined, f.runtimeId, () => now, backend.bind.bind(backend));
  await checkCapacityResponse(t, f.reader, request, prepare, backend, true);
  const backup = await prepare.download(request.repairId, signal());
  await f.prepare.prepare(preparationRequest(request), signal());
  assert.equal((await f.backend.lookup(request.repairId, signal())).status, "ineligible");
  assert.equal(await f.prepare.download(request.repairId, signal()), backup);
  const fresh = await requestFor(f.reader); await f.prepare.prepare(preparationRequest(fresh), signal());
  assert.equal((await f.backend.lookup(fresh.repairId, signal())).status, "ready");
  assert.equal(f.session.getState().revision, 0);
});
test("HTTP／前端：嚴格確認、固定安全錯誤、完整報告校驗，遺失回應沒有重試", async t => {
  const f = await memoryFixture(t), request = await requestFor(f.reader);
  const record = await f.prepare.prepare(preparationRequest(request), signal());
  const app = Fastify(); registerRepairApplicationRoutes(app, f.backend); t.after(() => app.close());
  assert.equal((await app.inject({ method: "POST", url: `/api/repair-applications/${request.repairId}`, payload: { ...request, confirm: false } })).statusCode, 400);
  assert.equal((await app.inject(`/api/repair-applications/${request.repairId}?characterId=OTHER`)).statusCode, 400);
  const response = await app.inject({ method: "POST", url: `/api/repair-applications/${request.repairId}`, payload: request });
  assert.equal(response.statusCode, 200); const state = response.json(); assert.equal(state.status, "applied");
  const text = await f.backend.download(request.repairId, signal());
  const reportResponse = (value: string) => new Response(value, { headers: { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(value)), "X-Repair-Report-Max-Bytes": String(REPAIR_REPORT_MAX_BYTES) } });
  assert.equal((await loadRepairReport(state, signal(), async () => reportResponse(text))).text, text);
  await assert.rejects(loadRepairReport(state, signal(), async () => reportResponse(text.replace("outside-combat", "in-combat"))));
  let calls = 0; await assert.rejects(applyRepair(record, signal(), async () => { calls++; throw new Error("lost reply"); })); assert.equal(calls, 1);
  const reportFile = join(f.parent, `${request.repairId}.report`), original = await readFile(reportFile);
  await writeFile(reportFile, "{}"); const failed = await app.inject(`/api/repair-applications/${request.repairId}`);
  assert.equal(failed.statusCode, 503); assert.doesNotMatch(failed.body, /phase32-|TEST-character|stack|narrativeLedger/);
  await writeFile(reportFile, original);
});

const pgOptions = { skip: !process.env.TEST_DATABASE_URL && "需提供隔離 TEST_DATABASE_URL。" };
async function postgresFixture(t: TestContext) {
  const root = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const schema = `phase32_${randomUUID().replaceAll("-", "")}`; await root.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(process.env.TEST_DATABASE_URL!); url.searchParams.set("options", `-c search_path=${schema}`);
  const writer = createRepairArchivePool(url.href);
  t.after(async () => { await writer.end(); await root.query(`DROP SCHEMA ${schema} CASCADE`); await root.end(); });
  const { runner } = await import("node-pg-migrate");
  await runner({ databaseUrl: url.href, dir: "migrations", direction: "up", migrationsTable: "pgmigrations", migrationsSchema: schema, schema, count: Infinity, log: () => {} });
  const reader = createPostgresRepairReader(writer, "TEST-character"), archive = new PostgresRepairArchive(writer);
  const backend = new PostgresRepairApplication(reader, archive);
  const prepare = createRepairPreparationService(reader, archive, undefined, randomUUID(), () => new Date(), backend.bind.bind(backend));
  const historySeed = createDomainSession(createTestGameState());
  const story = await historySeed.reserveNarrative("system"); assert.ok(story);
  await historySeed.appendNarrative(story, "資料庫既有故事必須保留。", "fallback");
  const { revision, ...snapshot } = historySeed.getState();
  await writer.query("INSERT INTO game_states VALUES ('TEST-character',$1,$2)", [revision, JSON.stringify({ ...snapshot, activity: "in-combat", character: { ...snapshot.character, currentMp: 23 } })]);
  return { writer, reader, archive, backend, prepare };
}
test("PG 真容量：備份前與資格階段 507 提示分開，同 ID 不補資格，新 ID 可準備", pgOptions, async t => {
  const f = await postgresFixture(t), now = new Date("2026-10-04T00:00:00.000Z"), request = await requestFor(f.reader);
  const full = new PostgresRepairArchive(f.writer, undefined, 1);
  await checkCapacityResponse(t, f.reader, request, createRepairPreparationService(f.reader, full), f.backend, false);
  const runtimeId = randomUUID();
  const capacity = await backupOnlyBytes(f.reader, request, runtimeId, now) + Buffer.byteLength(f.reader.characterId) + 16;
  const archive = new PostgresRepairArchive(f.writer, undefined, capacity), backend = new PostgresRepairApplication(f.reader, archive);
  const prepare = createRepairPreparationService(f.reader, archive, undefined, runtimeId, () => now, backend.bind.bind(backend));
  await checkCapacityResponse(t, f.reader, request, prepare, backend, true);
  const backup = await prepare.download(request.repairId, signal());
  await f.prepare.prepare(preparationRequest(request), signal());
  assert.equal((await f.backend.lookup(request.repairId, signal())).status, "ineligible");
  assert.equal(await f.prepare.download(request.repairId, signal()), backup);
  const fresh = await requestFor(f.reader); await f.prepare.prepare(preparationRequest(fresh), signal());
  assert.equal((await f.backend.lookup(fresh.repairId, signal())).status, "ready");
  assert.equal(Number((await f.writer.query("SELECT revision FROM game_states WHERE character_id='TEST-character'")).rows[0].revision), 0);
});
test("PG：跨實例同 ID 只寫一次；來源、世代與報告同筆提交，重啟可取回", pgOptions, async t => {
  const f = await postgresFixture(t), request = await requestFor(f.reader);
  const before = JSON.parse((await f.reader.read("current", sourceLimit, signal())).raw!);
  await f.prepare.prepare(preparationRequest(request), signal());
  const second = new PostgresRepairApplication(f.reader, new PostgresRepairArchive(f.writer));
  const results = await Promise.all([f.backend.apply(request, signal()), second.apply(request, signal())]);
  assert.ok(results.every(v => v.status === "applied" || v.status === "unknown"));
  const result = await second.lookup(request.repairId, signal()); assert.equal(result.status, "applied");
  const after = JSON.parse((await f.reader.read("current", sourceLimit, signal())).raw!);
  assert.equal(after.revision, before.revision + 1); assert.notEqual(after.snapshot.phase26.runtimeGeneration, before.snapshot.phase26.runtimeGeneration);
  assert.deepEqual(after.snapshot.phase26.history, before.snapshot.phase26.history);
  assert.deepEqual(after.snapshot.phase26.narrativeLedger, before.snapshot.phase26.narrativeLedger);
  assert.deepEqual(await second.apply(request, signal()), result);
});
test("PG：同值 SQL、刪除重建及世代輪換都使舊準備失效", pgOptions, async t => {
  const f = await postgresFixture(t);
  for (const change of ["same", "recreate", "epoch"] as const) {
    const request = await requestFor(f.reader); await f.prepare.prepare(preparationRequest(request), signal());
    const before = (await f.writer.query("SELECT * FROM game_states")).rows[0];
    if (change === "same") await f.writer.query("UPDATE game_states SET snapshot=snapshot");
    else if (change === "epoch") await f.writer.query("UPDATE repair_apply_epoch SET token=gen_random_uuid() WHERE singleton");
    else { await f.writer.query("DELETE FROM game_states"); await f.writer.query("INSERT INTO game_states VALUES ($1,$2,$3)", [before.character_id, before.revision, JSON.stringify(before.snapshot)]); }
    const result = await f.backend.apply(request, signal());
    assert.equal(result.status, change === "epoch" ? "ineligible" : "rejected");
    if (change !== "epoch") assert.equal(result.report?.reason, "stale");
    assert.deepEqual((await f.writer.query("SELECT * FROM game_states")).rows[0], before);
  }
});
test("PG：單槽修復不讀取目前遊戲，微秒 saved_at 及 source_revision 原樣保留", pgOptions, async t => {
  const f = await postgresFixture(t); await f.writer.query("DELETE FROM game_states");
  const snapshot = createSaveSnapshot(createTestGameState()).state;
  for (const id of [1, 2, 3]) await f.writer.query("INSERT INTO save_slots VALUES ($1,2,7,$2,'2026-10-04T00:00:00.123456Z')", [id, JSON.stringify({ ...snapshot, activity: "in-combat" })]);
  const original = await f.reader.read(2, sourceLimit, signal()), request = await requestFor(f.reader, 2);
  const others = await Promise.all([1, 3].map(id => f.reader.read(id as 1 | 3, sourceLimit, signal())));
  await f.prepare.prepare(preparationRequest(request), signal()); const result = await f.backend.apply(request, signal());
  assert.equal(result.status, "applied"); const after = JSON.parse((await f.reader.read(2, sourceLimit, signal())).raw!);
  assert.equal(after.saved_at, JSON.parse(original.raw!).saved_at); assert.match(after.saved_at, /123456/); assert.equal(after.source_revision, 7);
  assert.deepEqual(await Promise.all([1, 3].map(async id => (await f.reader.read(id as 1 | 3, sourceLimit, signal())).raw)), others.map(r => r.raw));
  assert.equal((await f.writer.query("SELECT count(*) FROM game_states")).rows[0].count, "0");
});
test("PG：開始 COMMIT 或來源 COMMIT 回應遺失，持久 ID 不重做，查詢依真實結果回報", pgOptions, async t => {
  for (const lostCommit of [1, 2]) await t.test(`遺失第 ${lostCommit} 次 COMMIT 回應`, async child => {
    const f = await postgresFixture(child), request = await requestFor(f.reader);
    await f.prepare.prepare(preparationRequest(request), signal());
    let commits = 0;
    const faultPool = { async connect() {
      const client = await f.writer.connect();
      return new Proxy(client, { get(target, key) {
        if (key === "query") return async (...args: unknown[]) => {
          const value = await Reflect.apply(target.query, target, args);
          if (args[0] === "COMMIT" && ++commits === lostCommit) throw new Error("isolated COMMIT response loss");
          return value;
        };
        const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
      } });
    } };
    const faulty = new PostgresRepairApplication(f.reader, new PostgresRepairArchive(faultPool));
    await assert.rejects(faulty.apply(request, signal()));
    const result = await f.backend.lookup(request.repairId, signal());
    assert.equal(result.status, lostCommit === 1 ? "unknown" : "applied");
    const revision = (await f.writer.query("SELECT revision FROM game_states")).rows[0].revision;
    assert.equal(Number(revision), lostCommit === 1 ? 0 : 1);
    assert.deepEqual(await f.backend.apply(request, signal()), result);
    assert.equal(Number((await f.writer.query("SELECT revision FROM game_states")).rows[0].revision), Number(revision));
  });
});
