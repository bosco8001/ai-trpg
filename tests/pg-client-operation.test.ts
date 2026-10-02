import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { randomUUID } from "node:crypto";
import { setImmediate as nextTurn } from "node:timers/promises";
import pg, { type Pool, type PoolClient } from "pg";
import { withPgClient, type PgClientErrorReporter } from "../src/server/pg-client-operation.js";
import { PostgresRepairArchive } from "../src/server/postgres-repair-archive.js";
import { createPostgresRepairReader } from "../src/server/repair-preview-reader.js";
import { createPostgresBackupReader } from "../src/server/postgres-raw-data-backup.js";
import { PreparationFailure, makeRepairBackup, sha256 } from "../src/server/repair-archive.js";
import { RawBackupFailure } from "../src/server/raw-data-backup.js";
import { analyzeRepairRecord } from "../src/server/repair-preview.js";
import { createTestGameState } from "../src/server/test-game-state.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function fixture(t: TestContext) {
  const releases: (boolean | Error | undefined)[] = [];
  const idleError = () => {};
  const client = Object.assign(new pg.Client(), {
    release(destroy?: boolean | Error) {
      releases.push(destroy);
      // Simulate pg-pool taking over error handling at release, before our listener is removed.
      if (!client.listeners("error").includes(idleError)) client.on("error", idleError);
    },
  });
  const pool = new pg.Pool();
  t.mock.method(pool, "connect", async () => { client.removeListener("error", idleError); return client; });
  t.after(() => pool.end());
  return { pool, client, releases };
}
const signal = () => new AbortController().signal;
const unavailable = () => new PreparationFailure("unavailable");
const preparationFailure = (error: unknown) => error instanceof PreparationFailure && error.code === "unavailable";
const backupFailure = (error: unknown) => error instanceof RawBackupFailure && error.code === "unavailable";

test("I3：正常歸還移除操作 listener，保留 pool 的錯誤接管", async t => {
  const f = fixture(t);
  let reports = 0;
  const result = await withPgClient(f.pool, signal(), unavailable, async client => {
    assert.equal(client, f.client);
    assert.equal(client.listenerCount("error"), 1);
    return 42;
  }, () => { reports++; });
  assert.equal(result, 42);
  assert.deepEqual(f.releases, [false]);
  assert.equal(f.client.listenerCount("error"), 1);
  assert.doesNotThrow(() => f.client.emit("error", new Error("idle disconnect")));
  assert.deepEqual(f.releases, [false]);
  assert.equal(reports, 0);
});

test("I3：借出期間無 active query 也接住斷線，只丟棄一次，不回傳成功", { timeout: 2000 }, async t => {
  const f = fixture(t), entered = deferred<void>(), finish = deferred<number>();
  const reports: unknown[][] = [];
  const operation = withPgClient(f.pool, signal(), unavailable, async () => {
    entered.resolve(); return finish.promise;
  }, (...args) => { assert.deepEqual(f.releases, [true]); reports.push(args); });
  const rejected = assert.rejects(operation, preparationFailure);
  await entered.promise;
  assert.doesNotThrow(() => f.client.emit("error", new Error("SECRET SQL / path / story / connection string")));
  assert.doesNotThrow(() => f.client.emit("error", new Error("second disconnect")));
  await rejected;
  finish.resolve(42);
  assert.deepEqual(f.releases, [true]);
  assert.equal(f.client.listenerCount("error"), 1);
  assert.deepEqual(reports, [[]]);
});

const operations = [
  { name: "Phase 31 備份查詢", run: (pool: Pool, requestSignal: AbortSignal, report?: PgClientErrorReporter) => new PostgresRepairArchive(pool, undefined, undefined, report).get(randomUUID(), "TEST-character", requestSignal), check: preparationFailure },
  { name: "Phase 30 候選來源", run: (pool: Pool, requestSignal: AbortSignal, report?: PgClientErrorReporter) => createPostgresRepairReader(pool, "TEST-character", report).read("current", 10 * 1024 * 1024, requestSignal), check: backupFailure },
  { name: "Phase 29 原始備份", run: (pool: Pool, requestSignal: AbortSignal, report?: PgClientErrorReporter) => createPostgresBackupReader(pool, "TEST-character", report).capture(10 * 1024 * 1024, requestSignal), check: backupFailure },
];
for (const operation of operations) {
  test(`I3：${operation.name} 的借出 client error 轉為 unavailable`, { timeout: 2000 }, async t => {
    const f = fixture(t), entered = deferred<void>(), query = deferred<{ rows: never[] }>();
    const reports: unknown[][] = [];
    t.mock.method(f.client, "query", () => { entered.resolve(); return query.promise; });
    const rejected = assert.rejects(Promise.resolve(operation.run(f.pool, signal(), (...args) => { reports.push(args); })), operation.check);
    await entered.promise;
    try {
      // The emission itself must not throw: this is the original unhandled 'error' symptom.
      assert.doesNotThrow(() => f.client.emit("error", new Error("Connection terminated unexpectedly")));
      await rejected;
      assert.deepEqual(f.releases, [true]);
      assert.equal(f.client.listenerCount("error"), 1);
      assert.deepEqual(reports, [[]]);
    } finally {
      // pg can reject its query on the next tick, after emitting the client error.
      query.reject(new Error("late query rejection"));
      await nextTurn();
    }
  });
  test(`I3：${operation.name} 取得連線失敗也回 unavailable`, async t => {
    const f = fixture(t);
    t.mock.method(f.pool, "connect", async () => { throw new Error("private connection details"); });
    await assert.rejects(Promise.resolve(operation.run(f.pool, signal())), operation.check);
    assert.deepEqual(f.releases, []);
  });
}

test("I3：取消與 error 競爭只丟棄一次，不能將借出連線歸還重用", { timeout: 2000 }, async t => {
  const f = fixture(t), entered = deferred<void>(), controller = new AbortController();
  let reports = 0;
  const rejected = assert.rejects(withPgClient(f.pool, controller.signal, unavailable, async () => {
    entered.resolve(); return new Promise<never>(() => {});
  }, () => { reports++; }), preparationFailure);
  await entered.promise;
  controller.abort();
  assert.doesNotThrow(() => f.client.emit("error", new Error("disconnect after abort")));
  await rejected;
  assert.deepEqual(f.releases, [true]);
  assert.equal(f.client.listenerCount("error"), 1);
  assert.equal(reports, 0);
});

test("I3：連線取得期間取消，取得後不開始操作並丟棄；domain 故障保持原類別", async t => {
  const f = fixture(t), acquired = deferred<PoolClient>(), controller = new AbortController();
  t.mock.method(f.pool, "connect", () => acquired.promise);
  let called = false;
  const rejected = assert.rejects(withPgClient(f.pool, controller.signal, unavailable, async () => { called = true; }), preparationFailure);
  controller.abort(); acquired.resolve(f.client);
  await rejected;
  assert.equal(called, false); assert.deepEqual(f.releases, [true]);
  const other = fixture(t), capacity = new PreparationFailure("capacity");
  let reports = 0;
  await assert.rejects(withPgClient(other.pool, signal(), unavailable, async () => { throw capacity; }, () => { reports++; }), error => error === capacity);
  assert.deepEqual(other.releases, [true]);
  assert.equal(reports, 0);
});

for (const mode of ["throws", "rejects"] as const) {
  test(`I3：日誌回呼 ${mode} 仍安全拒絕、單次丟棄及移除 listener`, { timeout: 2000 }, async t => {
    const f = fixture(t), entered = deferred<void>();
    let reports = 0;
    const rejected = assert.rejects(withPgClient(f.pool, signal(), unavailable, async () => {
      entered.resolve(); return new Promise<never>(() => {});
    }, () => {
      reports++;
      if (mode === "throws") throw new Error("logger unavailable");
      return Promise.reject(new Error("logger rejected"));
    }), preparationFailure);
    await entered.promise;
    assert.doesNotThrow(() => f.client.emit("error", new Error("disconnect")));
    await rejected;
    await nextTurn();
    assert.equal(reports, 1);
    assert.deepEqual(f.releases, [true]);
    assert.equal(f.client.listenerCount("error"), 1);
  });
}

test("I3：COMMIT 回應遺失不能宣告撤銷或重送，可用新連線查同一 ID", { timeout: 2000 }, async t => {
  const f = fixture(t), committing = deferred<void>(), seed = createTestGameState();
  const { revision, ...snapshot } = { ...seed, activity: "in-combat" as const };
  const raw = JSON.stringify({ character_id: seed.character.id, revision, snapshot });
  const reader = createPostgresRepairReader(f.pool, seed.character.id);
  const capturedAt = "2026-10-02T00:00:00.000Z";
  const candidate = analyzeRepairRecord(reader, "current", { capturedAt, raw });
  assert.equal(candidate.status, "candidate");
  const id = randomUUID(), text = makeRepairBackup({ repairId: id, source: "current", storage: "postgres",
    previewVersion: 1, rulesVersion: 1, fingerprint: candidate.fingerprint!, candidateFingerprint: candidate.candidateFingerprint!,
    characterId: seed.character.id, runtimeId: null, capturedAt, preparedAt: capturedAt, revision, formatVersion: 2,
    changes: candidate.changes, raw }, 32 * 1024 * 1024);
  let stored: string | null = null, inserts = 0, commits = 0, reports = 0;
  t.mock.method(f.client, "query", (sql: string) => {
    if (sql.startsWith("SELECT CASE")) return Promise.resolve({ rows: stored === null ? [] : [{ backup_text: stored }] });
    if (sql.includes("AS used")) return Promise.resolve({ rows: [{ used: "0" }] });
    if (sql.startsWith("INSERT")) { inserts++; stored = text; }
    if (sql === "COMMIT") { commits++; committing.resolve(); return new Promise<never>(() => {}); }
    return Promise.resolve({ rows: [] });
  });
  const rejected = assert.rejects(new PostgresRepairArchive(f.pool, undefined, undefined, () => { reports++; }).put(text, seed.character.id, signal()), preparationFailure);
  await committing.promise;
  assert.doesNotThrow(() => f.client.emit("error", new Error("lost COMMIT response")));
  await rejected;
  assert.equal(inserts, 1); assert.equal(commits, 1); assert.deepEqual(f.releases, [true]);
  assert.equal(reports, 1);
  const recovery = fixture(t);
  t.mock.method(recovery.client, "query", () => Promise.resolve({ rows: [{ backup_text: stored }] }));
  const found = await new PostgresRepairArchive(recovery.pool).get(id, seed.character.id, signal());
  assert.equal(found, text); assert.equal(sha256(found!), sha256(text));
  assert.equal(inserts, 1); assert.equal(commits, 1);
});
