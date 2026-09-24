import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { createTestCombatInventory } from "../src/domain/combat-items.js";
import type { GameState } from "../src/domain/game.js";
import type { GameStateRepository } from "../src/domain/game-state-repository.js";
import { buildApp } from "../src/server/app.js";
import { createPersistedDomainSession } from "../src/server/domain-session.js";
import {
  hydrateStateRow,
  InvalidPersistedStateError,
  PersistenceUnavailableError,
  PostgresGameStateRepository,
} from "../src/server/postgres-game-state-repository.js";

function seed(id = "TEST-character"): GameState {
  return {
    revision: 0,
    activity: "outside-combat",
    character: {
      id,
      learnedActiveSkillIds: ["TEST-skill-1", "TEST-skill-2"],
      equippedSkillIds: [],
      currentMp: 24,
    },
    inventory: createTestCombatInventory(),
    exploration: { locationId: "TEST-forest-edge", lastObservationTargetId: null },
    combat: null,
  };
}

function command(skillIds: string[], expectedRevision = 0) {
  return { type: "set-equipped-skills", expectedRevision, skillIds };
}

test("資料庫快照必須重新通過完整 domain 驗證", () => {
  const valid = {
    character_id: "TEST-character",
    revision: "0",
    snapshot: { activity: "outside-combat", character: seed().character },
  };
  assert.deepEqual(hydrateStateRow(valid), seed());
  assert.deepEqual(hydrateStateRow({
    ...valid,
    snapshot: { ...valid.snapshot, exploration: seed().exploration },
  }), seed());
  for (const row of [
    { ...valid, revision: "9007199254740992" },
    { ...valid, snapshot: { ...valid.snapshot, revision: 999 } },
    { ...valid, snapshot: { ...valid.snapshot, hp: 999 } },
    { ...valid, snapshot: { ...valid.snapshot, character: { ...seed().character, equippedSkillIds: ["unknown"] } } },
    { ...valid, snapshot: { ...valid.snapshot, character: { ...seed().character, equippedSkillIds: ["TEST-skill-1", "TEST-skill-1"] } } },
    { ...valid, character_id: "other" },
    { ...valid, snapshot: null },
    { ...valid, snapshot: { ...valid.snapshot, exploration: { locationId: "final-boss-room", lastObservationTargetId: null } } },
    { ...valid, snapshot: { ...valid.snapshot, exploration: { ...seed().exploration, hp: 999 } } },
  ]) {
    assert.throws(() => hydrateStateRow(row), InvalidPersistedStateError);
  }
});

test("兩個服務使用 repository 契約時，舊版本更新不得覆蓋成功更新", async () => {
  let state: GameState | undefined;
  const repository: GameStateRepository = {
    async load() { return state; },
    async createIfAbsent(initial) {
      state ??= initial;
      return state;
    },
    async saveIfRevision(expected, next) {
      if (state?.revision !== expected) return false;
      state = next;
      return true;
    },
  };
  const first = createPersistedDomainSession(repository, seed());
  const second = createPersistedDomainSession(repository, seed());
  const [a, b] = await Promise.all([
    first.execute(command(["TEST-skill-1"])),
    second.execute(command(["TEST-skill-2"])),
  ]);
  assert.deepEqual([a.ok, b.ok].sort(), [false, true]);
  assert.equal((await repository.load("TEST-character"))?.revision, 1);
});

test("儲存故障與異常快照不向 API 回傳連線字串、SQL 或 stack trace", async (t) => {
  const secret = "postgres://user:secret@localhost/internal SQL SELECT stack trace";
  const unavailable: GameStateRepository = {
    load: async () => { throw new PersistenceUnavailableError(new Error(secret)); },
    createIfAbsent: async () => { throw new PersistenceUnavailableError(new Error(secret)); },
    saveIfRevision: async () => { throw new PersistenceUnavailableError(new Error(secret)); },
  };
  const app = await buildApp({ domainSandbox: true, domainRepository: unavailable });
  t.after(() => app.close());
  for (const response of [
    await app.inject("/api/dev/domain"),
    await app.inject({ method: "POST", url: "/api/dev/domain/commands", payload: command([]) }),
  ]) {
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().error, "state_unavailable");
    assert.ok(!response.body.includes(secret));
    assert.ok(!response.body.includes("SQL"));
  }
  const corrupt = await buildApp({
    domainSandbox: true,
    domainRepository: { ...unavailable, createIfAbsent: async () => { throw new InvalidPersistedStateError(new Error(secret)); } },
  });
  t.after(() => corrupt.close());
  const response = await corrupt.inject("/api/dev/domain");
  assert.equal(response.statusCode, 500);
  assert.ok(!response.body.includes(secret));
});

test("PostgreSQL adapter 的條件式更新、重讀與資料驗證", {
  skip: !process.env.TEST_DATABASE_URL && "需明確提供隔離的 TEST_DATABASE_URL，並先執行 migration。",
}, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 3 });
  const id = `TEST-${randomUUID()}`;
  const repositoryA = new PostgresGameStateRepository(pool);
  const repositoryB = new PostgresGameStateRepository(pool);
  try {
    const initial = await repositoryA.createIfAbsent(seed(id));
    assert.equal(initial.revision, 0);
    const first = createPersistedDomainSession(repositoryA, seed(id));
    const second = createPersistedDomainSession(repositoryB, seed(id));
    const [a, b] = await Promise.all([
      first.execute(command(["TEST-skill-1"])),
      second.execute(command(["TEST-skill-2"])),
    ]);
    assert.deepEqual([a.ok, b.ok].sort(), [false, true]);
    const saved = await repositoryB.load(id);
    assert.equal(saved?.revision, 1);
    assert.equal(saved?.character.equippedSkillIds.length, 1);
    const moved = await first.execute({
      type: "approach-target", expectedRevision: 1, targetId: "TEST-ruin-entrance",
    });
    assert.equal(moved.ok, true);
    const explorationSaved = await repositoryB.load(id);
    assert.equal(explorationSaved?.revision, 2);
    assert.equal(explorationSaved?.exploration.locationId, "TEST-ruin-entrance");
    const restartedPool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 1 });
    const reloaded = new PostgresGameStateRepository(restartedPool);
    // 新 adapter 模擬 API 重啟，驗證狀態不是程序記憶體資料。
    try {
      assert.deepEqual(await reloaded.load(id), explorationSaved);
    } finally {
      await restartedPool.end();
    }
    await pool.query("UPDATE game_states SET snapshot = $2::jsonb WHERE character_id = $1", [id, JSON.stringify({
      activity: "outside-combat",
      character: explorationSaved?.character,
      exploration: { locationId: "final-boss-room", lastObservationTargetId: null },
    })]);
    await assert.rejects(repositoryA.load(id), InvalidPersistedStateError);
  } finally {
    await pool.query("DELETE FROM game_states WHERE character_id = $1", [id]);
    await pool.end();
  }
});
