// 尚未由開發代理執行；交 AI TRPG Architecture Critic 驗證。
import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { createOfficialClassCatalog, ClassCatalogFailure, registerClassCatalogRoutes } from "../src/server/class-catalog.js";
import { OFFICIAL_CLASSES_V1 } from "../src/server/content/classes-v1.js";
import { isOfficialClassCatalog } from "../src/shared/class-catalog.js";
import { CONTENT_ATTRIBUTES } from "../src/shared/content-catalog.js";
import { readClassCatalog } from "../src/web/class-catalog-client.js";
import { createDomainSession } from "../src/server/domain-session.js";
import { createTestGameState } from "../src/server/test-game-state.js";
import { buildApp } from "../src/server/app.js";

test("四個正式初階職業符合 Canon，只有主項 ×1.25，沒有起始配裝或自動施法資格", () => {
  const { catalog } = createOfficialClassCatalog();
  assert.equal(catalog.catalogVersion, 1);
  assert.deepEqual(catalog.classes.map(c => [c.id, c.name, c.primaryAttribute, CONTENT_ATTRIBUTES.map(k => c.attributeMultipliers[k]), c.passive.effect]), [
    ["class.swordsman", "劍士", "strength", [1.25, 1, 1, 1, 1, 1], { kind: "sword-active-skill-damage", multiplier: 1.1 }],
    ["class.archer", "弓箭手", "perception", [1, 1, 1, 1, 1.25, 1], { kind: "shooting-active-skill-attack-check", bonus: 1 }],
    ["class.scout", "斥候", "dexterity", [1, 1.25, 1, 1, 1, 1], { kind: "evasion-check", bonus: 1 }],
    ["class.mage", "魔術師", "intelligence", [1, 1, 1, 1.25, 1, 1], { kind: "qualified-casting-total-mp", multiplier: 0.9,
      rounding: "ceil", positiveMinimum: 1, zeroCost: 0, sources: ["direct", "spellbook"] }],
  ]);
  assert.doesNotMatch(JSON.stringify(catalog), /startingSkills|startingEquipment|directCasting|TEST-/);
});
test("只查指定種類／版本的正式 ID，未知或 TEST 資料不回退", () => {
  const service = createOfficialClassCatalog();
  for (const entry of service.catalog.classes) assert.equal(service.resolve("class", entry.id, 1), entry);
  for (const id of ["TEST-swordsman", "race.human", "class.missing", "__proto__", "constructor"])
    assert.throws(() => service.resolve("class", id, 1), (e: unknown) => e instanceof ClassCatalogFailure && e.code === "unknown-content");
  assert.throws(() => service.resolve("race", "class.mage", 1), ClassCatalogFailure);
  for (const version of [0, 2, NaN]) assert.throws(() => service.resolve("class", "class.mage", version),
    (e: unknown) => e instanceof ClassCatalogFailure && e.code === "unsupported-version");
});
test("非法整份名冊拒絕，不接受缺漏、重複、錯誤倍率、被動或偷偷附加規則", () => {
  const variants: ((v: typeof OFFICIAL_CLASSES_V1) => void)[] = [
    v => { Reflect.set(v, "catalogVersion", 2); },
    v => { Reflect.set(v, "namespace", "test"); },
    v => { Reflect.set(v.classes[1]!, "id", "class.swordsman"); },
    v => { Reflect.set(v.classes[0]!, "id", "TEST-swordsman"); },
    v => { Reflect.set(v.classes[0]!, "primaryAttribute", "intelligence"); },
    v => { Reflect.set(v.classes[0]!.attributeMultipliers, "strength", 1.5); },
    v => { Reflect.set(v.classes[0]!.attributeMultipliers, "dexterity", NaN); },
    v => { Reflect.set(v.classes[0]!.attributeMultipliers, "extra", 1); },
    v => { Reflect.set(v.classes[0]!, "name", ""); },
    v => { Reflect.deleteProperty(v.classes[0]!, "passive"); },
    v => { Reflect.set(v.classes[0]!.passive.effect, "kind", "evasion-check"); },
    v => { Reflect.set(v.classes[3]!.passive.effect, "positiveMinimum", 0); },
    v => { Reflect.set(v.classes[3]!.passive.effect, "sources", ["direct", "spellbook", "scroll"]); },
    v => { Reflect.set(v.classes[3]!, "directCasting", true); },
    v => { Reflect.set(v.classes, "length", 3); },
    v => { Reflect.deleteProperty(v.classes, "0"); },
  ];
  for (const change of variants) {
    const value = structuredClone(OFFICIAL_CLASSES_V1); change(value);
    assert.equal(isOfficialClassCatalog(value), false);
    assert.throws(() => createOfficialClassCatalog(value), { message: "正式職業名冊格式不合法，未載入任何職業。" });
  }
});
test("載入前複製與驗證同一快照，所有巢狀資料凍結，getter 與呼叫者不能換內容", () => {
  const input = structuredClone(OFFICIAL_CLASSES_V1);
  let reads = 0;
  Object.defineProperty(input.classes[0]!, "name", { enumerable: true, get: () => ++reads === 1 ? "劍士" : "TEST-變更" });
  const service = createOfficialClassCatalog(input);
  assert.equal(reads, 1); assert.equal(service.resolve("class", "class.swordsman", 1).name, "劍士");
  Reflect.set(input.classes[0]!.attributeMultipliers, "strength", 999);
  assert.equal(service.catalog.classes[0]!.attributeMultipliers.strength, 1.25);
  assert.equal(Object.isFrozen(service.catalog), true); assert.equal(Object.isFrozen(service.catalog.classes), true);
  for (const entry of service.catalog.classes) {
    for (const value of [entry, entry.attributeMultipliers, entry.passive, entry.passive.effect]) assert.equal(Object.isFrozen(value), true);
    if (entry.passive.effect.kind === "qualified-casting-total-mp") assert.equal(Object.isFrozen(entry.passive.effect.sources), true);
  }
  assert.throws(() => Object.assign(service.catalog.classes[0]!.passive.effect, { multiplier: 99 }));
  assert.throws(() => createOfficialClassCatalog({ uncloneable() {} }));
});
test("HTTP：嚴格唯讀查詢、固定錯誤、獨立版本，角色與存檔不受影響", async t => {
  const app = Fastify(); registerClassCatalogRoutes(app); t.after(() => app.close());
  const good = await app.inject("/api/class-catalog");
  assert.equal(good.statusCode, 200); assert.equal(isOfficialClassCatalog(good.json()), true);
  assert.equal(good.headers["cache-control"], "no-store");
  for (const id of OFFICIAL_CLASSES_V1.classes.map(c => c.id)) {
    const resolved = await app.inject(`/api/class-catalog/resolve?kind=class&id=${id}&version=1`);
    assert.equal(resolved.statusCode, 200); assert.equal(resolved.json().definition.id, id);
  }
  for (const [url, status] of [
    ["/api/class-catalog?extra=1", 400],
    ["/api/class-catalog/resolve?kind=class&id=class.mage", 400],
    ["/api/class-catalog/resolve?kind=class&id=class.mage&version=1&extra=1", 400],
    ["/api/class-catalog/resolve?kind=class&id=class.mage&version=1&version=2", 400],
    ["/api/class-catalog/resolve?kind=class&id=class.mage&version=01", 400],
    ["/api/class-catalog/resolve?kind=race&id=class.mage&version=1", 400],
    ["/api/class-catalog/resolve?kind=class&id=TEST-skill-1&version=1", 404],
    ["/api/class-catalog/resolve?kind=class&id=class.mage&version=2", 409],
  ] as const) {
    const response = await app.inject(url); assert.equal(response.statusCode, status);
    assert.equal(response.headers["cache-control"], "no-store"); assert.doesNotMatch(response.body, /TEST-skill-1|stack|node_modules/);
  }
  assert.equal((await app.inject({ method: "POST", url: "/api/class-catalog", payload: {} })).statusCode, 404);
  const session = createDomainSession(createTestGameState()), before = structuredClone(session.getState());
  const gameApp = await buildApp({ domainSession: session }); t.after(() => gameApp.close());
  const beforeSlots = (await gameApp.inject("/api/save-slots")).json();
  await gameApp.inject("/api/class-catalog");
  await gameApp.inject("/api/class-catalog/resolve?kind=class&id=class.mage&version=1");
  assert.deepEqual(session.getState(), before);
  assert.deepEqual((await gameApp.inject("/api/save-slots")).json(), beforeSlots);
  assert.equal((await gameApp.inject("/api/content-catalog")).json().catalogVersion, 2);
});
test("前端讀取器：只接受完整、有界的正式名冊；取消／錯誤回應不顯示部分內容", async () => {
  function response(body: string, headers: Record<string, string> = {}) {
    return new Response(body, { headers: { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(body)), ...headers } });
  }
  const body = JSON.stringify(OFFICIAL_CLASSES_V1);
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(url, "/api/class-catalog"); assert.equal(init?.cache, "no-store"); assert.ok(init?.signal);
    return response(body);
  };
  assert.equal((await readClassCatalog(new AbortController().signal, fetcher)).classes.length, 4);
  for (const make of [() => response("{"), () => response("{}"), () => response(body, { "Content-Length": "32769" }),
    () => response(body, { "Content-Length": "1" }), () => response(body, { "Content-Type": "text/html" }),
    () => new Response("private raw error", { status: 500 })])
    await assert.rejects(readClassCatalog(new AbortController().signal, async () => make()));
  const aborted = new AbortController(); aborted.abort(); let called = false;
  await assert.rejects(readClassCatalog(aborted.signal, async () => { called = true; return response(body); }));
  assert.equal(called, false);
});
