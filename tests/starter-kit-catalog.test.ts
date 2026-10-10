// 首版 49f23f9 已獲 Grok 外部工程 PASS；本次新增案例待複驗，Codex 未親測。
import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { CONTENT_ATTRIBUTES } from "../src/shared/content-catalog.js";
import { isOfficialStarterKitCatalog, type OfficialStarterKitCatalog } from "../src/shared/starter-kit-catalog.js";
import { OFFICIAL_STARTER_KITS_V1 } from "../src/server/content/starter-kits-v1.js";
import { createOfficialStarterKitCatalog, registerStarterKitCatalogRoutes, StarterKitCatalogFailure } from "../src/server/starter-kit-catalog.js";
import { readStarterKitCatalog } from "../src/web/starter-kit-catalog-client.js";
import { buildApp } from "../src/server/app.js";
import { createDomainSession } from "../src/server/domain-session.js";
import { createTestGameState } from "../src/server/test-game-state.js";
import { MemoryCreationRepository } from "../src/server/character-creation/memory-repository.js";
import { birth, creationRequest, signal } from "./helpers/character-creation.js";

test("八件正式裝備與四項能力精確符合使用者首版數值，沒有補入戰鬥假值", () => {
  const { catalog } = createOfficialStarterKitCatalog();
  assert.equal(catalog.catalogVersion, 1); assert.equal(catalog.classCatalogVersion, 1);
  assert.deepEqual(catalog.items.map(i => [i.id, i.name, i.requirement.attribute, i.requirement.minimum,
    CONTENT_ATTRIBUTES.map(k => i.attributeBonuses[k]), i.armor]), [
    ["item.one-handed-sword", "單手劍", "strength", 10, [1,0,0,0,0,0], 0],
    ["item.shortbow", "短弓", "dexterity", 10, [0,0,0,0,1,0], 0],
    ["item.dagger", "匕首", "dexterity", 10, [0,1,0,0,0,0], 0],
    ["item.wooden-staff", "普通木杖", "strength", 6, [0,0,0,0,0,0], 0],
    ["item.chainmail", "鎖甲", "strength", 10, [0,0,1,0,0,0], 3],
    ["item.leather-armor", "皮甲", "dexterity", 10, [0,1,0,0,0,0], 2],
    ["item.cloth-robe", "布袍", "intelligence", 10, [0,0,0,2,0,0], 1],
    ["item.fire-arrow-spellbook", "火焰箭魔法書", "intelligence", 12, [0,0,0,0,0,0], 0],
  ]);
  assert.deepEqual(catalog.abilities.map(a => [a.id, a.name, a.requirement.attribute, a.requirement.minimum,
    CONTENT_ATTRIBUTES.map(k => a.attributeBonuses[k]), a.combatRules]), [
    ["skill.heavy-slash", "重斬", "strength", 15, [1,0,0,0,0,0], "unresolved"],
    ["skill.aimed-shot", "瞄準射擊", "perception", 15, [0,0,0,0,1,0], "unresolved"],
    ["skill.swift-thrust", "迅刺", "dexterity", 15, [0,1,0,0,0,0], "unresolved"],
    ["spell.fire-arrow", "火焰箭", "intelligence", 15, [0,0,0,1,0,0], "unresolved"],
  ]);
  assert.doesNotMatch(JSON.stringify(catalog), /damageRange|mpCost|cooldown|castTurns|TEST-|directCasting/);
});
test("四配套各一件，物理技能為已學、火焰箭只由書提供，熟練與合法來源分開", () => {
  const { catalog } = createOfficialStarterKitCatalog();
  assert.deepEqual(catalog.kits.map(k => [k.classId, k.itemIds, k.ability, k.weaponProficiency]), [
    ["class.swordsman", ["item.one-handed-sword", "item.chainmail"], { id: "skill.heavy-slash", acquisition: "learned" }, "sword"],
    ["class.archer", ["item.shortbow", "item.leather-armor"], { id: "skill.aimed-shot", acquisition: "learned" }, "bow"],
    ["class.scout", ["item.dagger", "item.leather-armor"], { id: "skill.swift-thrust", acquisition: "learned" }, "dagger"],
    ["class.mage", ["item.wooden-staff", "item.cloth-robe", "item.fire-arrow-spellbook"], { id: "spell.fire-arrow", acquisition: "spellbook" }, "staff"],
  ]);
  assert.deepEqual(catalog.abilities.map(a => a.source), [
    { kind: "learned-with-active-weapon", weaponFamily: "sword" },
    { kind: "learned-with-active-weapon", weaponFamily: "bow" },
    { kind: "learned-with-active-weapon", weaponFamily: "dagger" },
    { kind: "spellbook-or-qualified-learned", spellbookId: "item.fire-arrow-spellbook" },
  ]);
});
test("未知、錯種類、TEST、特殊物件名稱與不支援版本均拒絕引用，不回退", () => {
  const service = createOfficialStarterKitCatalog();
  for (const i of service.catalog.items) assert.equal(service.resolve("item", i.id, 1), i);
  for (const a of service.catalog.abilities) assert.equal(service.resolve(a.kind === "spell" ? "spell" : "skill", a.id, 1), a);
  for (const k of service.catalog.kits) assert.equal(service.resolve("kit", k.id, 1), k);
  for (const [kind, id] of [["item", "TEST-sword"], ["item", "constructor"], ["kit", "__proto__"],
    ["skill", "spell.fire-arrow"], ["spell", "skill.heavy-slash"], ["item", "skill.heavy-slash"], ["race", "race.human"]])
    assert.throws(() => service.resolve(kind!, id!, 1), (e: unknown) => e instanceof StarterKitCatalogFailure && e.code === "unknown-content");
  const definitions = [
    ...service.catalog.items.map(i => ({ kind: "item", id: i.id })),
    ...service.catalog.abilities.map(a => ({ kind: a.kind === "spell" ? "spell" : "skill", id: a.id })),
    ...service.catalog.kits.map(k => ({ kind: "kit", id: k.id })),
  ];
  for (const definition of definitions) for (const kind of ["item", "skill", "spell", "kit"]) {
    if (kind === definition.kind) continue;
    assert.throws(() => service.resolve(kind, definition.id, 1),
      (e: unknown) => e instanceof StarterKitCatalogFailure && e.code === "unknown-content", `${kind}: ${definition.id}`);
  }
  for (const version of [0, 2, NaN]) assert.throws(() => service.resolve("item", "item.dagger", version),
    (e: unknown) => e instanceof StarterKitCatalogFailure && e.code === "unsupported-version");
});
test("格式、完整性與交叉引用失效即拒絕整份名冊", () => {
  const variants: ((v: OfficialStarterKitCatalog) => void)[] = [
    v => { Reflect.set(v, "catalogVersion", 2); },
    v => { Reflect.set(v, "classCatalogVersion", 2); },
    v => { Reflect.set(v, "namespace", "test"); },
    v => { Reflect.set(v, "scope", "all-content"); },
    v => { Reflect.set(v.items, "length", 7); },
    v => { Reflect.deleteProperty(v.items, "0"); },
    v => { Reflect.set(v.items[1]!, "id", "item.one-handed-sword"); },
    v => { Reflect.set(v.items[0]!, "id", "TEST-sword"); },
    v => { Reflect.set(v.items[0]!, "kind", "spellbook"); },
    v => { Reflect.set(v.items[0]!, "weaponFamily", "bow"); },
    v => { Reflect.set(v.items[0]!, "name", ""); },
    v => { Reflect.set(v.items[0]!.requirement, "minimum", 0); },
    v => { Reflect.set(v.items[0]!.requirement, "minimum", 10.5); },
    v => { Reflect.set(v.items[0]!.requirement, "attribute", "luck"); },
    v => { Reflect.set(v.items[0]!.attributeBonuses, "strength", NaN); },
    v => { Reflect.deleteProperty(v.items[0]!.attributeBonuses, "charisma"); },
    v => { Reflect.set(v.items[4]!, "armor", -1); },
    v => { Reflect.set(v.items[7]!, "spellId", "spell.unknown"); },
    v => { Reflect.deleteProperty(v.abilities, "3"); },
    v => { Reflect.set(v.abilities, "length", 3); },
    v => { Reflect.set(v.abilities[1]!, "id", "skill.heavy-slash"); },
    v => { Reflect.set(v.abilities[0]!.source, "weaponFamily", "staff"); },
    v => { Reflect.set(v.abilities[3]!.source, "spellbookId", "item.dagger"); },
    v => { Reflect.set(v.abilities[3]!, "element", "ice"); },
    v => { Reflect.set(v.abilities[0]!, "combatRules", "ready"); },
    v => { Reflect.set(v.abilities[3]!, "mpCost", 0); },
    v => { Reflect.deleteProperty(v.kits, "0"); },
    v => { Reflect.set(v.kits, "length", 3); },
    v => { Reflect.set(v.kits[0]!, "classId", "class.unknown"); },
    v => { Reflect.set(v.kits[0]!.itemIds, "0", "item.chainmail"); },
    v => { Reflect.set(v.kits[0]!.itemIds, "1", "item.cloth-robe"); },
    v => { Reflect.set(v.kits[3]!.itemIds, "2", "item.leather-armor"); },
    v => { Reflect.set(v.kits[0]!, "weaponProficiency", "staff"); },
    v => { Reflect.set(v.kits[3]!.ability, "acquisition", "learned"); },
    v => { Reflect.set(v.kits[0]!.ability, "id", "skill.swift-thrust"); },
  ];
  for (const index of [0, 1, 2]) {
    for (const kind of ["spell", "weapon", "physical", "", null])
      variants.push(v => { Reflect.set(v.abilities[index]!, "kind", kind); });
    variants.push(v => { Reflect.deleteProperty(v.abilities[index]!, "kind"); });
  }
  // Completeness is independent of per-entry shape and of kit cross references.
  for (const field of ["items", "abilities", "kits"] as const) {
    variants.push(v => { Reflect.set(v, field, []); });
    variants.push(v => { Reflect.set(v, field, [...v[field], v[field][0]]); });
    variants.push(v => { Reflect.set(v, field, v[field].map(() => v[field][0])); });
  }
  for (const change of variants) {
    const value = structuredClone(OFFICIAL_STARTER_KITS_V1); change(value);
    assert.equal(isOfficialStarterKitCatalog(value), false);
    assert.throws(() => createOfficialStarterKitCatalog(value), { message: "正式起始配套名冊格式不合法，未載入任何配套。" });
  }
});
test("凍結驗證後同一快照，呼叫者或巢狀欄位不能改名冊", () => {
  const input = structuredClone(OFFICIAL_STARTER_KITS_V1); let reads = 0;
  Object.defineProperty(input.items[0]!, "name", { enumerable: true, get: () => ++reads === 1 ? "單手劍" : "TEST-改名" });
  const service = createOfficialStarterKitCatalog(input);
  assert.equal(reads, 1); assert.equal(service.catalog.items[0]!.name, "單手劍");
  Reflect.set(input.items[0]!.requirement, "minimum", 99);
  assert.equal(service.catalog.items[0]!.requirement.minimum, 10);
  function frozen(value: object) { assert.equal(Object.isFrozen(value), true);
    for (const child of Object.values(value)) if (child !== null && typeof child === "object") frozen(child); }
  frozen(service.catalog);
  assert.throws(() => Object.assign(service.catalog.kits[3]!.ability, { acquisition: "learned" }));
  assert.throws(() => createOfficialStarterKitCatalog({ uncloneable() {} }));
});
test("HTTP 唯讀與嚴格版本／種類查詢，固定錯誤不回傳原始資料", async t => {
  const app = Fastify(); registerStarterKitCatalogRoutes(app); t.after(() => app.close());
  const response = await app.inject("/api/starter-kit-catalog");
  assert.equal(response.statusCode, 200); assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(isOfficialStarterKitCatalog(response.json()), true);
  for (const [kind, id] of [["item", "item.dagger"], ["skill", "skill.heavy-slash"], ["spell", "spell.fire-arrow"], ["kit", "starter-kit.mage"]]) {
    const resolved = await app.inject(`/api/starter-kit-catalog/resolve?kind=${kind}&id=${id}&version=1`);
    assert.equal(resolved.statusCode, 200); assert.equal(resolved.json().definition.id, id);
  }
  for (const [url, status] of [
    ["/api/starter-kit-catalog?extra=1", 400],
    ["/api/starter-kit-catalog/resolve?kind=item&id=item.dagger", 400],
    ["/api/starter-kit-catalog/resolve?kind=item&id=item.dagger&version=1&extra=1", 400],
    ["/api/starter-kit-catalog/resolve?kind=item&id=item.dagger&version=1&version=2", 400],
    ["/api/starter-kit-catalog/resolve?kind=item&id=item.dagger&version=01", 400],
    ["/api/starter-kit-catalog/resolve?kind=class&id=class.mage&version=1", 400],
    ["/api/starter-kit-catalog/resolve?kind=item&id=TEST-private&version=1", 404],
    ["/api/starter-kit-catalog/resolve?kind=skill&id=spell.fire-arrow&version=1", 404],
    ["/api/starter-kit-catalog/resolve?kind=item&id=starter-kit.mage&version=1", 404],
    ["/api/starter-kit-catalog/resolve?kind=item&id=item.dagger&version=2", 409],
  ] as const) {
    const bad = await app.inject(url); assert.equal(bad.statusCode, status);
    assert.equal(bad.headers["cache-control"], "no-store"); assert.doesNotMatch(bad.body, /TEST-private|stack|node_modules/);
  }
  for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const)
    assert.equal((await app.inject({ method, url: "/api/starter-kit-catalog", payload: {} })).statusCode, 404);
});
test("真實 app 註冊查詢不改出生紀錄、活動 state、三槽存檔或既有名冊", async t => {
  const session = createDomainSession(createTestGameState()), before = structuredClone(session.getState());
  const repository = new MemoryCreationRepository(), record = birth();
  await repository.create(creationRequest(), () => record, signal());
  const app = await buildApp({ domainSession: session, creationRepository: repository }); t.after(() => app.close());
  const slots = (await app.inject("/api/save-slots")).json();
  const savedBirth = (await app.inject("/api/character-creation")).json();
  for (let i = 0; i < 2; i++) {
    assert.equal((await app.inject("/api/starter-kit-catalog")).statusCode, 200);
    await app.inject("/api/starter-kit-catalog/resolve?kind=kit&id=starter-kit.mage&version=1");
  }
  assert.deepEqual(session.getState(), before);
  assert.deepEqual((await app.inject("/api/save-slots")).json(), slots);
  assert.deepEqual((await app.inject("/api/character-creation")).json(), savedBirth);
  assert.deepEqual(await repository.read(signal()), record);
  assert.equal((await app.inject("/api/content-catalog")).json().catalogVersion, 2);
  assert.equal((await app.inject("/api/class-catalog")).json().catalogVersion, 1);
});
test("前端只接收完整有界名冊，錯格式、截斷、超限與取消全部拒絕", async () => {
  const body = JSON.stringify(OFFICIAL_STARTER_KITS_V1);
  function response(text: string, headers: Record<string, string> = {}) { return new Response(text, { headers: {
    "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(text)), ...headers } }); }
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(url, "/api/starter-kit-catalog"); assert.equal(init?.cache, "no-store"); assert.ok(init?.signal);
    return response(body);
  };
  assert.deepEqual(await readStarterKitCatalog(signal(), fetcher), OFFICIAL_STARTER_KITS_V1);
  for (const make of [() => response("{"), () => response("{}"), () => response(body, { "Content-Length": "65537" }),
    () => response(body, { "Content-Length": "1" }), () => response(body, { "Content-Length": String(Buffer.byteLength(body) + 1) }),
    () => response(body, { "Content-Type": "text/html" }), () => new Response("private details", { status: 503 })])
    await assert.rejects(readStarterKitCatalog(signal(), async () => make()));
  const malformed = structuredClone(OFFICIAL_STARTER_KITS_V1);
  Reflect.set(malformed.kits[3]!.ability, "acquisition", "learned");
  await assert.rejects(readStarterKitCatalog(signal(), async () => response(JSON.stringify(malformed))));
  const aborted = new AbortController(); aborted.abort(); let called = false;
  await assert.rejects(readStarterKitCatalog(aborted.signal, async () => { called = true; return response(body); }));
  assert.equal(called, false);
  const inFlight = new AbortController();
  await assert.rejects(readStarterKitCatalog(inFlight.signal, async () => { inFlight.abort(); return response(body); }));
});
