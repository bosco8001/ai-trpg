import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import pg from "pg";
import { buildApp } from "../src/server/app.js";
import { createDomainSession, createPersistedDomainSession } from "../src/server/domain-session.js";
import { createTestGameState } from "../src/server/test-game-state.js";
import { createSaveSnapshot } from "../src/server/save-game/service.js";
import { InMemorySaveGameRepository } from "../src/server/save-game/memory-repository.js";
import { inspectData, type DataDiagnosticsReader } from "../src/server/data-diagnostics.js";
import { createPostgresDiagnosticsPool, createPostgresDiagnosticsReader } from "../src/server/postgres-data-diagnostics.js";
import { InvalidStoredSaveRecordError } from "../src/server/save-game/postgres-repository.js";
import { isDataDiagnosticsReport } from "../src/shared/data-diagnostics.js";
import { loadDataDiagnostics } from "../src/web/api.js";
import { DataHealthReport } from "../src/web/DataHealthPanel.js";
import { App } from "../src/web/App.js";
import type { StoredSaveSlot } from "../src/server/save-game/contracts.js";
import { applyCommand, type GameState } from "../src/domain/game.js";
import { advanceCombatTurn, applyCombatDamage, startCasting, startCombat } from "../src/domain/combat.js";
import { PHASE22_TEST_COMBAT_PARTICIPANTS } from "../src/server/combat/fixtures.js";
import { createPhase22CombatFixtureRoller } from "../src/server/combat/dice.js";

function success<T extends { ok: boolean }>(result: T): asserts result is Extract<T, { ok: true }> {
  assert.equal(result.ok, true, JSON.stringify(result));
}

function saved(slotId: 1 | 2 | 3): StoredSaveSlot {
  const snapshot = createSaveSnapshot(createTestGameState());
  return { slotId, formatVersion: snapshot.formatVersion, sourceRevision: snapshot.sourceRevision,
    snapshot: snapshot.state, savedAt: "2026-10-01T00:00:00.000Z" };
}

function reader(records: readonly StoredSaveSlot[] = []): DataDiagnosticsReader {
  return { async readCurrent() { return { kind: "state", value: createTestGameState() }; },
    async readSlot(id) { return records.find(r => r.slotId === id); } };
}

test("diagnostics API is GET-only, uncached, and leaves live state and slots unchanged on repeated reads", async t => {
  const session = createDomainSession(createTestGameState());
  const saves = new InMemorySaveGameRepository(() => session.getState());
  const snapshot = createSaveSnapshot(session.getState());
  await saves.writeIfLiveRevision(1, snapshot, { characterId: session.getState().character.id, expectedRevision: 0 });
  const before = structuredClone({ state: session.getState(), slots: await saves.list() });
  const app = await buildApp({ domainSession: session, saveGameRepository: saves });
  t.after(() => app.close());
  for (let i = 0; i < 3; i++) {
    const response = await app.inject("/api/data-diagnostics");
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["cache-control"], "no-store");
    const report: unknown = response.json();
    assert.ok(isDataDiagnosticsReport(report));
    assert.equal(report.current.status, "healthy");
    assert.deepEqual(report.slots.map(s => s.status), ["healthy", "empty", "empty"]);
    assert.deepEqual({ state: session.getState(), slots: await saves.list() }, before);
    assert.ok(!("state" in report) && !("snapshot" in report.slots[0]!));
  }
  assert.equal((await app.inject({ method: "POST", url: "/api/data-diagnostics" })).statusCode, 404);
});

test("diagnostics uses repository.load without creating a missing world or calling the session initializer", async t => {
  let reads = 0;
  const repository = {
    async load() { reads++; return undefined; },
    async createIfAbsent() { throw new Error("initializer must not run"); },
    async saveIfRevision() { throw new Error("write must not run"); },
  };
  const session = createPersistedDomainSession(repository, createTestGameState());
  const app = await buildApp({ domainSession: session, storage: "postgres" });
  t.after(() => app.close());
  const response = await app.inject("/api/data-diagnostics");
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().current.status, "missing-data");
  assert.deepEqual(response.json().slots.map((s: { status: string }) => s.status), ["empty", "empty", "empty"]);
  assert.equal(reads, 1);
});

test("inspection preserves casting, ended-but-unsettled resources and GameOver without settling or advancing", async t => {
  const equipped = applyCommand(createTestGameState(), { type: "set-equipped-skills", skillIds: ["TEST-skill-2"], expectedRevision: 0 });
  success(equipped);
  const started = startCombat(equipped.state, { expectedRevision: 1 }, PHASE22_TEST_COMBAT_PARTICIPANTS, createPhase22CombatFixtureRoller("normal"));
  success(started);
  const advanced = advanceCombatTurn(started.state, { expectedRevision: 2 }); success(advanced);
  const casting = startCasting(advanced.state, { expectedRevision: 3, skillId: "TEST-skill-2" }); success(casting);
  function damage(state: GameState, targetId: string, amount: number) {
    const result = applyCombatDamage(state, { targetId, amount, expectedRevision: state.revision }); success(result); return result.state;
  }
  const ended = damage(damage(casting.state, "TEST-enemy-1", 6), "TEST-enemy-2", 6);
  const gameOver = damage(damage(started.state, "TEST-companion-1", 8), "TEST-player", 10);
  assert.equal(gameOver.combat!.endReason, "party-defeat");
  for (const state of [casting.state, ended, gameOver]) {
    const session = createDomainSession(state);
    const app = await buildApp({ domainSession: session }); t.after(() => app.close());
    const before = structuredClone(session.getState());
    for (let i = 0; i < 3; i++) {
      const response = await app.inject("/api/data-diagnostics");
      assert.equal(response.json().current.status, "healthy", response.body);
      assert.deepEqual(session.getState(), before);
    }
  }
});

test("corrupt, unsupported and metadata-invalid slots have independent results", async () => {
  const records = [saved(1), { ...saved(2), snapshot: {} }, { ...saved(3), formatVersion: 99 }];
  const before = structuredClone(records);
  const report = await inspectData(reader(records), "memory");
  assert.deepEqual(report.slots.map(s => s.status), ["healthy", "invalid-data", "unsupported-version"]);
  assert.deepEqual(records, before);
  const source = reader(records);
  const metadataFailure = await inspectData({ ...source, async readSlot(id) {
    if (id === 2) throw new InvalidStoredSaveRecordError(new Error("private row"));
    return source.readSlot(id);
  } }, "postgres");
  assert.deepEqual(metadataFailure.slots.map(s => s.status), ["healthy", "invalid-data", "unsupported-version"]);
});

test("known TEST v1 maps only in memory; missing formal references are reported without source changes", async () => {
  const state = createTestGameState();
  const snapshot = { activity: "outside-combat", character: state.character, exploration: state.exploration };
  const records = [{ ...saved(1), formatVersion: 1, snapshot },
    { ...saved(2), formatVersion: 1, snapshot: { ...snapshot, character: { ...state.character, id: "FORMAL-legacy" } } }];
  const before = structuredClone(records);
  const report = await inspectData(reader(records), "memory");
  assert.deepEqual(report.slots.map(s => s.status), ["healthy", "missing-data", "empty"]);
  assert.equal(report.slots[0]!.formatVersion, 1);
  assert.deepEqual(records, before);
});

test("invalid current resources do not prevent save inspection, and internal errors never enter the report", async () => {
  const base = createTestGameState();
  const state = { ...base, phase26: { ...base.phase26!, characters:
    base.phase26!.characters.map((character, index) => index === 0 ? { ...character, currentHp: 999 } : character) } };
  const source = reader([saved(1)]);
  const invalid = await inspectData({ ...source, async readCurrent() { return { kind: "state", value: state }; } }, "memory");
  assert.equal(invalid.current.status, "invalid-data");
  assert.equal(invalid.slots[0]!.status, "healthy");
  const down = await inspectData({ ...source,
    async readCurrent() { throw new Error("postgres://private-password"); },
    async readSlot(id) { if (id === 2) throw new Error("SELECT private snapshot"); return source.readSlot(id); },
  }, "postgres");
  assert.equal(down.current.status, "unavailable");
  assert.equal(down.slots[0]!.status, "healthy");
  assert.equal(down.slots[1]!.status, "unavailable");
  assert.doesNotMatch(JSON.stringify(down), /private|password|SELECT/);
});

test("future current schema is distinguished from invalid data, and wrong-slot metadata cannot be healthy", async () => {
  const future = { ...createTestGameState(), phase26: { ...createTestGameState().phase26!, schemaVersion: 99 } };
  const report = await inspectData({ ...reader(), async readCurrent() { return { kind: "state", value: future }; } }, "memory");
  assert.equal(report.current.status, "unsupported-version");
  assert.equal(report.current.formatVersion, 99);
  const bad = await inspectData({ ...reader(), async readSlot() { return saved(1); } }, "memory");
  assert.deepEqual(bad.slots.map(s => s.status), ["healthy", "invalid-data", "invalid-data"]);
});

test("format health is not a promise of compatibility with the current run", async () => {
  const record = saved(1);
  const snapshot = createSaveSnapshot(createTestGameState()).state;
  const otherRun = { ...snapshot, phase26: { ...snapshot.phase26!, runId: "another-run" } };
  const report = await inspectData(reader([{ ...record, snapshot: otherRun }]), "memory");
  assert.equal(report.slots[0]!.status, "healthy");
  const markup = renderToStaticMarkup(createElement(DataHealthReport, { report }));
  assert.match(markup, /能否載入仍由載入規則判定/);
});

test("front-end report contract rejects mutation-capable, raw, reordered and incomplete responses", async () => {
  const report = await inspectData(reader(), "memory");
  assert.ok(isDataDiagnosticsReport(report));
  for (const bad of [
    { ...report, readOnly: false }, { ...report, snapshot: {} },
    { ...report, slots: report.slots.slice(0, 2) }, { ...report, slots: [...report.slots].reverse() },
    { ...report, current: { ...report.current, status: "empty" } },
    { ...report, current: { ...report.current, revision: -1 } },
    { ...report, checkedAt: "not a date" },
  ]) assert.equal(isDataDiagnosticsReport(bad), false);
});

test("diagnostics client only GETs, supports abort and rejects bad reports or HTTP failures", async () => {
  const controller = new AbortController();
  const report = await inspectData(reader(), "memory");
  const result = await loadDataDiagnostics(controller.signal, async (url, init) => {
    assert.equal(url, "/api/data-diagnostics");
    assert.equal(init?.method, "GET");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.signal, controller.signal);
    assert.equal(init?.body, undefined);
    return Response.json(report);
  });
  assert.deepEqual(result, report);
  await assert.rejects(loadDataDiagnostics(controller.signal, async () => Response.json({ ...report, readOnly: false })), /格式不正確/);
  await assert.rejects(loadDataDiagnostics(controller.signal, async () => new Response("private", { status: 503 })), /暫時無法使用/);
});

test("failed initial game-state screen still offers diagnostics", () => {
  const markup = renderToStaticMarkup(createElement(App));
  assert.match(markup, /資料健康檢查/);
  assert.match(markup, /正在讀取遊戲狀態/);
});

const pgOptions = { skip: !process.env.TEST_DATABASE_URL && "需明確提供隔離 TEST_DATABASE_URL。" };
test("PostgreSQL diagnostic deadline cancels blocked SELECTs, isolates healthy data and recovers without writes", { ...pgOptions, timeout: 15000 }, async t => {
  const base = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const identity = randomUUID().replaceAll("-", "");
  const schema = "phase28_timeout_" + identity;
  await base.query(`CREATE SCHEMA ${schema}`);
  const writer = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema}` });
  const url = new URL(process.env.TEST_DATABASE_URL!);
  url.searchParams.set("options", `-c search_path=${schema} -c statement_timeout=0`);
  url.searchParams.set("statement_timeout", "0");
  url.searchParams.set("application_name", "phase28_diagnostics_" + identity);
  const diagnostics = createPostgresDiagnosticsPool(url.href);
  let locked = false;
  const lock = await writer.connect();
  t.after(async () => {
    if (locked) await lock.query("ROLLBACK");
    lock.release();
    await diagnostics.end(); await writer.end();
    await base.query(`DROP SCHEMA ${schema} CASCADE`); await base.end();
  });
  const originalTimeout = (await writer.query("SHOW statement_timeout")).rows;
  assert.equal((await diagnostics.query("SHOW statement_timeout")).rows[0].statement_timeout, "2s");
  assert.equal((await diagnostics.query("SHOW default_transaction_read_only")).rows[0].default_transaction_read_only, "on");
  await writer.query("CREATE TABLE game_states (character_id text PRIMARY KEY, revision bigint, snapshot jsonb)");
  await writer.query("CREATE TABLE save_slots (slot_id integer PRIMARY KEY, format_version integer, source_revision bigint, snapshot jsonb, saved_at timestamptz)");
  const state = createTestGameState(), { revision, ...snapshot } = state;
  await writer.query("INSERT INTO game_states VALUES ($1,$2,$3)", [state.character.id, revision, JSON.stringify(snapshot)]);
  await writer.query("INSERT INTO save_slots VALUES (1,2,0,$1,$2)", [JSON.stringify(createSaveSnapshot(state).state), "2026-10-01T00:00:00Z"]);
  const before = { current: (await writer.query("SELECT * FROM game_states")).rows,
    slots: (await writer.query("SELECT * FROM save_slots")).rows };
  await lock.query("BEGIN"); locked = true;
  await lock.query("LOCK TABLE save_slots IN ACCESS EXCLUSIVE MODE");
  const app = await buildApp({ diagnosticsReader: createPostgresDiagnosticsReader(diagnostics, state.character.id), storage: "postgres" });
  t.after(() => app.close());
  const started = performance.now();
  const response = await app.inject("/api/data-diagnostics");
  assert.equal(response.statusCode, 200, response.body);
  assert.ok(performance.now() - started < 5000, "database cancellation must finish before the frontend deadline");
  assert.equal(response.json().current.status, "healthy");
  assert.deepEqual(response.json().slots.map((s: { status: string }) => s.status), ["unavailable", "unavailable", "unavailable"]);
  const waiting = await base.query("SELECT pid FROM pg_stat_activity WHERE application_name=$1 AND state='active'", ["phase28_diagnostics_" + identity]);
  assert.equal(waiting.rowCount, 0, "timed-out SELECTs must stop on PostgreSQL itself");
  await lock.query("ROLLBACK"); locked = false;
  const recovered = await app.inject("/api/data-diagnostics");
  assert.equal(recovered.json().current.status, "healthy");
  assert.deepEqual(recovered.json().slots.map((s: { status: string }) => s.status), ["healthy", "empty", "empty"]);
  assert.deepEqual({ current: (await writer.query("SELECT * FROM game_states")).rows,
    slots: (await writer.query("SELECT * FROM save_slots")).rows }, before);
  assert.deepEqual((await writer.query("SHOW statement_timeout")).rows, originalTimeout);
});

test("PostgreSQL SELECT-only inspection isolates raw metadata errors and preserves every stored byte", pgOptions, async t => {
  const base = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 2 });
  const schema = "phase28_" + randomUUID().replaceAll("-", "");
  await base.query(`CREATE SCHEMA ${schema}`);
  const writer = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema}` });
  const readOnly = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL,
    options: `-c search_path=${schema} -c default_transaction_read_only=on` });
  t.after(async () => {
    await readOnly.end(); await writer.end();
    await base.query(`DROP SCHEMA ${schema} CASCADE`); await base.end();
  });
  await writer.query("CREATE TABLE game_states (character_id text PRIMARY KEY, revision bigint, snapshot jsonb)");
  await writer.query("CREATE TABLE save_slots (slot_id integer PRIMARY KEY, format_version integer, source_revision bigint, snapshot jsonb, saved_at timestamptz)");
  const state = createTestGameState(), { revision, ...snapshot } = state;
  const source = createPostgresDiagnosticsReader(readOnly, state.character.id);
  const app = await buildApp({ diagnosticsReader: source, storage: "postgres",
    domainRepository: { async load() { throw new Error("not used"); }, async createIfAbsent() { throw new Error("not used"); }, async saveIfRevision() { throw new Error("not used"); } } });
  t.after(() => app.close());
  // An empty database must stay empty even when the application is configured for persistence.
  const empty = await app.inject("/api/data-diagnostics");
  assert.equal(empty.json().current.status, "missing-data");
  assert.equal((await writer.query("SELECT COUNT(*) AS n FROM game_states")).rows[0].n, "0");
  await writer.query("INSERT INTO game_states VALUES ($1,$2,$3)", [state.character.id, revision, JSON.stringify(snapshot)]);
  for (const id of [1, 2, 3]) await writer.query("INSERT INTO save_slots VALUES ($1,$2,$3,$4,$5)",
    [id, id === 2 ? -1 : 2, 0, JSON.stringify(createSaveSnapshot(state).state), "2026-10-01T00:00:00Z"]);
  const before = await writer.query("SELECT snapshot::text, revision::text FROM game_states");
  const slotsBefore = await writer.query("SELECT * FROM save_slots ORDER BY slot_id");
  for (let i = 0; i < 3; i++) {
    const response = await app.inject("/api/data-diagnostics");
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().current.status, "healthy");
    assert.deepEqual(response.json().slots.map((s: { status: string }) => s.status), ["healthy", "invalid-data", "healthy"]);
  }
  assert.deepEqual((await writer.query("SELECT snapshot::text, revision::text FROM game_states")).rows, before.rows);
  assert.deepEqual((await writer.query("SELECT * FROM save_slots ORDER BY slot_id")).rows, slotsBefore.rows);
  const invalid = { ...snapshot, phase26: { ...snapshot.phase26!, characters: [] } };
  await writer.query("UPDATE game_states SET snapshot=$1", [JSON.stringify(invalid)]);
  const brokenBefore = (await writer.query("SELECT snapshot::text FROM game_states")).rows;
  const broken = await app.inject("/api/data-diagnostics");
  assert.equal(broken.json().current.status, "invalid-data");
  assert.equal(broken.json().slots[0].status, "healthy");
  assert.deepEqual((await writer.query("SELECT snapshot::text FROM game_states")).rows, brokenBefore);
});
