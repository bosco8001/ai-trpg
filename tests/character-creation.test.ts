// 尚未執行；交 AI TRPG Architecture Critic 做工程驗證。
import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { generateCreationRecord, CreationFailure } from "../src/domain/character-creation.js";
import { isCreationRequest, isCreationRecord, isCreationState, CREATION_MESSAGES, creationRequestText } from "../src/shared/character-creation.js";
import { OFFICIAL_RACES_V2 } from "../src/server/content/races-v2.js";
import { OFFICIAL_CLASSES_V1 } from "../src/server/content/classes-v1.js";
import { MemoryCreationRepository } from "../src/server/character-creation/memory-repository.js";
import { createCharacterCreationService } from "../src/server/character-creation/service.js";
import { registerCharacterCreationRoutes } from "../src/server/character-creation/routes.js";
import type { CreationRepository } from "../src/server/character-creation/contracts.js";
import { readCreationState, submitCreation, creationMatchesCatalogs, CreationClientFailure } from "../src/web/character-creation-client.js";
import { emptyCreationDraft, creationDraftError, requestFromDraft, readPendingCreation, retainPendingCreation, clearPendingCreation } from "../src/web/character-creation-ui.js";
import { CharacterCreationPanel } from "../src/web/CharacterCreationPanel.js";
import { buildApp } from "../src/server/app.js";
import { createDomainSession } from "../src/server/domain-session.js";
import { createTestGameState } from "../src/server/test-game-state.js";
import { birth, creationRequest, signal, characterId, date, secondRequestId, failure } from "./helpers/character-creation.js";

function setup(repository: CreationRepository = new MemoryCreationRepository()) {
  let draws = 0, ids = 0;
  const service = createCharacterCreationService(repository, "postgres", () => { draws++; return 20; },
    () => { ids++; return characterId; }, () => date);
  return { repository, service, counts: () => ({ draws, ids }) };
}

test("五族 aptitude 的 100 個整數落點吻合正式機率，不會生成零機率資質", () => {
  for (const race of OFFICIAL_RACES_V2.races) {
    const counts = { low: 0, ordinary: 0, high: 0, exceptional: 0 };
    for (let roll = 0; roll < 100; roll++) counts[birth(creationRequest({ raceId: race.id }), [roll,99,0]).aptitude]++;
    assert.deepEqual(counts, race.aptitudePercent);
  }
});
test("施法資格是獨立的第二次抽取：五族 × 四職業均只有 0／100 為 true", () => {
  for (const race of OFFICIAL_RACES_V2.races) for (const profession of OFFICIAL_CLASSES_V1.classes) {
    let eligible = 0;
    for (let roll = 0; roll < 100; roll++) {
      const record = birth(creationRequest({ raceId: race.id, classId: profession.id }), [99,roll,2]);
      eligible += Number(record.directCasting);
      assert.equal(record.lineage, "unrevealed");
      assert.deepEqual(record.unlockedClassIds, [profession.id]);
    }
    assert.equal(eligible, 1);
  }
});
test("龍息三個等機率落點固定為火／冰／雷；其他種族沒有龍息，也不多抽一次", () => {
  for (const [roll, expected] of ["fire", "ice", "lightning"].entries())
    assert.equal(birth(creationRequest({ raceId: "race.dragonborn" }), [99,0,roll]).breath, expected);
  const race = OFFICIAL_RACES_V2.races[0]!, profession = OFFICIAL_CLASSES_V1.classes[0]!;
  const bounds: number[] = [];
  assert.equal(generateCreationRecord(creationRequest(), race, profession, max => { bounds.push(max); return 0; }, characterId, date).breath, null);
  assert.deepEqual(bounds, [100,100]);
  for (const bad of [-1,100,NaN,0.5,Infinity])
    assert.throws(() => generateCreationRecord(creationRequest(), race, profession, () => bad, characterId, date), CreationFailure);
});
test("出生屬性使用正式五族／四職業順序與向下取整；第一次 HP／MP 為滿值", () => {
  const cases = [
    ["race.human",20,[[15,10,10,10,10,10],[12,10,10,10,12,10],[12,12,10,10,10,10],[12,10,10,12,10,10]]],
    ["race.elf",0,[[11,10,8,11,12,10],[9,10,8,11,15,10],[9,12,8,11,12,10],[9,10,8,13,12,10]]],
    ["race.dwarf",0,[[13,9,12,10,10,8],[11,9,12,10,10,8],[11,11,12,10,10,8],[11,9,12,12,10,8]]],
    ["race.orc",0,[[12,12,10,7,12,9],[10,12,10,7,15,9],[10,15,10,7,12,9],[10,12,10,8,12,9]]],
    ["race.dragonborn",0,[[15,10,12,11,10,10],[12,10,12,11,10,10],[12,12,12,11,10,10],[12,10,12,13,10,10]]],
  ] as const;
  for (const [raceId, roll, expected] of cases) for (const [i, profession] of OFFICIAL_CLASSES_V1.classes.entries()) {
    const record = birth(creationRequest({ raceId, classId: profession.id }), [roll,99,0]);
    assert.deepEqual(record.attributes.map(r => r.final), expected[i]);
    assert.equal(record.resources.currentHp, record.resources.maxHp);
    assert.equal(record.resources.currentMp, record.resources.maxMp);
    assert.equal(isCreationRecord(record), true);
  }
  assert.deepEqual(birth().resources, { currentHp: 55, maxHp: 55, currentMp: 60, maxMp: 60 });
  assert.equal(birth(creationRequest({ raceId: "race.orc" }), [0,99]).attributes[3]!.modifier, -2);
});
test("非法或自帶生成結果的輸入整份拒絕，不動 RNG／repository", async () => {
  const f = setup(), request = creationRequest(), sparse = new Array(6); sparse[0] = 12;
  for (const input of [null, { ...request, aptitude: "exceptional" }, { ...request, owner: "someone" },
    { ...request, requestId: "TEST-character" }, { ...request, raceId: "TEST-human" },
    { ...request, classId: "__proto__" }, { ...request, allocation: [7,1,1,1,1,1] },
    { ...request, allocation: [2,2,2,2,2,1] }, { ...request, allocation: [2,2,2,2,2,2.5] },
    { ...request, allocation: [2,2,2,2,2,NaN] }, { ...request, allocation: sparse },
    { ...request, raceId: "race.elf" }, { ...request, raceAllocation: [0,0,0,0,0,0] }]) {
    assert.equal(isCreationRequest(input), false);
    await failure(f.service.create(input, signal()), "invalid-request");
  }
  await failure(f.service.create({ ...request, raceCatalogVersion: 1 }, signal()), "unsupported-version");
  await failure(f.service.create({ ...request, classCatalogVersion: 2 }, signal()), "unsupported-version");
  assert.deepEqual(f.counts(), { draws: 0, ids: 0 }); assert.equal(await f.repository.read(signal()), null);
});
test("同一識別與輸入重試只生成一次；識別／輸入衝突及第二名角色拒絕", async () => {
  const f = setup(), request = creationRequest(), copy = structuredClone(request);
  assert.equal((await f.service.read(signal())).state, "empty");
  const first = await f.service.create(request, signal());
  assert.deepEqual(await f.service.create({ ...request }, signal()), first);
  assert.deepEqual(await f.service.read(signal()), first);
  await failure(f.service.create({ ...request, classId: "class.mage" }, signal()), "request-conflict");
  await failure(f.service.create({ ...request, requestId: secondRequestId }, signal()), "already-created");
  assert.deepEqual(f.counts(), { draws: 2, ids: 1 }); assert.deepEqual(request, copy);
  assert.ok(first.record); (first.record.request.allocation as number[])[0] = 999;
  assert.equal((await f.service.read(signal())).record!.request.allocation[0], 2);
});
test("兩個服務並行建立只接受一名角色；另一方不進行抽取", async () => {
  const f = setup(), other = setup(f.repository);
  const outcomes = await Promise.allSettled([f.service.create(creationRequest(), signal()), other.service.create(creationRequest({ requestId: secondRequestId }), signal())]);
  assert.equal(outcomes.filter(r => r.status === "fulfilled").length, 1);
  const rejected = outcomes.find(r => r.status === "rejected"); assert.ok(rejected?.status === "rejected");
  assert.ok(rejected.reason instanceof CreationFailure); assert.equal(rejected.reason.code, "already-created");
  assert.equal(f.counts().draws + other.counts().draws, 2);
});
test("保存後遺失回應：同一次重試讀回原紀錄，不重新抽取", async () => {
  const saved = new MemoryCreationRepository(); let lost = true;
  const repo: CreationRepository = { read: saved.read.bind(saved), async create(request, generate, s) {
    const result = await saved.create(request, generate, s);
    if (lost) { lost = false; throw new CreationFailure("unavailable"); } return result;
  } };
  const f = setup(repo); await failure(f.service.create(creationRequest(), signal()), "unavailable");
  const recovered = await f.service.create(creationRequest(), signal());
  assert.deepEqual(await f.service.read(signal()), recovered); assert.deepEqual(f.counts(), { draws: 2, ids: 1 });
});
test("生成或保存確定失敗沒有成功紀錄，草稿不變，可手動重試", async () => {
  const repo = new MemoryCreationRepository(); let fail = true, calls = 0;
  const f = createCharacterCreationService(repo, "postgres", () => { calls++; if (fail) throw new Error("synthetic RNG failure"); return 20; }, () => characterId, () => date);
  const request = creationRequest(), copy = structuredClone(request);
  await assert.rejects(f.create(request, signal())); assert.equal((await f.read(signal())).state, "empty");
  fail = false; assert.equal((await f.create(request, signal())).state, "created");
  assert.equal(calls, 3); assert.deepEqual(request, copy);
});
test("等待 repository 時外部修改原輸入不改變已確認的建立內容", async () => {
  let resume!: () => void;
  const gate = new Promise<void>(resolve => { resume = resolve; }), saved = new MemoryCreationRepository();
  const repo: CreationRepository = { read: saved.read.bind(saved), async create(request, generate, s) {
    await gate; return saved.create(request, generate, s);
  } };
  const f = setup(repo), request = creationRequest(), confirmed = structuredClone(request);
  const pending = f.service.create(request, signal());
  (request.allocation as number[])[0] = 4; (request.allocation as number[])[1] = 0; resume();
  assert.deepEqual((await pending).record!.request, confirmed);
  assert.deepEqual((await f.service.read(signal())).record!.request, confirmed);
});
test("保存後請求被取消不返回成功結果；再次查詢／同次重試讀回原始出生紀錄", async () => {
  const controller = new AbortController(), saved = new MemoryCreationRepository(); let cancelOnce = true;
  const repo: CreationRepository = { read: saved.read.bind(saved), async create(request, generate, s) {
    const value = await saved.create(request, generate, s);
    if (cancelOnce) { cancelOnce = false; controller.abort(); } return value;
  } };
  const f = setup(repo), request = creationRequest();
  await assert.rejects(f.service.create(request, controller.signal));
  const original = await f.service.read(signal()); assert.equal(original.state, "created");
  assert.deepEqual(await f.service.create(request, signal()), original);
  assert.deepEqual(f.counts(), { draws: 2, ids: 1 });
});
test("損壞紀錄、非官方快照及錯誤 request 綁定拒絕，不自動修補或重新生成", async () => {
  const good = birth();
  const variants = [{ ...good, rulesVersion: 2 }, { ...good, lineage: "invented" }, { ...good, breath: "fire" },
    { ...good, unlockedClassIds: ["class.swordsman", "class.mage"] }, { ...good, resources: { ...good.resources, currentHp: 0 } },
    { ...good, resources: { ...good.resources, maxMp: 999 } }, { ...good, aptitude: "made-up" },
    { ...good, characterId: "TEST-character" }, { ...good, createdAt: "2026-02-30T00:00:00.000Z" },
    { ...good, race: { ...good.race, name: "非官方名稱" } },
    { ...good, profession: { ...good.profession, passive: { ...good.profession.passive, name: "非官方被動" } } }];
  for (const value of variants) {
    const f = setup({ async read() { return value; }, async create() { return value; } });
    await failure(f.service.read(signal()), "invalid-record");
    await failure(f.service.create(creationRequest(), signal()), "invalid-record");
    assert.equal(f.counts().draws, 0);
  }
  const different = setup({ async read() { return good; }, async create() { return good; } });
  await failure(different.service.create(creationRequest({ requestId: secondRequestId }), signal()), "invalid-record");
  assert.equal(isCreationRecord({ ...good, race: { ...good.race, name: "非官方名稱" } }), true);
  assert.equal(creationMatchesCatalogs({ ...good, race: { ...good.race, name: "非官方名稱" } }, OFFICIAL_RACES_V2, OFFICIAL_CLASSES_V1), false);
});
test("memory runtime 不提供臨時成功角色；預先取消不呼叫 repository 或 RNG", async () => {
  const f = setup(), memory = createCharacterCreationService(f.repository, "memory");
  await failure(memory.read(signal()), "postgres-required"); await failure(memory.create(creationRequest(), signal()), "postgres-required");
  await failure(createCharacterCreationService(undefined, "postgres").read(signal()), "unavailable");
  const c = new AbortController(); c.abort();
  await assert.rejects(f.service.create(creationRequest(), c.signal)); await assert.rejects(f.service.read(c.signal));
  assert.deepEqual(f.counts(), { draws: 0, ids: 0 }); assert.equal(await f.repository.read(signal()), null);
});
test("HTTP：有界請求、固定錯誤、no-store；既有 TEST 遊戲與存檔完全不變", async t => {
  const repo = new MemoryCreationRepository(), session = createDomainSession(createTestGameState());
  const before = structuredClone(session.getState());
  const app = await buildApp({ storage: "postgres", domainSession: session, creationRepository: repo }); t.after(() => app.close());
  const slots = (await app.inject("/api/save-slots")).body, request = creationRequest();
  const created = await app.inject({ method: "POST", url: "/api/character-creation", payload: request });
  assert.equal(created.statusCode, 200); assert.equal(isCreationState(created.json()), true);
  assert.equal(created.headers["cache-control"], "no-store");
  assert.equal((await app.inject("/api/character-creation")).body, created.body);
  for (const [input, status, code] of [[{ ...request, owner_key: "private-marker" },400,"invalid-request"],
    [{ ...request, schemaVersion: 2 },409,"unsupported-version"],
    [{ ...request, classId: "class.mage" },409,"request-conflict"],
    [{ ...request, requestId: secondRequestId },409,"already-created"]] as const) {
    const res = await app.inject({ method: "POST", url: "/api/character-creation", payload: input });
    assert.equal(res.statusCode, status); assert.deepEqual(res.json(), { code, message: CREATION_MESSAGES[code] });
    assert.equal(res.headers["cache-control"], "no-store"); assert.doesNotMatch(res.body, /private-marker|stack|node_modules/);
  }
  for (const payload of ['{"private-marker":', ' '.repeat(4097)]) {
    const res = await app.inject({ method: "POST", url: "/api/character-creation", payload, headers: { "content-type": "application/json" } });
    assert.ok([400,413].includes(res.statusCode)); assert.equal(res.json().code, "invalid-request"); assert.doesNotMatch(res.body, /private-marker|stack/);
  }
  assert.equal((await app.inject("/api/character-creation?owner=other")).statusCode, 400);
  assert.equal((await app.inject({ method: "DELETE", url: "/api/character-creation" })).statusCode, 404);
  assert.deepEqual(session.getState(), before); assert.equal((await app.inject("/api/save-slots")).body, slots);
});
test("HTTP repository 原始錯誤與 memory 提示不含 SQL／路徑／連線參數", async t => {
  for (const storage of ["memory", "postgres"] as const) {
    const app = Fastify(); t.after(() => app.close());
    const unsafe = () => { throw new Error("postgres://user:secret@127.0.0.1:55426 SQL node_modules stack"); };
    registerCharacterCreationRoutes(app, { read: unsafe, create: unsafe }, storage);
    for (const method of ["GET", "POST"] as const) {
      const res = await app.inject({ method, url: "/api/character-creation", ...(method === "POST" ? { payload: creationRequest() } : {}) });
      assert.equal(res.statusCode, 503); assert.equal(res.json().code, storage === "memory" ? "postgres-required" : "unavailable");
      assert.doesNotMatch(res.body, /secret|127\.0\.0\.1|55426|SQL|node_modules|stack|postgres:\/\//);
    }
  }
});

function json(value: unknown, status = 200) {
  const text = JSON.stringify(value);
  return new Response(text, { status, headers: { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(text)) } });
}
test("前端回應須綁定本次輸入與名冊，超大／截斷／取消回應不顯示生成結果", async () => {
  const request = creationRequest(), record = birth(request), state = { schemaVersion: 1, storage: "postgres", state: "created", record };
  const fetcher: typeof fetch = async (url, options) => {
    assert.equal(url, "/api/character-creation"); assert.equal(options?.method, "POST"); assert.equal(options?.cache, "no-store");
    assert.deepEqual(JSON.parse(options!.body as string), request); return json(state);
  };
  assert.deepEqual(await submitCreation(request, signal(), fetcher), state);
  assert.equal(creationMatchesCatalogs(record, OFFICIAL_RACES_V2, OFFICIAL_CLASSES_V1), true);
  for (const value of [{ ...state, storage: "memory" }, { ...state, record: null }, { ...state, record: { ...record, rulesVersion: 2 } },
    { ...state, record: birth(creationRequest({ requestId: secondRequestId })) }])
    await assert.rejects(submitCreation(request, signal(), async () => json(value)));
  const changed = { ...record, race: { ...record.race, name: "其他" } };
  assert.equal(creationMatchesCatalogs(changed, OFFICIAL_RACES_V2, OFFICIAL_CLASSES_V1), false);
  await assert.rejects(readCreationState(signal(), async () => new Response("{}", { headers: { "Content-Length": "32769" } })));
  await assert.rejects(readCreationState(signal(), async () => new Response(" ".repeat(32769))));
  await assert.rejects(readCreationState(signal(), async () => new Response('{"schemaVersion":')));
  const c = new AbortController(); c.abort();
  await assert.rejects(readCreationState(c.signal, async () => { assert.fail("預先取消不送 fetch"); }));
  const later = new AbortController();
  await assert.rejects(readCreationState(later.signal, async () => { later.abort(); return json(state); }));
  await assert.rejects(readCreationState(signal(), async () => json({ code: "unavailable", message: "raw SQL secret" }, 503)),
    (e: unknown) => e instanceof CreationClientFailure && e.message === CREATION_MESSAGES.unavailable);
});
test("草稿不抽取；pending 只保留原輸入與識別，重整仍一致，損壞／無法儲存時阻止建立", () => {
  const draft = emptyCreationDraft(); assert.notEqual(creationDraftError(draft, OFFICIAL_RACES_V2, OFFICIAL_CLASSES_V1), "");
  const request = creationRequest(), copy = structuredClone(request);
  const filled = { raceId: request.raceId, classId: request.classId, allocation: [...request.allocation], raceAllocation: [...request.raceAllocation] };
  assert.equal(creationDraftError(filled, OFFICIAL_RACES_V2, OFFICIAL_CLASSES_V1), "");
  assert.equal(creationRequestText(requestFromDraft(filled, request.requestId)), creationRequestText(request));
  let text: string | null = null;
  const storage = { getItem: () => text, setItem: (_key: string, value: string) => { text = value; }, removeItem: () => { text = null; } };
  assert.equal(readPendingCreation(storage), null); retainPendingCreation(storage, request);
  assert.deepEqual(readPendingCreation(storage), copy); assert.doesNotMatch(text!, /aptitude|directCasting|characterId|resources/);
  clearPendingCreation(storage); assert.equal(readPendingCreation(storage), null);
  for (const corrupted of ["{", "{}", JSON.stringify({ ...request, allocation: [] }), "x".repeat(4097)]) {
    text = corrupted; assert.throws(() => readPendingCreation(storage)); assert.equal(text, corrupted);
  }
  assert.throws(() => retainPendingCreation({ getItem: () => null, setItem: () => {} }, request));
  assert.throws(() => retainPendingCreation({ getItem: () => null, setItem: () => { throw new Error("blocked"); } }, request));
  assert.deepEqual(request, copy);
});
test("Node SSR 不讀瀏覽器儲存或載入 CSS；初始只顯示入口，不預先揭曉", () => {
  const markup = renderToStaticMarkup(createElement(CharacterCreationPanel));
  assert.match(markup, /角色建立與核對/); assert.match(markup, /aria-haspopup="dialog"/);
  assert.doesNotMatch(markup, /<dialog|直接施法資格：|魔力資質：/);
});
