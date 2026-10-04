// 尚未由開發代理執行；交指定 AI TRPG Architecture Critic 驗證。
import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { createOfficialContentCatalog, ContentCatalogFailure, registerContentCatalogRoutes } from "../src/server/content-catalog.js";
import { OFFICIAL_RACES_V2 } from "../src/server/content/races-v2.js";
import { CONTENT_KINDS, isOfficialContentCatalog } from "../src/shared/content-catalog.js";
import { createDomainSession } from "../src/server/domain-session.js";
import { createTestGameState } from "../src/server/test-game-state.js";
import { buildApp } from "../src/server/app.js";

test("五種族已定數值與 Canon 一致，資質和資格不混合", () => {
  const { catalog } = createOfficialContentCatalog();
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.catalogVersion, 2);
  assert.deepEqual(catalog.races.map(r => [r.id, r.name, r.freeAttributePoints,
    Object.values(r.attributeModifiers), Object.values(r.aptitudePercent), r.aptitudeReveal]), [
    ["race.human", "人類", 2, [0, 0, 0, 0, 0, 0], [20, 65, 14, 1], "after-creation"],
    ["race.elf", "精靈", 0, [-1, 0, -2, 1, 2, 0], [0, 0, 70, 30], "after-creation"],
    ["race.dwarf", "矮人", 0, [1, -1, 2, 0, 0, -2], [0, 100, 0, 0], "after-creation"],
    ["race.orc", "獸人", 0, [0, 2, 0, -3, 2, -1], [85, 14, 1, 0], "after-creation"],
    ["race.dragonborn", "龍裔", 0, [2, 0, 2, 1, 0, 0], [0, 65, 30, 5], "after-creation"],
  ]);
  assert.doesNotMatch(JSON.stringify(catalog), /castingEligibility|directCasting|代行者級|TEST-/);
});
test("未知、TEST、錯誤種類及不支援版本沒有預設回退", () => {
  const service = createOfficialContentCatalog();
  assert.equal(service.resolve("race", "race.human", 2).name, "人類");
  for (const kind of CONTENT_KINDS) for (const id of ["TEST-character", "TEST-skill-1", "TEST-combat-consumable", "__proto__", "constructor", "race.missing"])
    assert.throws(() => service.resolve(kind, id, 2), (e: unknown) => e instanceof ContentCatalogFailure && e.code === "unknown-content");
  assert.throws(() => service.resolve("class", "race.human", 2), ContentCatalogFailure);
  assert.throws(() => service.resolve("race", "race.human", 3), (e: unknown) => e instanceof ContentCatalogFailure && e.code === "unsupported-version");
  assert.throws(() => service.resolve("race", "race.human", 1), (e: unknown) => e instanceof ContentCatalogFailure && e.code === "unsupported-version");
});
test("非法名冊整份拒絕，不接受重複 ID、額外欄位或非法機率", () => {
  const variants = [
    (v: typeof OFFICIAL_RACES_V2) => { v.races[1]!.id = v.races[0]!.id; },
    (v: typeof OFFICIAL_RACES_V2) => { v.races[0]!.id = "TEST-human"; },
    (v: typeof OFFICIAL_RACES_V2) => { v.races[0]!.aptitudePercent.low = 21; },
    (v: typeof OFFICIAL_RACES_V2) => { v.races[0]!.attributeModifiers.strength = NaN; },
    (v: typeof OFFICIAL_RACES_V2) => { Object.assign(v.races[0]!.attributeModifiers, { extra: 0 }); },
    (v: typeof OFFICIAL_RACES_V2) => { Reflect.deleteProperty(v.races[0]!, "aptitudeReveal"); },
    (v: typeof OFFICIAL_RACES_V2) => { v.races[0]!.aptitudeReveal = "unspecified"; },
    (v: typeof OFFICIAL_RACES_V2) => { v.races[0]!.aptitudeReveal = "before-creation"; },
    (v: typeof OFFICIAL_RACES_V2) => { v.races[0]!.attributeModifiers.strength = 13; },
    (v: typeof OFFICIAL_RACES_V2) => { v.races[0]!.attributeModifiers.strength = -13; },
    (v: typeof OFFICIAL_RACES_V2) => { v.races[0]!.freeAttributePoints = 13; },
    (v: typeof OFFICIAL_RACES_V2) => { v.schemaVersion = 2; },
    (v: typeof OFFICIAL_RACES_V2) => { Object.assign(v.races[0]!, { directCasting: true }); },
    (v: typeof OFFICIAL_RACES_V2) => { v.catalogVersion = 1; },
    (v: typeof OFFICIAL_RACES_V2) => { v.namespace = "test"; },
    (v: typeof OFFICIAL_RACES_V2) => { v.races.pop(); },
  ];
  for (const change of variants) {
    const value = structuredClone(OFFICIAL_RACES_V2); change(value);
    assert.equal(isOfficialContentCatalog(value), false);
    assert.throws(() => createOfficialContentCatalog(value));
  }
});
test("先複製再驗證同一份資料，getter 不能在驗證後替換內容", () => {
  const input = structuredClone(OFFICIAL_RACES_V2);
  let reads = 0;
  Object.defineProperty(input.races[0]!, "name", {
    enumerable: true, get() { return ++reads === 1 ? "人類" : "TEST-變"; },
  });
  const service = createOfficialContentCatalog(input);
  assert.equal(reads, 1);
  assert.equal(service.resolve("race", "race.human", 2).name, "人類");

  const invalid = structuredClone(OFFICIAL_RACES_V2);
  let invalidReads = 0;
  Object.defineProperty(invalid.races[0]!, "name", {
    enumerable: true, get() { return ++invalidReads === 1 ? "" : "人類"; },
  });
  assert.throws(() => createOfficialContentCatalog(invalid), {
    message: "正式內容名冊格式不合法，未載入任何內容。",
  });
  assert.equal(invalidReads, 1);
  assert.throws(() => createOfficialContentCatalog({ uncloneable() {} }), {
    message: "正式內容名冊格式不合法，未載入任何內容。",
  });
});
test("名冊不可變，原始輸入與呼叫者不能改已載入內容", () => {
  const input = structuredClone(OFFICIAL_RACES_V2), service = createOfficialContentCatalog(input);
  input.races[0]!.name = "未核准名稱";
  assert.equal(service.resolve("race", "race.human", 2).name, "人類");
  assert.equal(Object.isFrozen(service.catalog), true);
  assert.equal(Object.isFrozen(service.catalog.races), true);
  assert.equal(Object.isFrozen(service.catalog.pendingKinds), true);
  for (const race of service.catalog.races) {
    assert.equal(Object.isFrozen(race), true);
    assert.equal(Object.isFrozen(race.attributeModifiers), true);
    assert.equal(Object.isFrozen(race.aptitudePercent), true);
  }
  assert.throws(() => Object.assign(service.catalog.races[0]!, { name: "未核准名稱" }));
  assert.throws(() => Object.assign(service.catalog.races[0]!.attributeModifiers, { strength: 999 }));
  assert.throws(() => Object.assign(service.catalog.races[0]!.aptitudePercent, { low: 100 }));
});
test("HTTP：嚴格唯讀查詢、安全固定錯誤、不改既有遊戲狀態", async t => {
  const app = Fastify(); registerContentCatalogRoutes(app); t.after(() => app.close());
  const response = await app.inject("/api/content-catalog");
  assert.equal(response.statusCode, 200); assert.equal(isOfficialContentCatalog(response.json()), true);
  assert.equal(response.headers["cache-control"], "no-store");
  const good = await app.inject("/api/content-catalog/resolve?kind=race&id=race.human&version=2");
  assert.equal(good.statusCode, 200); assert.equal(good.json().definition.name, "人類");
  assert.equal(good.json().catalogVersion, 2);
  assert.equal(good.headers["cache-control"], "no-store");
  for (const url of ["/api/content-catalog?extra=1", "/api/content-catalog/resolve?kind=race&id=race.human",
    "/api/content-catalog/resolve?kind=race&id=race.human&version=2&extra=1",
    "/api/content-catalog/resolve?kind=race&id=race.human&version=2&version=3"])
  {
    const bad = await app.inject(url);
    assert.equal(bad.statusCode, 400);
    assert.equal(bad.headers["cache-control"], "no-store");
  }
  const unknown = await app.inject("/api/content-catalog/resolve?kind=skill&id=TEST-skill-1&version=2");
  assert.equal(unknown.statusCode, 404); assert.equal(unknown.json().code, "unknown-content");
  assert.equal(unknown.headers["cache-control"], "no-store");
  assert.doesNotMatch(unknown.body, /TEST-skill-1|stack|node_modules/);
  const unsupported = await app.inject("/api/content-catalog/resolve?kind=race&id=race.human&version=3");
  assert.equal(unsupported.statusCode, 409);
  assert.equal(unsupported.headers["cache-control"], "no-store");
  const oldVersion = await app.inject("/api/content-catalog/resolve?kind=race&id=race.human&version=1");
  assert.equal(oldVersion.statusCode, 409);
  assert.equal(oldVersion.json().code, "unsupported-version");
  assert.equal(oldVersion.headers["cache-control"], "no-store");
  const session = createDomainSession(createTestGameState()), before = structuredClone(session.getState());
  const gameApp = await buildApp({ domainSession: session }); t.after(() => gameApp.close());
  await gameApp.inject("/api/content-catalog"); await gameApp.inject("/api/content-catalog/resolve?kind=race&id=race.human&version=2");
  assert.deepEqual(session.getState(), before);
});
