// 尚未執行；僅供 Grok 在獨立 TEST_DATABASE_URL 執行。每個案例使用隔離 schema。
import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { PostgresCreationRepository } from "../src/server/character-creation/postgres-repository.js";
import { createCharacterCreationService } from "../src/server/character-creation/service.js";
import { createTestGameState } from "../src/server/test-game-state.js";
import { creationRequest, signal, date, failure, secondRequestId } from "./helpers/character-creation.js";

const pgOptions = { skip: !process.env.TEST_DATABASE_URL && "需提供隔離 TEST_DATABASE_URL；未執行不算通過。" };
async function fixture(t: TestContext) {
  const root = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 1 });
  const schema = `phase33_creation_${randomUUID().replaceAll("-", "")}`;
  const pools: pg.Pool[] = [];
  t.after(async () => {
    try { for (const pool of pools) await pool.end(); await root.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
    finally { await root.end(); }
  });
  await root.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(process.env.TEST_DATABASE_URL!); url.searchParams.set("options", `-c search_path=${schema}`);
  const { runner } = await import("node-pg-migrate");
  await runner({ databaseUrl: url.href, dir: "migrations", direction: "up", migrationsTable: "pgmigrations", migrationsSchema: schema,
    schema, count: Infinity, log: () => {} });
  const makePool = () => {
    const pool = new pg.Pool({ connectionString: url.href, max: 4, connectionTimeoutMillis: 1000 });
    pools.push(pool); return pool;
  };
  const pool = makePool(), state = createTestGameState();
  await pool.query("INSERT INTO game_states (character_id, revision, snapshot) VALUES ($1, $2, $3)", [state.character.id, state.revision, JSON.stringify(state)]);
  await pool.query("INSERT INTO save_slots (slot_id, format_version, source_revision, snapshot) VALUES (1,2,0,$1)", [JSON.stringify(state)]);
  const legacy = async () => (await pool.query(`SELECT jsonb_build_object(
    'game', (SELECT jsonb_agg(to_jsonb(g) ORDER BY character_id) FROM game_states g),
    'slots', (SELECT jsonb_agg(to_jsonb(s) ORDER BY slot_id) FROM save_slots s),
    'versions', (SELECT jsonb_agg(to_jsonb(v) ORDER BY source_key) FROM repair_source_versions v),
    'epoch', (SELECT jsonb_agg(to_jsonb(e)) FROM repair_apply_epoch e),
    'backups', (SELECT jsonb_agg(to_jsonb(b) ORDER BY repair_id) FROM repair_preparations b),
    'applications', (SELECT jsonb_agg(to_jsonb(a) ORDER BY repair_id) FROM repair_applications a)
  ) AS value`)).rows[0].value;
  return { pool, makePool, legacy };
}
function instrument(pool: Pick<pg.Pool, "connect">) {
  let draws = 0;
  const repo = new PostgresCreationRepository(pool);
  const service = createCharacterCreationService(repo, "postgres", max => { draws++; return max === 3 ? 2 : 20; }, randomUUID, () => date);
  return { repo, service, draws: () => draws };
}

test("PG migration、持久化與新連線池重讀：單份固定出生紀錄，既有六種資料不變", pgOptions, async t => {
  const f = await fixture(t), before = await f.legacy(), one = instrument(f.pool), request = creationRequest({ raceId: "race.dragonborn" });
  assert.equal((await one.service.read(signal())).state, "empty");
  const saved = await one.service.create(request, signal()); assert.equal(saved.record!.breath, "lightning");
  const freshPool = f.makePool(), restarted = instrument(freshPool);
  assert.deepEqual(await restarted.service.read(signal()), saved);
  assert.deepEqual(await restarted.service.create(request, signal()), saved);
  assert.equal(one.draws(), 3); assert.equal(restarted.draws(), 0);
  assert.equal((await f.pool.query("SELECT count(*)::integer AS n FROM character_creation_records")).rows[0].n, 1);
  assert.deepEqual(await f.legacy(), before);
});
test("PG 兩個 request ID 競爭：只有鎖內勝方抽取，資料庫單角色唯一限制生效", pgOptions, async t => {
  const f = await fixture(t), before = await f.legacy(), a = instrument(f.pool), b = instrument(f.makePool());
  const requests = [creationRequest(), creationRequest({ requestId: secondRequestId })];
  const result = await Promise.allSettled([a.service.create(requests[0]!, signal()), b.service.create(requests[1]!, signal())]);
  assert.equal(result.filter(r => r.status === "fulfilled").length, 1);
  const winner = result.find(r => r.status === "fulfilled"); assert.ok(winner?.status === "fulfilled");
  assert.equal(a.draws() + b.draws(), 2);
  assert.equal((await f.pool.query("SELECT count(*)::integer AS n FROM character_creation_records")).rows[0].n, 1);
  await assert.rejects(f.pool.query(`INSERT INTO character_creation_records (character_id, owner_key, request_id, request_hash, record)
    SELECT $1, owner_key, $2, request_hash, record FROM character_creation_records`, [randomUUID(), randomUUID()]),
    (e: unknown) => e instanceof Error && "code" in e && e.code === "23505");
  assert.deepEqual(await a.service.read(signal()), winner.value); assert.deepEqual(await f.legacy(), before);
});
test("PG 同一請求並行與異內容衝突：相同結果、不重抽、不改既有紀錄", pgOptions, async t => {
  const f = await fixture(t), a = instrument(f.pool), b = instrument(f.makePool()), request = creationRequest();
  const [first, second] = await Promise.all([a.service.create(request, signal()), b.service.create(request, signal())]);
  assert.deepEqual(first, second); assert.equal(a.draws() + b.draws(), 2);
  await failure(a.service.create({ ...request, classId: "class.mage" }, signal()), "request-conflict");
  await failure(b.service.create({ ...request, requestId: secondRequestId }, signal()), "already-created");
  assert.deepEqual(await a.service.read(signal()), first); assert.equal(a.draws() + b.draws(), 2);
});
test("PG 已 COMMIT 但回覆遺失：重試沿用原結果，連線丟棄後仍可恢復", pgOptions, async t => {
  const f = await fixture(t); let loseReply = true;
  const faultPool: Pick<pg.Pool, "connect"> = { async connect() {
    const client = await f.pool.connect(), originalQuery = client.query.bind(client);
    return new Proxy(client, { get(target, key) {
      if (key === "query") return async (sql: string, params?: unknown[]) => {
        const result = await originalQuery(sql, params);
        if (sql === "COMMIT" && loseReply) { loseReply = false; throw new Error("synthetic lost COMMIT reply: SQL private-marker"); }
        return result;
      };
      const value: unknown = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
    } });
  } };
  const first = instrument(faultPool), request = creationRequest();
  await failure(first.service.create(request, signal()), "unavailable");
  const retry = instrument(f.pool), saved = await retry.service.create(request, signal());
  assert.equal(saved.state, "created"); assert.equal(first.draws(), 2); assert.equal(retry.draws(), 0);
  assert.deepEqual(await retry.service.read(signal()), saved);
});
test("PG INSERT 確定失敗整份回滾，沒有透露半份角色；手動重試可成功", pgOptions, async t => {
  const f = await fixture(t), before = await f.legacy();
  await f.pool.query(`CREATE FUNCTION fail_creation_insert() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'synthetic private SQL marker'; END $$;
    CREATE TRIGGER fail_creation BEFORE INSERT ON character_creation_records FOR EACH ROW EXECUTE FUNCTION fail_creation_insert()`);
  const a = instrument(f.pool), request = creationRequest();
  await failure(a.service.create(request, signal()), "unavailable");
  assert.equal((await a.service.read(signal())).state, "empty");
  assert.equal((await f.pool.query("SELECT count(*)::integer AS n FROM character_creation_records")).rows[0].n, 0);
  await f.pool.query("DROP TRIGGER fail_creation ON character_creation_records");
  assert.equal((await a.service.create(request, signal())).state, "created");
  assert.equal(a.draws(), 4); assert.deepEqual(await f.legacy(), before);
});
test("PG 保存格式／摘要損壞安全拒絕，原始列保留，沒有修補、補血或重抽", pgOptions, async t => {
  const f = await fixture(t), a = instrument(f.pool); await a.service.create(creationRequest(), signal());
  const good = (await f.pool.query("SELECT * FROM character_creation_records")).rows[0];
  for (const value of [{ ...good.record, rulesVersion: 999 }, { ...good.record, race: { ...good.record.race, name: "非正式名稱" } },
    { ...good.record, resources: { ...good.record.resources, currentHp: 0 } }]) {
    await f.pool.query("UPDATE character_creation_records SET record = $1", [JSON.stringify(value)]);
    await failure(a.service.read(signal()), "invalid-record"); await failure(a.service.create(creationRequest(), signal()), "invalid-record");
    assert.deepEqual((await f.pool.query("SELECT record FROM character_creation_records")).rows[0].record, value);
  }
  await f.pool.query("UPDATE character_creation_records SET record = $1, request_hash = $2", [JSON.stringify(good.record), "0".repeat(64)]);
  await failure(a.service.read(signal()), "invalid-record"); assert.equal(a.draws(), 2);
});
test("PG 等待建立鎖時取消：不生成或寫入，丟棄連線後新操作正常", pgOptions, async t => {
  const f = await fixture(t), held = await f.pool.connect();
  try {
    await held.query("BEGIN"); await held.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", ["character-creation:local-player"]);
    const a = instrument(f.pool), controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 50);
    try { await failure(a.service.create(creationRequest(), controller.signal), "unavailable"); }
    finally { clearTimeout(timer); }
    assert.equal(a.draws(), 0); assert.equal((await a.service.read(signal())).state, "empty");
    await held.query("ROLLBACK");
    assert.equal((await a.service.create(creationRequest(), signal())).state, "created");
  } finally { try { await held.query("ROLLBACK"); } finally { held.release(); } }
});
