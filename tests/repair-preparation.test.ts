import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile, readdir, rm, symlink } from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import Fastify from "fastify";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTestGameState } from "../src/server/test-game-state.js";
import { createMemoryRepairReader, createPostgresRepairReader, type RepairPreviewReader } from "../src/server/repair-preview-reader.js";
import { analyzeRepairRecord, repairFingerprint } from "../src/server/repair-preview.js";
import { FileRepairArchive } from "../src/server/file-repair-archive.js";
import { createRepairArchivePool, PostgresRepairArchive } from "../src/server/postgres-repair-archive.js";
import { createPostgresDiagnosticsPool } from "../src/server/postgres-data-diagnostics.js";
import { createRepairPreparationService, registerRepairPreparationRoutes } from "../src/server/repair-preparation.js";
import { PreparationFailure, verifiedBackup, type RepairArchive } from "../src/server/repair-archive.js";
import { createSaveSnapshot } from "../src/server/save-game/service.js";
import { isPreparationSummary, parseRepairBackup, type RepairPreparationRequest } from "../src/shared/repair-preparation.js";
import { loadPreparationBackup, prepareRepair } from "../src/web/repair-preparation.js";
import { RepairPreparationSummaryView } from "../src/web/RepairPreparationPanel.js";

const signal = () => new AbortController().signal;
const captureTime = "2026-10-02T00:00:00.000Z";
const broken = () => ({ ...createTestGameState(), activity: "in-combat" as const });
async function requestFor(reader: RepairPreviewReader, source: "current" | 1 | 2 | 3 = "current"): Promise<RepairPreparationRequest> {
  const result = analyzeRepairRecord(reader, source, await reader.read(source, 10 * 1024 * 1024, signal()));
  assert.equal(result.status, "candidate");
  return { repairId: randomUUID(), source, storage: reader.storage, previewVersion: 1, rulesVersion: 1,
    fingerprint: result.fingerprint!, candidateFingerprint: result.candidateFingerprint! };
}
async function fixture(t: TestContext) {
  const parent = await mkdtemp(join(tmpdir(), "phase31-")), directory = join(parent, "archive");
  t.after(() => rm(parent, { recursive: true, force: true }));
  let current = broken();
  const reader = createMemoryRepairReader("TEST-character", () => ({ current, slots: [] }), () => new Date(captureTime));
  const archive = new FileRepairArchive(directory), service = createRepairPreparationService(reader, archive);
  return { reader, archive, service, directory, parent, mutate() { current = { ...current, revision: current.revision + 1 }; }, current: () => current };
}
const failure = (code: string) => (error: unknown) => error instanceof PreparationFailure && error.code === code;

test("持久備份保存完整原稿，獨立重算雙重 SHA，遊戲來源完全不變", async t => {
  const f = await fixture(t), before = JSON.stringify(f.current()), request = await requestFor(f.reader);
  const result = await f.service.prepare(request, signal());
  assert.ok(isPreparationSummary(result)); assert.equal(result.applied, false);
  assert.equal(JSON.stringify(f.current()), before);
  const text = await f.service.download(request.repairId, signal()), parsed = parseRepairBackup(text);
  assert.equal(parsed.data.raw, before);
  assert.equal(createHash("sha256").update(parsed.envelope.payload).digest("hex"), parsed.envelope.checksum.value);
  assert.equal(createHash("sha256").update(JSON.stringify([1, "memory", "TEST-character", "current"]) + "\n" + before).digest("hex"), parsed.data.fingerprint);
  assert.doesNotMatch(JSON.stringify(result), /"raw"|"narrativeLedger"/);
});
test("同 ID 並行只發布一份，來源之後改變仍回同次結果；ID 內容衝突拒絕", async t => {
  const f = await fixture(t), request = await requestFor(f.reader);
  const results = await Promise.all(Array.from({ length: 8 }, () => f.service.prepare(request, signal())));
  results.forEach(result => assert.deepEqual(result, results[0]));
  assert.equal((await readdir(f.directory)).filter(n => n.endsWith(".json")).length, 1);
  f.mutate(); assert.deepEqual(await f.service.prepare(request, signal()), results[0]);
  await assert.rejects(f.service.prepare({ ...request, candidateFingerprint: "0".repeat(64) }, signal()), failure("conflict"));
});
test("I4：不同 ID 並行等待正常釋放的鎖，各自保存且原稿不變", async t => {
  const f = await fixture(t), request = await requestFor(f.reader), before = JSON.stringify(f.current());
  const requests = Array.from({ length: 12 }, () => ({ ...request, repairId: randomUUID() }));
  const results = await Promise.all(requests.map(value => f.service.prepare(value, signal())));
  assert.deepEqual(results.map(value => value.repairId), requests.map(value => value.repairId));
  assert.equal((await readdir(f.directory)).filter(name => name.endsWith(".json")).length, requests.length);
  for (const value of requests) {
    const backup = verifiedBackup(await f.service.download(value.repairId, signal()), f.reader.characterId, value.repairId);
    assert.equal(backup.data.raw, before);
  }
  assert.equal(JSON.stringify(f.current()), before);
});
test("I5：空或殘缺 owner 等待補完整，活程序鎖不被回收，取消不新增備份", async t => {
  for (const initial of ["", '{"pid":']) {
    await t.test(initial === "" ? "空 owner" : "殘缺 owner", async child => {
      const f = await fixture(child), request = await requestFor(f.reader);
      const lockPath = join(f.directory, ".write-lock"), ownerPath = join(lockPath, "owner");
      await mkdir(lockPath, { recursive: true, mode: 0o700 });
      await writeFile(ownerPath, initial, { mode: 0o600 });
      const controller = new AbortController();
      const completion = f.service.prepare(request, controller.signal).then(
        value => ({ status: "ready" as const, value }), error => ({ status: "failed" as const, error }));
      const observe = () => Promise.race([completion, delay(150).then(() => ({ status: "waiting" as const }))]);
      try {
        assert.equal((await observe()).status, "waiting", "不完整 owner 不應即時失敗");
        assert.equal(await readFile(ownerPath, "utf8"), initial, "不能改寫不明擁有者的鎖");
        const owner = JSON.stringify({ pid: process.pid, host: hostname(), token: randomUUID() });
        await writeFile(ownerPath, owner);
        assert.equal((await observe()).status, "waiting", "owner 補完整後仍不能搶活程序的鎖");
        controller.abort();
        assert.equal((await completion).status, "failed");
        assert.equal(await readFile(ownerPath, "utf8"), owner, "取消不能刪除其他擁有者的鎖");
        assert.equal((await readdir(f.directory)).filter(n => n.endsWith(".json")).length, 0);
      } finally { controller.abort(); await completion; }
    });
  }
});
test("I5：永久殘缺 owner 到原有 25 秒期限才拒絕，保留鎖及舊備份", async t => {
  const f = await fixture(t), request = await requestFor(f.reader);
  await f.service.prepare(request, signal());
  const originalBackup = await f.service.download(request.repairId, signal());
  const lockPath = join(f.directory, ".write-lock"), ownerPath = join(lockPath, "owner");
  await mkdir(lockPath, { mode: 0o700 });
  const partial = '{"pid":';
  await writeFile(ownerPath, partial, { mode: 0o600 });
  const started = Date.now();
  await assert.rejects(f.service.prepare({ ...request, repairId: randomUUID() }, signal()), failure("unavailable"));
  assert.ok(Date.now() - started >= 25_000, "不能因 JSON 解析失敗提早拒絕");
  assert.equal(await readFile(ownerPath, "utf8"), partial);
  assert.equal(await f.service.download(request.repairId, signal()), originalBackup);
  assert.equal((await readdir(f.directory)).filter(n => n.endsWith(".json")).length, 1);
});
test("重新建立服務可取回舊 Memory 備份，但同一原稿也不是新程序授權", async t => {
  const f = await fixture(t), request = await requestFor(f.reader);
  const ready = await f.service.prepare(request, signal());
  const restarted = createRepairPreparationService(f.reader, new FileRepairArchive(f.directory));
  const found = await restarted.lookup(request.repairId, signal());
  assert.equal(found.sameRuntime, false); assert.equal(ready.sameRuntime, true);
  assert.equal(await restarted.download(request.repairId, signal()), await f.service.download(request.repairId, signal()));
  assert.equal((await restarted.list(null, signal())).records[0]!.sameRuntime, false);
});
test("過期指紋與不支援規則拒絕，沒有生成備份或初始化目錄", async t => {
  const f = await fixture(t), request = await requestFor(f.reader); f.mutate();
  await assert.rejects(f.service.prepare(request, signal()), failure("stale"));
  await assert.rejects(readdir(f.directory), { code: "ENOENT" });
  const app = Fastify(); registerRepairPreparationRoutes(app, f.service); t.after(() => app.close());
  assert.equal((await app.inject({ method: "POST", url: "/api/repair-preparations", payload: { ...request, rulesVersion: 2 } })).statusCode, 400);
  assert.equal((await app.inject("/api/repair-preparations?characterId=OTHER")).statusCode, 400);
  assert.equal((await app.inject(`/api/repair-preparations/${request.repairId}?path=outside`)).statusCode, 400);
  assert.equal((await app.inject({ method: "POST", url: `/api/repair-preparations/${request.repairId}/apply` })).statusCode, 404);
});
test("容量與封裝上限拒絕新增，舊紀錄仍可查詢下載，來源不變", async t => {
  const f = await fixture(t), request = await requestFor(f.reader); await f.service.prepare(request, signal());
  const tinyArchive = new FileRepairArchive(f.directory, 32 * 1024 * 1024, 1);
  const service = createRepairPreparationService(f.reader, tinyArchive);
  const before = JSON.stringify(f.current());
  await assert.rejects(service.prepare({ ...request, repairId: randomUUID() }, signal()), failure("capacity"));
  assert.ok(await service.download(request.repairId, signal())); assert.equal(JSON.stringify(f.current()), before);
  const small = createRepairPreparationService(f.reader, f.archive, 64);
  await assert.rejects(small.prepare({ ...request, repairId: randomUUID() }, signal()), failure("too-large"));
});
test("損壞與符號連結不被宣告就緒，不洩露路徑或原稿", async t => {
  const f = await fixture(t), request = await requestFor(f.reader); await f.service.prepare(request, signal());
  const file = join(f.directory, `${request.repairId}.json`);
  const text = await readFile(file, "utf8");
  for (const corrupt of [text.replace('in-combat', 'outside-combat'), "{", "{}"]) {
    await writeFile(file, corrupt);
    await assert.rejects(f.service.lookup(request.repairId, signal()), failure("unavailable"));
    await assert.rejects(f.service.download(request.repairId, signal()), failure("unavailable"));
    await assert.rejects(f.service.list(null, signal()), failure("unavailable"));
  }
  await rm(file); await symlink(join(f.parent, "secret"), file); await writeFile(join(f.parent, "secret"), text);
  await assert.rejects(f.service.lookup(request.repairId, signal()));
  const app = Fastify(); registerRepairPreparationRoutes(app, f.service); t.after(() => app.close());
  const response = await app.inject(`/api/repair-preparations/${request.repairId}/backup`);
  assert.equal(response.statusCode, 503); assert.doesNotMatch(response.body, /phase31-|narrativeLedger|secret/);
});
test("I2：無效 UTF-8 統一回 unavailable，不提供原稿、不改寫損壞備份", async t => {
  const f = await fixture(t), request = await requestFor(f.reader);
  await f.service.prepare(request, signal());
  const file = join(f.directory, `${request.repairId}.json`), original = await readFile(file);
  const corrupt = Buffer.from(original), middle = Math.floor(corrupt.length / 2);
  corrupt[middle] = 0xff; corrupt[middle + 1] = 0xfe;
  await writeFile(file, corrupt);
  await assert.rejects(f.archive.get(request.repairId, f.reader.characterId, signal()), failure("unavailable"));
  await assert.rejects(f.service.lookup(request.repairId, signal()), failure("unavailable"));
  await assert.rejects(f.service.download(request.repairId, signal()), failure("unavailable"));
  await assert.rejects(f.service.list(null, signal()), failure("unavailable"));
  const app = Fastify(); registerRepairPreparationRoutes(app, f.service); t.after(() => app.close());
  for (const url of [`/api/repair-preparations/${request.repairId}`, `/api/repair-preparations/${request.repairId}/backup`, "/api/repair-preparations"]) {
    const response = await app.inject(url);
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().code, "unavailable");
    assert.equal(response.headers["cache-control"], "no-store");
    assert.doesNotMatch(response.body, /TypeError|TextDecoder|phase31-|narrativeLedger|TEST-character|stack/);
  }
  assert.deepEqual(await readFile(file), corrupt);
  await writeFile(file, original);
  assert.equal(await f.service.download(request.repairId, signal()), original.toString("utf8"));
});
test("回應遺失仍可查詢同份備份，不重送保存；取消前無發布也不冒稱撤銷", async t => {
  const f = await fixture(t), request = await requestFor(f.reader);
  const loseReply: RepairArchive = { get: f.archive.get.bind(f.archive), list: f.archive.list.bind(f.archive),
    async put(text, characterId, requestSignal) { await f.archive.put(text, characterId, requestSignal); throw new Error("reply lost"); } };
  const service = createRepairPreparationService(f.reader, loseReply);
  await assert.rejects(service.prepare(request, signal()));
  assert.equal((await service.lookup(request.repairId, signal())).status, "ready");
  assert.equal((await service.prepare(request, signal())).repairId, request.repairId);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(service.prepare({ ...request, repairId: randomUUID() }, controller.signal));
  await assert.rejects(service.lookup(randomUUID(), signal()), failure("not-found"));
});
test("配置角色與同長度 byte 變動都影響指紋", async t => {
  const f = await fixture(t), raw = JSON.stringify(f.current());
  assert.notEqual(repairFingerprint(f.reader, "current", raw), repairFingerprint({ ...f.reader, characterId: "OTHER-character" }, "current", raw));
  assert.notEqual(repairFingerprint(f.reader, "current", raw), repairFingerprint(f.reader, "current", raw.replace("TEST-character", "TEST-charactes")));
});
test("外角色合法槽仍可唯讀預覽，但準備拒絕；同角色舊 Run 可以準備", async t => {
  const f = await fixture(t), seed = createTestGameState();
  const saved = createSaveSnapshot(seed).state;
  const foreign: typeof saved = { ...saved, activity: "in-combat", character: { ...saved.character, id: "OTHER-character" },
    phase26: { ...saved.phase26!, characters: saved.phase26!.characters.map(c => c.characterId === seed.character.id ? { ...c, characterId: "OTHER-character" } : c) } };
  let snapshot: typeof saved = foreign;
  const reader = createMemoryRepairReader(seed.character.id, () => ({ current: undefined,
    slots: [{ slotId: 1, formatVersion: 2, sourceRevision: 0, savedAt: captureTime, snapshot }] }));
  const request = await requestFor(reader, 1), service = createRepairPreparationService(reader, f.archive);
  await assert.rejects(service.prepare(request, signal()), failure("identity-conflict"));
  snapshot = { ...foreign, character: saved.character, phase26: { ...saved.phase26!, runId: "OLD-run", worldId: "OTHER-world",
    encounters: saved.phase26!.encounters.map(e => ({ ...e, worldId: "OTHER-world" })) } };
  const own = await requestFor(reader, 1); assert.equal((await service.prepare(own, signal())).source, 1);
});
test("分頁只列配置角色，損壞／暫存檔不作有效備份，空查詢不建立目錄", async t => {
  const f = await fixture(t); assert.deepEqual(await f.service.list(null, signal()), { records: [], nextCursor: null });
  await assert.rejects(readdir(f.directory), { code: "ENOENT" });
  const request = await requestFor(f.reader);
  for (let index = 0; index < 21; index++) await f.service.prepare({ ...request, repairId: randomUUID() }, signal());
  await writeFile(join(f.directory, "unfinished.tmp"), "{");
  const page = await f.service.list(null, signal()); assert.equal(page.records.length, 20); assert.ok(page.nextCursor);
  const second = await f.service.list(page.nextCursor, signal()); assert.equal(second.records.length, 1); assert.equal(second.nextCursor, null);
  assert.equal(new Set([...page.records, ...second.records].map(r => r.repairId)).size, 21);
});
test("不合作 reader 也有 HTTP 等待上限，沒有無限等待或自動保存", async t => {
  const f = await fixture(t), request = await requestFor(f.reader);
  const service = createRepairPreparationService({ ...f.reader, read: () => new Promise(() => {}) }, f.archive);
  const app = Fastify(); registerRepairPreparationRoutes(app, service, 32 * 1024 * 1024, 20); t.after(() => app.close());
  const response = await app.inject({ method: "POST", url: "/api/repair-preparations", payload: request });
  assert.equal(response.statusCode, 503); assert.doesNotMatch(response.body, /snapshot/);
});
test("前端完整校驗下載，內容變動拒絕；準備回應遺失不自動重試", async t => {
  const f = await fixture(t), request = await requestFor(f.reader), result = await f.service.prepare(request, signal());
  const text = await f.service.download(request.repairId, signal());
  const response = (value: string) => new Response(value, { headers: { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(value)), "X-Repair-Backup-Max-Bytes": String(32 * 1024 * 1024) } });
  assert.equal((await loadPreparationBackup(result, signal(), async () => response(text))).text, text);
  await assert.rejects(loadPreparationBackup(result, signal(), async () => response(text.replace("in-combat", "outside-combat"))));
  let calls = 0; await assert.rejects(prepareRepair(request, signal(), async () => { calls++; throw new Error("lost"); })); assert.equal(calls, 1);
  const html = renderToStaticMarkup(createElement(RepairPreparationSummaryView, { record: { ...result, sameRuntime: false }, stale: true }));
  assert.match(html, /修復前備份已保存/); assert.match(html, /備份時的修復候選/); assert.match(html, /舊 Memory/); assert.match(html, /原稿/); assert.doesNotMatch(html, /套用按鈕/);
});

const pgOptions = { skip: !process.env.TEST_DATABASE_URL && "需提供隔離 TEST_DATABASE_URL。" };
async function postgresFixture(t: TestContext) {
  const base = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL }), schema = `phase31_${randomUUID().replaceAll("-", "")}`;
  await base.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(process.env.TEST_DATABASE_URL!); url.searchParams.set("options", `-c search_path=${schema}`);
  const writer = createRepairArchivePool(url.href), readonly = createPostgresDiagnosticsPool(url.href);
  t.after(async () => { await readonly.end(); await writer.end(); await base.query(`DROP SCHEMA ${schema} CASCADE`); await base.end(); });
  const { runner: migrate } = await import("node-pg-migrate");
  // Use the actual migration through the runner; only this isolated schema may be modified.
  await migrate({ databaseUrl: url.href, dir: "migrations", direction: "up", migrationsTable: "pgmigrations", migrationsSchema: schema, schema, count: Infinity, log: () => {} });
  const reader = createPostgresRepairReader(readonly, "TEST-character"), archive = new PostgresRepairArchive(writer);
  return { writer, reader, archive, service: createRepairPreparationService(reader, archive) };
}
test("PG 同 ID 並行一次持久保存、重啟取回、微秒原稿及遊戲列不變", pgOptions, async t => {
  const f = await postgresFixture(t), seed = createTestGameState();
  await f.writer.query("INSERT INTO save_slots VALUES (1,2,0,$1,'2026-10-02T00:00:00.123456Z')", [JSON.stringify({ ...createSaveSnapshot(seed).state, activity: "in-combat" })]);
  const before = (await f.reader.read(1, 10 * 1024 * 1024, signal())).raw!;
  assert.match(before, /123456/);
  const request = await requestFor(f.reader, 1);
  const results = await Promise.all(Array.from({ length: 6 }, () => f.service.prepare(request, signal())));
  results.forEach(r => assert.deepEqual(r, results[0]));
  assert.equal((await f.writer.query("SELECT count(*) FROM repair_preparations")).rows[0].count, "1");
  assert.equal((await f.reader.read(1, 10 * 1024 * 1024, signal())).raw, before);
  assert.equal((await f.writer.query("SELECT count(*) FROM game_states")).rows[0].count, "0");
  const restarted = createRepairPreparationService(f.reader, new PostgresRepairArchive(f.writer));
  assert.equal((await restarted.lookup(request.repairId, signal())).sameRuntime, true);
  assert.equal(verifiedBackup(await restarted.download(request.repairId, signal()), seed.character.id).data.raw, before);
});
test("PG 容量拒絕及損壞零遊戲寫入，不洩漏內部錯誤", pgOptions, async t => {
  const f = await postgresFixture(t), { revision, ...snapshot } = broken();
  await f.writer.query("INSERT INTO game_states VALUES ('TEST-character',$1,$2)", [revision, JSON.stringify(snapshot)]);
  const request = await requestFor(f.reader), limited = createRepairPreparationService(f.reader, new PostgresRepairArchive(f.writer, 32 * 1024 * 1024, 1));
  await assert.rejects(limited.prepare(request, signal()), failure("capacity"));
  assert.equal((await f.writer.query("SELECT count(*) FROM repair_preparations")).rows[0].count, "0");
  await f.service.prepare(request, signal());
  await f.writer.query("UPDATE repair_preparations SET backup_text='{}'");
  const app = Fastify(); registerRepairPreparationRoutes(app, f.service); t.after(() => app.close());
  const response = await app.inject(`/api/repair-preparations/${request.repairId}`);
  assert.equal(response.statusCode, 503); assert.doesNotMatch(response.body, /SELECT|backup_text|postgres:\/\//);
  assert.equal((await f.writer.query("SELECT snapshot FROM game_states")).rows[0].snapshot.activity, "in-combat");
});
