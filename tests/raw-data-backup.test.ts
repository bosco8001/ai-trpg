import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { createHash, randomUUID } from "node:crypto";
import pg from "pg";
import Fastify from "fastify";
import { buildApp } from "../src/server/app.js";
import { createDomainSession } from "../src/server/domain-session.js";
import { createTestGameState } from "../src/server/test-game-state.js";
import { InMemorySaveGameRepository } from "../src/server/save-game/memory-repository.js";
import { createSaveSnapshot } from "../src/server/save-game/service.js";
import { backupMaxBytes, boundedJson, createMemoryBackupReader, encodeRawBackup, registerRawBackupRoute } from "../src/server/raw-data-backup.js";
import { createPostgresBackupReader } from "../src/server/postgres-raw-data-backup.js";
import { createPostgresDiagnosticsPool } from "../src/server/postgres-data-diagnostics.js";
import { parseRawBackup, type RawBackupPayload } from "../src/shared/raw-data-backup.js";
import { loadRawBackup } from "../src/web/raw-data-backup.js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "../src/web/App.js";
import { applyCommand, type GameState } from "../src/domain/game.js";
import { advanceCombatTurn, applyCombatDamage, startCasting, startCombat } from "../src/domain/combat.js";
import { PHASE22_TEST_COMBAT_PARTICIPANTS } from "../src/server/combat/fixtures.js";
import { createPhase22CombatFixtureRoller } from "../src/server/combat/dice.js";

function decoded(text: string) {
  const result = parseRawBackup(JSON.parse(text));
  assert.equal(createHash("sha256").update(result.backup.payload).digest("hex"), result.backup.checksum.value);
  return result.payload;
}
function response(text: string, max = 10 * 1024 * 1024) {
  return new Response(text, { headers: { "Content-Type": "application/json", "X-Backup-Max-Bytes": String(max),
    "Content-Length": String(Buffer.byteLength(text)) } });
}
function payload(): RawBackupPayload {
  return { storage: "memory", capturedAt: "2026-10-01T00:00:00.000Z", characterId: "TEST-character",
    current: '{"original":9007199254740993,"value":1.234567890123456789}',
    slots: [{ slotId: 1, record: '{"formatVersion":99,"snapshot":{"hp":-5}}' },
      { slotId: 2, record: null }, { slotId: 3, record: null }] };
}

test("memory download keeps current infrastructure, original saves and all sources unchanged", async t => {
  const session = createDomainSession(createTestGameState());
  const repository = new InMemorySaveGameRepository(() => session.getState());
  const first = await session.reserveNarrative("system");
  assert.ok(first); await session.appendNarrative(first, "原本故事", "fallback");
  const state = session.getState();
  await repository.writeIfLiveRevision(1, createSaveSnapshot(state), { characterId: state.character.id, expectedRevision: 0 });
  const second = await session.reserveNarrative("system");
  assert.ok(second); await session.appendNarrative(second, "讀檔後不再顯示的故事", "fallback");
  assert.equal((await session.replaceContents(0, createSaveSnapshot(state).state)).ok, true);
  const before = structuredClone({ state: session.getState(), records: repository.readAllForBackup() });
  assert.equal(before.state.phase26!.history.length, 1);
  assert.equal(before.state.phase26!.narrativeLedger.length, 2);
  const app = await buildApp({ domainSession: session, saveGameRepository: repository }); t.after(() => app.close());
  for (let i = 0; i < 3; i++) {
    const result = await app.inject("/api/raw-data-backup");
    assert.equal(result.statusCode, 200, result.body);
    assert.equal(result.headers["cache-control"], "no-store");
    assert.match(String(result.headers["content-disposition"]), /^attachment; filename="ai-trpg-backup-/);
    assert.equal(Number(result.headers["content-length"]), Buffer.byteLength(result.body));
    const exported = decoded(result.body);
    assert.deepEqual(JSON.parse(exported.current!), before.state);
    assert.ok(JSON.parse(exported.current!).phase26.narrativeLedger);
    assert.deepEqual(JSON.parse(exported.slots[0]!.record!), before.records[0]);
    assert.equal(exported.slots[1]!.record, null);
    assert.deepEqual({ state: session.getState(), records: repository.readAllForBackup() }, before);
  }
  assert.equal((await app.inject({ method: "POST", url: "/api/raw-data-backup" })).statusCode, 404);
  assert.equal((await app.inject("/api/raw-data-backup?characterId=someone-else")).statusCode, 400);
});

test("raw invalid, unsupported and absent records are copied without invoking domain hydration", async t => {
  const raw = { current: { character: { id: "FORMAL-legacy" }, hp: -999 },
    slots: [{ slotId: 1 as const, formatVersion: 99, snapshot: { value: -5 }, savedAt: "bad-date" }] };
  const before = structuredClone(raw);
  const reader = createMemoryBackupReader("configured-character", () => raw);
  const app = await buildApp({ backupReader: reader,
    domainSession: { ...createDomainSession(createTestGameState()), getState() { throw new Error("must not initialize"); } } });
  t.after(() => app.close());
  const result = await app.inject("/api/raw-data-backup");
  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(decoded(result.body).current!), raw.current);
  assert.deepEqual(raw, before);
  const absent = createMemoryBackupReader("configured-character", () => ({ current: undefined, slots: [] }));
  const empty = decoded(encodeRawBackup(await absent.capture(10240, new AbortController().signal), 10240));
  assert.equal(empty.current, null);
  assert.deepEqual(empty.slots.map(slot => slot.record), [null, null, null]);
});

test("memory snapshot is detached before subsequent gameplay and slot changes", async () => {
  const source = { current: { hp: 10 }, slots: [{ slotId: 1 as const, snapshot: { hp: 10 } }] };
  const reader = createMemoryBackupReader("TEST-character", () => source);
  const capture = reader.capture(10240, new AbortController().signal);
  source.current.hp = 9; source.slots[0]!.snapshot.hp = 9;
  const exported = await capture;
  assert.equal(JSON.parse(exported.current!).hp, 10);
  assert.equal(JSON.parse(exported.slots[0]!.record!).snapshot.hp, 10);
});

test("active, casting, ended and Game Over backups preserve complete gameplay without settlement", async t => {
  function stateOf(result: { ok: boolean; state?: GameState }): GameState {
    assert.ok(result.ok); assert.ok(result.state); return result.state;
  }
  const equipped = stateOf(applyCommand(createTestGameState(), { type: "set-equipped-skills", skillIds: ["TEST-skill-2"], expectedRevision: 0 }));
  const started = stateOf(startCombat(equipped, { expectedRevision: 1 }, PHASE22_TEST_COMBAT_PARTICIPANTS, createPhase22CombatFixtureRoller("normal")));
  const advanced = stateOf(advanceCombatTurn(started, { expectedRevision: 2 }));
  const casting = stateOf(startCasting(advanced, { expectedRevision: 3, skillId: "TEST-skill-2" }));
  const damage = (state: GameState, targetId: string, amount: number) => stateOf(applyCombatDamage(state, { expectedRevision: state.revision, targetId, amount }));
  const ended = damage(damage(casting, "TEST-enemy-1", 6), "TEST-enemy-2", 6);
  const gameOver = damage(damage(started, "TEST-companion-1", 8), "TEST-player", 10);
  for (const state of [started, casting, ended, gameOver]) {
    const session = createDomainSession(state), before = structuredClone(state);
    const app = await buildApp({ domainSession: session }); t.after(() => app.close());
    for (let i = 0; i < 2; i++) {
      const result = await app.inject("/api/raw-data-backup");
      assert.equal(result.statusCode, 200, result.body);
      assert.deepEqual(JSON.parse(decoded(result.body).current!), before);
      assert.deepEqual(session.getState(), before);
    }
  }
});

test("full UTF-8 envelope boundary includes escaping and checksum; oversize never truncates", async t => {
  const raw = { ...payload(), current: JSON.stringify({ text: '中文"\n'.repeat(12) }) };
  const text = encodeRawBackup(raw, 10000), exact = Buffer.byteLength(text);
  assert.equal(encodeRawBackup(raw, exact), text);
  assert.throws(() => encodeRawBackup(raw, exact - 1), /too-large/);
  assert.throws(() => boundedJson({ text: "字".repeat(1000) }, 100), /too-large/);
  assert.equal(backupMaxBytes(undefined), 10485760);
  for (const value of ["0", "-1", "1.5", "x", "9007199254740992"]) assert.throws(() => backupMaxBytes(value));
  const app = await buildApp({ backupReader: { capture: () => raw }, backupMaxBytes: exact - 1 }); t.after(() => app.close());
  const result = await app.inject("/api/raw-data-backup");
  assert.equal(result.statusCode, 413);
  assert.equal(result.headers["content-disposition"], undefined);
  assert.doesNotMatch(result.body, /payload|checksum|original/);
});

test("reader failure and server deadline fail the entire download without internal details", async t => {
  for (const capture of [() => { throw new Error("postgres://private SELECT password"); },
    (_max: number, signal: AbortSignal) => new Promise<RawBackupPayload>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("deadline")), { once: true });
    })]) {
    const app = Fastify(); registerRawBackupRoute(app, { capture }, 10240, 25); t.after(() => app.close());
    const result = await app.inject("/api/raw-data-backup");
    assert.equal(result.statusCode, 503);
    assert.equal(result.headers["content-disposition"], undefined);
    assert.doesNotMatch(result.body, /private|password|SELECT|payload|deadline/);
  }
});

test("backup contract rejects partial, reordered, malformed and future envelopes", () => {
  const envelope = JSON.parse(encodeRawBackup(payload(), 10000));
  for (const value of [{ ...envelope, backupFormatVersion: 2 }, { ...envelope, extra: true },
    { ...envelope, checksum: { ...envelope.checksum, value: "bad" } },
    { ...envelope, payload: JSON.stringify({ ...payload(), slots: payload().slots.slice(0, 2) }) },
    { ...envelope, payload: JSON.stringify({ ...payload(), slots: [...payload().slots].reverse() }) },
    { ...envelope, payload: JSON.stringify({ ...payload(), current: "broken" }) }]) assert.throws(() => parseRawBackup(value));
});

test("client verifies checksum, source precision and declared limits before returning a downloadable file", async () => {
  const raw = payload(), text = encodeRawBackup(raw, 10000);
  const signal = new AbortController().signal;
  const result = await loadRawBackup(signal, async (url, options) => {
    assert.equal(url, "/api/raw-data-backup"); assert.equal(options?.method, "GET");
    assert.equal(options?.cache, "no-store"); assert.equal(options?.signal, signal);
    return response(text);
  });
  assert.equal(result.text, text);
  assert.equal(result.payload.current, raw.current);
  assert.match(result.filename, /^ai-trpg-backup-.*\.json$/);
  const changed = JSON.parse(text); changed.payload = changed.payload.replace("-5", "-4");
  await assert.rejects(loadRawBackup(signal, async () => response(JSON.stringify(changed))), /校驗失敗/);
  await assert.rejects(loadRawBackup(signal, async () => response(text, 10)), /超過大小/);
  await assert.rejects(loadRawBackup(signal, async () => new Response("private", { status: 503 })), /手動重試/);
});

test("client rejects incomplete, excessive and malformed response bodies without retry", async () => {
  const text = encodeRawBackup(payload(), 10000), signal = new AbortController().signal;
  for (const headers of [{ "Content-Length": String(Buffer.byteLength(text) + 1) },
    { "Content-Length": String(Buffer.byteLength(text) - 1) }, { "X-Backup-Max-Bytes": "NaN" }]) {
    const res = response(text); for (const [key, value] of Object.entries(headers)) res.headers.set(key, value);
    let calls = 0;
    await assert.rejects(loadRawBackup(signal, async () => { calls++; return res; })); assert.equal(calls, 1);
  }
});

test("abort covers slow body reception after headers and cancels the stream", async () => {
  const controller = new AbortController(); let cancelled = false;
  const body = new ReadableStream<Uint8Array>({ start(stream) { stream.enqueue(new TextEncoder().encode("{")); },
    cancel() { cancelled = true; } });
  const res = new Response(body, { headers: response("{}").headers });
  const pending = loadRawBackup(controller.signal, async () => res);
  setTimeout(() => controller.abort(), 20);
  await assert.rejects(pending, /abort/i); assert.equal(cancelled, true);
});

test("recovery screen provides a backup action independently of state loading", () => {
  assert.match(renderToStaticMarkup(createElement(App)), /下載原始資料備份/);
});

const pgOptions = { skip: !process.env.TEST_DATABASE_URL && "需提供隔離 TEST_DATABASE_URL。" };
async function postgresFixture(t: TestContext) {
  const base = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const schema = "phase29_" + randomUUID().replaceAll("-", "");
  await base.query(`CREATE SCHEMA ${schema}`);
  const writer = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema}` });
  const url = new URL(process.env.TEST_DATABASE_URL!);
  url.searchParams.set("options", `-c search_path=${schema} -c default_transaction_read_only=off -c statement_timeout=0`);
  const readonly = createPostgresDiagnosticsPool(url.href);
  await writer.query("CREATE TABLE game_states (character_id text PRIMARY KEY, revision bigint, snapshot jsonb)");
  await writer.query("CREATE TABLE save_slots (slot_id integer PRIMARY KEY, format_version integer, source_revision bigint, snapshot jsonb, saved_at timestamptz)");
  t.after(async () => { await readonly.end(); await writer.end(); await base.query(`DROP SCHEMA ${schema} CASCADE`); await base.end(); });
  return { base, schema, writer, readonly, reader: createPostgresBackupReader(readonly, "TEST-character") };
}

test("PostgreSQL raw backup preserves invalid metadata, microseconds, huge numbers and unsupported versions", pgOptions, async t => {
  const { writer, reader, readonly } = await postgresFixture(t);
  assert.equal((await readonly.query("SHOW default_transaction_read_only")).rows[0].default_transaction_read_only, "on");
  const snapshot = '{"hp":-999,"schemaVersion":99,"precise":1.234567890123456789,"huge":9007199254740993}';
  await writer.query("INSERT INTO game_states VALUES ('TEST-character',9007199254740993,$1)", [snapshot]);
  await writer.query("INSERT INTO game_states VALUES ('OTHER-character',1,'{}')");
  await writer.query("INSERT INTO save_slots VALUES (1,-1,-9,$1,'2026-10-01 00:00:00.123456+00')", [snapshot]);
  const before = { current: (await writer.query("SELECT row_to_json(r)::text AS raw FROM game_states r WHERE character_id='TEST-character'")).rows[0].raw,
    slots: (await writer.query("SELECT row_to_json(r)::text AS raw FROM save_slots r ORDER BY slot_id")).rows };
  for (let i = 0; i < 3; i++) {
    const exported = await reader.capture(10000, new AbortController().signal);
    assert.equal(exported.current, before.current);
    assert.equal(exported.slots[0]!.record, before.slots[0].raw);
    assert.match(exported.current!, /9007199254740993|1\.234567890123456789/);
    assert.match(exported.slots[0]!.record!, /123456/);
    assert.doesNotMatch(encodeRawBackup(exported, 10000), /OTHER-character/);
  }
  assert.deepEqual((await writer.query("SELECT row_to_json(r)::text AS raw FROM save_slots r ORDER BY slot_id")).rows, before.slots);
});

test("PostgreSQL empty data stays empty; locks timeout, discard incomplete backup and recover", { ...pgOptions, timeout: 10000 }, async t => {
  const { writer, reader } = await postgresFixture(t);
  const app = await buildApp({ backupReader: reader, storage: "postgres" }); t.after(() => app.close());
  assert.equal(decoded((await app.inject("/api/raw-data-backup")).body).current, null);
  assert.equal((await writer.query("SELECT count(*) FROM game_states")).rows[0].count, "0");
  const lock = await writer.connect();
  try {
    await lock.query("BEGIN"); await lock.query("LOCK TABLE save_slots IN ACCESS EXCLUSIVE MODE");
    const start = performance.now(), failed = await app.inject("/api/raw-data-backup");
    assert.equal(failed.statusCode, 503);
    assert.ok(performance.now() - start < 5000);
    assert.equal(failed.headers["content-disposition"], undefined);
  } finally { await lock.query("ROLLBACK"); lock.release(); }
  assert.equal((await app.inject("/api/raw-data-backup")).statusCode, 200);
  assert.equal((await writer.query("SELECT count(*) FROM save_slots")).rows[0].count, "0");
});

test("PostgreSQL does not mix snapshots while another transaction changes current and slots", { ...pgOptions, timeout: 10000 }, async t => {
  const { base, schema, writer, reader } = await postgresFixture(t);
  await writer.query("INSERT INTO game_states VALUES ('TEST-character',1,'{\"marker\":1}')");
  await writer.query("INSERT INTO save_slots VALUES (1,2,1,'{\"marker\":1}',now())");
  const lock = await writer.connect();
  try {
    await lock.query("BEGIN"); await lock.query("LOCK TABLE save_slots IN ACCESS EXCLUSIVE MODE");
    const pending = reader.capture(10000, new AbortController().signal);
    // A split reader could read current first and then wait for slots. One SELECT
    // may wait for relation locks before acquiring its snapshot: both old or both new is valid.
    for (let i = 0; i < 100; i++) {
      const active = await base.query("SELECT count(*) FROM pg_stat_activity WHERE query LIKE '%WITH records AS%' AND wait_event_type='Lock' AND pid<>pg_backend_pid()");
      if (Number(active.rows[0].count) > 0) break;
      if (i === 99) assert.fail("backup never acquired its snapshot");
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    await lock.query(`UPDATE ${schema}.game_states SET revision=2,snapshot='{"marker":2}'`);
    await lock.query("UPDATE save_slots SET source_revision=2,snapshot='{\"marker\":2}'");
    await lock.query("COMMIT");
    const exported = await pending;
    const currentRevision = JSON.parse(exported.current!).revision;
    assert.ok(currentRevision === 1 || currentRevision === 2);
    assert.equal(JSON.parse(exported.slots[0]!.record!).source_revision, currentRevision);
    const latest = await reader.capture(10000, new AbortController().signal);
    assert.equal(JSON.parse(latest.current!).revision, 2);
    assert.equal(JSON.parse(latest.slots[0]!.record!).source_revision, 2);
  } finally { await lock.query("ROLLBACK"); lock.release(); }
});

test("PostgreSQL oversize transfer is refused and abort releases the blocked connection", { ...pgOptions, timeout: 10000 }, async t => {
  const { writer, reader, readonly } = await postgresFixture(t);
  await writer.query("INSERT INTO game_states VALUES ('TEST-character',1,$1)", [JSON.stringify({ text: "字".repeat(1000) })]);
  await assert.rejects(Promise.resolve(reader.capture(100, new AbortController().signal)), /too-large/);
  const lock = await writer.connect();
  try {
    await lock.query("BEGIN"); await lock.query("LOCK TABLE save_slots IN ACCESS EXCLUSIVE MODE");
    const controller = new AbortController(), pending = reader.capture(10000, controller.signal);
    setTimeout(() => controller.abort(), 50);
    await assert.rejects(Promise.resolve(pending));
    assert.equal(readonly.totalCount, readonly.idleCount);
  } finally { await lock.query("ROLLBACK"); lock.release(); }
  assert.ok(await reader.capture(10000, new AbortController().signal));
});
