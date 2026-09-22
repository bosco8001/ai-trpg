import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import pg from "pg";
import { createGameState, type GameState } from "../src/domain/game.js";
import { buildApp } from "../src/server/app.js";
import { createDomainSession, createPersistedDomainSession } from "../src/server/domain-session.js";
import { PostgresGameStateRepository } from "../src/server/postgres-game-state-repository.js";
import { InMemorySaveGameRepository } from "../src/server/save-game/memory-repository.js";
import {
  hydrateSaveSlotRow,
  InvalidStoredSaveRecordError,
  PostgresSaveGameRepository,
} from "../src/server/save-game/postgres-repository.js";
import { createSaveGameService, createSaveSnapshot, decodeSaveSnapshot } from "../src/server/save-game/service.js";
import { SaveGameFailure, type SaveGameRepository, type StoredSaveSlot } from "../src/server/save-game/contracts.js";
import {
  SAVE_FORMAT_VERSION,
  isSaveOperationResponse,
  isSaveSlotsResponse,
  type SaveSlotSummary,
} from "../src/shared/save-game.js";
import { getSuggestedActions } from "../src/web/exploration-ui.js";
import { narrativeEntriesAfterLoad } from "../src/web/exploration.js";
import { SaveSlotsPanel } from "../src/web/SaveSlotsPanel.js";
import { listSaveSlots, loadGame, saveGame } from "../src/web/api.js";

function seed(overrides: Partial<GameState> = {}): GameState {
  return createGameState({
    revision: 0,
    activity: "outside-combat",
    character: {
      id: "TEST-character",
      learnedActiveSkillIds: ["TEST-skill-1", "TEST-skill-2"],
      equippedSkillIds: [],
    },
    exploration: { locationId: "TEST-forest-edge", lastObservationTargetId: null },
    combat: null,
    ...overrides,
  });
}

function memorySetup(initial = seed()) {
  const session = createDomainSession(initial);
  const repository = new InMemorySaveGameRepository(
    () => session.getState(),
    () => new Date("2026-09-22T12:34:56.000Z"),
  );
  return { session, repository, service: createSaveGameService(repository, session, "memory") };
}

async function expectFailure(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof SaveGameFailure);
    assert.equal(error.code, code);
    return true;
  });
}

test("初始三槽皆空；Save 保存 v1 authoritative snapshot 且不增加 live revision", async () => {
  const { session, repository, service } = memorySetup();
  assert.deepEqual(await service.list(), {
    slots: [{ slotId: 1, empty: true }, { slotId: 2, empty: true }, { slotId: 3, empty: true }],
  });
  const saved = await service.save(1, 0);
  assert.equal(saved.state.revision, 0);
  assert.equal((await session.getState()).revision, 0);
  assert.equal(saved.slot.sourceRevision, 0);
  assert.equal(saved.slot.formatVersion, SAVE_FORMAT_VERSION);
  assert.equal(saved.slot.locationId, "TEST-forest-edge");
  const raw = await repository.read(1);
  assert.ok(raw);
  assert.equal("revision" in (raw.snapshot as object), false);
  assert.deepEqual(decodeSaveSnapshot(raw).state, {
    activity: "outside-combat",
    character: seed().character,
    exploration: seed().exploration,
  });
});

test("Load 恢復內容但 live revision 從目前版本只增加一次", async () => {
  const { session, service } = memorySetup();
  await service.save(1, 0);
  const moved = await session.execute({ type: "approach-target", expectedRevision: 0, targetId: "TEST-ruin-entrance" });
  assert.equal(moved.ok, true);
  const inspected = await session.execute({ type: "inspect-target", expectedRevision: 1, targetId: "TEST-stone-door" });
  assert.equal(inspected.ok, true);
  assert.equal((await session.getState()).revision, 2);
  const loaded = await service.load(1, 2);
  assert.equal(loaded.slot.sourceRevision, 0);
  assert.equal(loaded.state.revision, 3);
  assert.equal(loaded.state.locationId, "TEST-forest-edge");
  assert.equal(loaded.state.lastObservationTargetId, null);
  assert.equal((await session.getState()).revision, 3);
});

test("Overwrite 保存新的 authoritative state，但 Save 仍不增加 revision", async () => {
  const { session, service } = memorySetup();
  await service.save(1, 0);
  await session.execute({ type: "approach-target", expectedRevision: 0, targetId: "TEST-ruin-entrance" });
  const overwritten = await service.save(1, 1);
  assert.equal(overwritten.state.revision, 1);
  assert.equal(overwritten.slot.sourceRevision, 1);
  assert.equal(overwritten.slot.locationId, "TEST-ruin-entrance");
  assert.equal((await session.getState()).revision, 1);
});

test("invalid slot、空槽與 stale revision 都安全拒絕且不修改 state", async () => {
  const { session, service } = memorySetup();
  await expectFailure(service.save(4, 0), "invalid-slot");
  await expectFailure(service.load(1, 0), "slot-empty");
  await expectFailure(service.save(1, 1), "stale-revision");
  await service.save(1, 0);
  await expectFailure(service.load(1, 1), "stale-revision");
  assert.deepEqual(await session.getState(), seed());
});

test("損壞 snapshot 與未知 format version 不修改 state 或 revision", async () => {
  const current = seed({ revision: 5 });
  const session = createDomainSession(current);
  const base: StoredSaveSlot = {
    slotId: 1, formatVersion: 1, sourceRevision: 0,
    snapshot: { activity: "outside-combat" }, savedAt: "2026-09-22T12:34:56.000Z",
  };
  for (const [record, code] of [
    [base, "invalid-save"],
    [{ ...base, formatVersion: 999 }, "unsupported-format"],
    [{ ...base, snapshot: { ...seed(), hp: 999 } }, "invalid-save"],
  ] as const) {
    const repository: SaveGameRepository = {
      async list() { return [record]; },
      async read() { return record; },
      async writeIfLiveRevision() { return record; },
    };
    const service = createSaveGameService(repository, session, "memory");
    await expectFailure(service.load(1, 5), code);
    assert.deepEqual(await session.getState(), current);
  }
});

test("同一 expectedRevision 的兩個 Load 只有一個成功，revision 不會重複或倒退", async () => {
  const { session, service } = memorySetup();
  await service.save(1, 0);
  const results = await Promise.allSettled([service.load(1, 0), service.load(1, 0)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal((await session.getState()).revision, 1);
});

test("Save / Load API 拒絕前端 snapshot 與非法 slot，且不呼叫 interpretation 或 narration", async (t) => {
  let interpretations = 0;
  let narrations = 0;
  const session = createDomainSession(seed());
  const repository = new InMemorySaveGameRepository(() => session.getState());
  const app = await buildApp({
    domainSession: session,
    saveGameRepository: repository,
    interpreter: { async interpret() { interpretations += 1; throw new Error("不應呼叫"); } },
    narrator: { async narrate() { narrations += 1; throw new Error("不應呼叫"); } },
  });
  t.after(() => app.close());
  const initial = await app.inject("/api/save-slots");
  assert.equal(initial.statusCode, 200);
  assert.equal(initial.json().slots.length, 3);
  for (const request of [
    { method: "PUT" as const, url: "/api/save-slots/0", payload: { expectedRevision: 0 } },
    { method: "PUT" as const, url: "/api/save-slots/4", payload: { expectedRevision: 0 } },
    { method: "PUT" as const, url: "/api/save-slots/abc", payload: { expectedRevision: 0 } },
    { method: "PUT" as const, url: "/api/save-slots/1", payload: { expectedRevision: 0, state: seed() } },
    { method: "PUT" as const, url: "/api/save-slots/1", payload: { expectedRevision: 0, location: "final-boss-room" } },
    { method: "POST" as const, url: "/api/save-slots/1/load", payload: { expectedRevision: 0, revision: 999 } },
  ]) {
    const response = await app.inject(request);
    assert.equal(response.statusCode, 400);
  }
  const saved = await app.inject({ method: "PUT", url: "/api/save-slots/1", payload: { expectedRevision: 0 } });
  assert.equal(saved.statusCode, 200);
  assert.equal(saved.json().state.revision, 0);
  const loaded = await app.inject({ method: "POST", url: "/api/save-slots/1/load", payload: { expectedRevision: 0 } });
  assert.equal(loaded.statusCode, 200);
  assert.equal(loaded.json().state.revision, 1);
  assert.equal(interpretations, 0);
  assert.equal(narrations, 0);
});

test("API 對 empty、stale、repository error 與腐敗資料只回安全訊息", async (t) => {
  const session = createDomainSession(seed());
  const empty = await buildApp({ domainSession: session, saveGameRepository: new InMemorySaveGameRepository(() => session.getState()) });
  t.after(() => empty.close());
  const emptyLoad = await empty.inject({ method: "POST", url: "/api/save-slots/1/load", payload: { expectedRevision: 0 } });
  assert.equal(emptyLoad.statusCode, 404);
  const stale = await empty.inject({ method: "PUT", url: "/api/save-slots/1", payload: { expectedRevision: 1 } });
  assert.equal(stale.statusCode, 409);

  const secret = "postgres://user:secret@localhost SQL stack trace";
  const unavailable: SaveGameRepository = {
    async list() { throw new Error(secret); },
    async read() { throw new Error(secret); },
    async writeIfLiveRevision() { throw new Error(secret); },
  };
  const brokenSession = createDomainSession(seed());
  const broken = await buildApp({ domainSession: brokenSession, saveGameRepository: unavailable });
  t.after(() => broken.close());
  for (const response of [
    await broken.inject("/api/save-slots"),
    await broken.inject({ method: "PUT", url: "/api/save-slots/1", payload: { expectedRevision: 0 } }),
    await broken.inject({ method: "POST", url: "/api/save-slots/1/load", payload: { expectedRevision: 0 } }),
  ]) {
    assert.equal(response.statusCode, 503);
    assert.doesNotMatch(response.body, /postgres|secret|SQL|stack/i);
  }
  assert.deepEqual(await brokenSession.getState(), seed());
});

test("shared 與 frontend runtime boundaries 驗證 slot metadata 和操作 response", async () => {
  const occupied = {
    slotId: 1, empty: false, formatVersion: 1, sourceRevision: 0,
    savedAt: "2026-09-22T12:34:56.000Z", locationId: "TEST-forest-edge",
  };
  const list = { slots: [occupied, { slotId: 2, empty: true }, { slotId: 3, empty: true }] };
  assert.equal(isSaveSlotsResponse(list), true);
  assert.equal(isSaveSlotsResponse({ ...list, snapshot: seed() }), false);
  const operation = {
    slot: occupied,
    state: { revision: 0, locationId: "TEST-forest-edge", lastObservationTargetId: null, storage: "memory" },
  };
  assert.equal(isSaveOperationResponse(operation), true);
  assert.equal(isSaveOperationResponse({ ...operation, hp: 999 }), false);
  const listResult = await listSaveSlots(async () => Response.json(list));
  assert.equal(listResult.slots.length, 3);
  const saved = await saveGame(1, 0, async (url, init) => {
    assert.equal(String(url), "/api/save-slots/1");
    assert.equal(init?.method, "PUT");
    assert.deepEqual(JSON.parse(String(init?.body)), { expectedRevision: 0 });
    return Response.json(operation);
  });
  assert.equal(saved.state.revision, 0);
  const loaded = await loadGame(1, 0, async (url, init) => {
    assert.equal(String(url), "/api/save-slots/1/load");
    assert.equal(init?.method, "POST");
    return Response.json({ ...operation, state: { ...operation.state, revision: 1 } });
  });
  assert.equal(loaded.state.revision, 1);
});

test("System save UI 顯示三槽；空槽沒有 Load，覆蓋與載入都有確認內容", () => {
  const emptySlots: readonly SaveSlotSummary[] = [
    { slotId: 1, empty: true },
    { slotId: 2, empty: true },
    { slotId: 3, empty: true },
  ];
  const emptyMarkup = renderToStaticMarkup(createElement(SaveSlotsPanel, {
    slots: emptySlots, loading: false, busySlotId: null, feedback: "", confirmation: null,
    onSave() {}, onLoad() {}, onConfirm() {}, onCancel() {},
  }));
  assert.equal((emptyMarkup.match(/尚無存檔/g) ?? []).length, 3);
  assert.doesNotMatch(emptyMarkup, />載入</);
  const occupied = {
    slotId: 1 as const, empty: false as const, formatVersion: 1 as const, sourceRevision: 5,
    savedAt: "2026-09-22T12:34:56.000Z", locationId: "TEST-ruin-entrance" as const,
  };
  const overwrite = renderToStaticMarkup(createElement(SaveSlotsPanel, {
    slots: [occupied, emptySlots[1]!, emptySlots[2]!], loading: false, busySlotId: null, feedback: "",
    confirmation: { kind: "overwrite", slotId: 1 }, onSave() {}, onLoad() {}, onConfirm() {}, onCancel() {},
  }));
  assert.match(overwrite, /確定要覆蓋嗎/);
  assert.match(overwrite, /來源版本/);
  const load = renderToStaticMarkup(createElement(SaveSlotsPanel, {
    slots: [occupied, emptySlots[1]!, emptySlots[2]!], loading: false, busySlotId: null, feedback: "",
    confirmation: { kind: "load", slotId: 1 }, onSave() {}, onLoad() {}, onConfirm() {}, onCancel() {},
  }));
  assert.match(load, /取代目前尚未保存的進度/);
});

test("Load 後 local history 使用 deterministic 系統提示，suggestions 跟隨 loaded state", () => {
  const entries = narrativeEntriesAfterLoad(1);
  assert.equal(entries.length, 2);
  assert.match(entries.at(-1)?.text ?? "", /先前頁面中的探索紀錄未包含/);
  assert.equal(getSuggestedActions("TEST-forest-edge")[0]?.text, "我慢慢走向森林裡的廢墟。");
  assert.equal(getSuggestedActions("TEST-ruin-entrance")[0]?.text, "我仔細查看門上的符號。");
});

test("save implementation 不依賴 interpretation、narration 或 LLM", async () => {
  for (const file of ["service.ts", "contracts.ts", "memory-repository.ts", "postgres-repository.ts"]) {
    const source = await readFile(new URL(`../src/server/save-game/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /interpretation|narration|\/llm\//i);
  }
});

test("PostgreSQL save slots 可跨 repository instance 讀回，Load 後權威 state 仍持久化", {
  skip: !process.env.TEST_DATABASE_URL && "需提供隔離的 TEST_DATABASE_URL 並執行全部 migration。",
}, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 3 });
  const id = `TEST-${randomUUID()}`;
  const initial = seed({ character: { ...seed().character, id } });
  try {
    await pool.query("DELETE FROM save_slots");
    const stateRepository = new PostgresGameStateRepository(pool);
    const session = createPersistedDomainSession(stateRepository, initial);
    await session.getState();
    const saveRepository = new PostgresSaveGameRepository(pool);
    const service = createSaveGameService(saveRepository, session, "postgres");
    await service.save(1, 0);
    const afterRestart = createSaveGameService(
      new PostgresSaveGameRepository(pool),
      createPersistedDomainSession(new PostgresGameStateRepository(pool), initial),
      "postgres",
    );
    assert.equal((await afterRestart.list()).slots[0]?.empty, false);
    await session.execute({ type: "approach-target", expectedRevision: 0, targetId: "TEST-ruin-entrance" });
    const loaded = await service.load(1, 1);
    assert.equal(loaded.state.locationId, "TEST-forest-edge");
    assert.equal(loaded.state.revision, 2);
    const persisted = await new PostgresGameStateRepository(pool).load(id);
    assert.equal(persisted?.revision, 2);
    assert.equal(persisted?.exploration.locationId, "TEST-forest-edge");
  } finally {
    await pool.query("DELETE FROM save_slots").catch(() => undefined);
    await pool.query("DELETE FROM game_states WHERE character_id = $1", [id]).catch(() => undefined);
    await pool.end();
  }
});

test("PostgreSQL save row metadata 必須安全解析", () => {
  const valid = {
    slot_id: 1, format_version: 1, source_revision: "5",
    snapshot: createSaveSnapshot(seed()).state, saved_at: new Date("2026-09-22T12:34:56.000Z"),
  };
  assert.equal(hydrateSaveSlotRow(valid).sourceRevision, 5);
  for (const row of [
    { ...valid, slot_id: 4 },
    { ...valid, source_revision: "9007199254740992" },
    { ...valid, format_version: "1" },
    { ...valid, saved_at: "2026-09-22" },
  ]) assert.throws(() => hydrateSaveSlotRow(row), InvalidStoredSaveRecordError);
});
