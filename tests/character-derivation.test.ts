// 尚未執行；交 AI TRPG Architecture Critic 做工程驗證。
import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { createCharacterDerivationService, registerCharacterDerivationRoutes } from "../src/server/character-derivation.js";
import { previewResourceCapacity, DerivationFailure } from "../src/domain/character-derivation.js";
import { isDerivationResult, DERIVATION_MESSAGES, type DerivationRequest } from "../src/shared/character-derivation.js";
import { initialDerivationRequest, derivationDraftError, previewMatchesDraft } from "../src/web/character-derivation-ui.js";
import { readDerivationPreview, readDerivationCatalogs } from "../src/web/character-derivation-client.js";
import { CharacterDerivationPanel } from "../src/web/CharacterDerivationPanel.js";
import { OFFICIAL_RACES_V2 } from "../src/server/content/races-v2.js";
import { OFFICIAL_CLASSES_V1 } from "../src/server/content/classes-v1.js";
import { createOfficialContentCatalog } from "../src/server/content-catalog.js";
import { createDomainSession } from "../src/server/domain-session.js";
import { createTestGameState } from "../src/server/test-game-state.js";
import { buildApp } from "../src/server/app.js";

test("正式人類：先種族再職業，只有樣本資料，結果不含狀態寫入欄位", () => {
  const request = initialDerivationRequest(), original = structuredClone(request);
  const result = createCharacterDerivationService().calculate(request);
  assert.equal(isDerivationResult(result), true);
  assert.deepEqual(result.attributes[0], { attribute: "strength", base: 10, raceFixed: 0, raceFree: 2,
    intrinsic: 12, multiplier: 1.25, equipment: 0, skill: 0, qualification: 15, final: 15, modifier: 2 });
  assert.deepEqual(result.after, { currentHp: 40, maxHp: 55, currentMp: 48, maxMp: 60 });
  assert.deepEqual(request, original);
  assert.ok(Object.isFrozen(result.sample.allocation)); assert.ok(Object.isFrozen(result.attributes[0]));
  assert.doesNotMatch(JSON.stringify(result), /characterId|revision|directCasting|equippedSkills/);
});

test("五族 × 四職業：20 組正式引用，負數修正與小數向下取整", () => {
  const service = createCharacterDerivationService();
  const fixtures = [
    ["race.human", "ordinary", [[15,10,10,10,10,10],[12,10,10,10,12,10],[12,12,10,10,10,10],[12,10,10,12,10,10]]],
    ["race.elf", "high", [[11,10,8,11,12,10],[9,10,8,11,15,10],[9,12,8,11,12,10],[9,10,8,13,12,10]]],
    ["race.dwarf", "ordinary", [[13,9,12,10,10,8],[11,9,12,10,12,8],[11,11,12,10,10,8],[11,9,12,12,10,8]]],
    ["race.orc", "low", [[12,12,10,7,12,9],[10,12,10,7,15,9],[10,15,10,7,12,9],[10,12,10,8,12,9]]],
    ["race.dragonborn", "ordinary", [[15,10,12,11,10,10],[12,10,12,11,12,10],[12,12,12,11,10,10],[12,10,12,13,10,10]]],
  ] as const;
  for (const [raceId, aptitude, expected] of fixtures) {
    for (const [i, profession] of OFFICIAL_CLASSES_V1.classes.entries()) {
      const request = initialDerivationRequest();
      const result = service.calculate({ ...request, sample: { ...request.sample, raceId, aptitude, classId: profession.id,
        raceAllocation: raceId === "race.human" ? [2,0,0,0,0,0] : [0,0,0,0,0,0] } });
      assert.deepEqual(result.attributes.map(row => row.final), expected[i]);
      assert.equal(isDerivationResult(result), true);
      if (raceId === "race.orc" && profession.id === "class.swordsman") assert.equal(result.attributes[3]!.modifier, -2);
      if (raceId === "race.elf" && profession.id === "class.mage") assert.equal(result.after.maxMp, 92);
    }
  }
});

test("容量增加不恢復、下降只截超出部分，零值與來回切換不產生資源", () => {
  const before = { currentHp: 40, maxHp: 40, currentMp: 40, maxMp: 40 };
  const raised = previewResourceCapacity(before, 54, 54);
  assert.deepEqual(raised, { currentHp: 40, maxHp: 54, currentMp: 40, maxMp: 54 });
  assert.deepEqual(previewResourceCapacity(raised, 40, 40), before);
  const clipped = previewResourceCapacity({ currentHp: 50, maxHp: 54, currentMp: 50, maxMp: 54 }, 40, 40);
  assert.deepEqual(previewResourceCapacity(clipped, 54, 54), raised);
  assert.deepEqual(previewResourceCapacity({ currentHp: 5, maxHp: 55, currentMp: 2, maxMp: 60 }, 49, 52),
    { currentHp: 5, maxHp: 49, currentMp: 2, maxMp: 52 });
  assert.deepEqual(previewResourceCapacity({ currentHp: 0, maxHp: 55, currentMp: 0, maxMp: 60 }, 64, 0),
    { currentHp: 0, maxHp: 64, currentMp: 0, maxMp: 0 });
  assert.deepEqual(before, { currentHp: 40, maxHp: 40, currentMp: 40, maxMp: 40 });
});

test("非法資源整份拒絕，不用 clamp 修補原本超出上限的資料", () => {
  const valid = initialDerivationRequest().resources;
  for (const value of [null, { ...valid, currentHp: 56 }, { ...valid, currentMp: -1 }, { ...valid, maxHp: 0 },
    { ...valid, currentHp: 1.5 }, { ...valid, maxMp: Infinity }, { ...valid, debt: 1 }])
    assert.throws(() => previewResourceCapacity(value, 54, 54), DerivationFailure);
  for (const [hp, mp] of [[0,40],[1,-1],[NaN,40],[54,1.5],[Number.MAX_SAFE_INTEGER + 1,40]])
    assert.throws(() => previewResourceCapacity(valid, hp!, mp!), DerivationFailure);
});

test("未知／TEST／錯誤版本與非法分配不回退成樣本或其他版本", () => {
  const service = createCharacterDerivationService(), request = initialDerivationRequest();
  const cases: readonly [unknown, keyof typeof DERIVATION_MESSAGES][] = [
    [{ ...request, extra: true }, "invalid-request"],
    [{ ...request, raceCatalogVersion: 1 }, "unsupported-version"],
    [{ ...request, classCatalogVersion: 2 }, "unsupported-version"],
    [{ ...request, sample: { ...request.sample, raceId: "TEST-human" } }, "unknown-content"],
    [{ ...request, sample: { ...request.sample, classId: "__proto__" } }, "unknown-content"],
    [{ ...request, sample: { ...request.sample, level: 2 } }, "invalid-sample"],
    [{ ...request, sample: { ...request.sample, allocation: [7,1,1,1,1,1] } }, "invalid-sample"],
    [{ ...request, sample: { ...request.sample, allocation: [2,2,2,2,2,1] } }, "invalid-sample"],
    [{ ...request, sample: { ...request.sample, allocation: [2,2,2,2,2,2.5] } }, "invalid-sample"],
    [{ ...request, sample: { ...request.sample, raceId: "race.elf", raceAllocation: [0,0,0,0,0,0], aptitude: "low" } }, "invalid-sample"],
    [{ ...request, sample: { ...request.sample, raceId: "race.orc" } }, "invalid-sample"],
    [{ ...request, resources: { ...request.resources, currentHp: -1 } }, "invalid-resources"],
  ];
  for (const [value, code] of cases) assert.throws(() => service.calculate(value),
    (e: unknown) => e instanceof DerivationFailure && e.code === code);
  const sparse = new Array(6); sparse[0] = 12;
  assert.throws(() => service.calculate({ ...request, sample: { ...request.sample, allocation: sparse } }), DerivationFailure);
});

test("HTTP：有界唯讀 POST、固定錯誤及 malformed JSON，沒有遊戲／存檔寫入", async t => {
  const app = Fastify(); registerCharacterDerivationRoutes(app); t.after(() => app.close());
  const payload = initialDerivationRequest();
  const good = await app.inject({ method: "POST", url: "/api/character-derivation/preview", payload });
  assert.equal(good.statusCode, 200); assert.equal(isDerivationResult(good.json()), true);
  assert.equal(good.headers["cache-control"], "no-store");
  for (const [body, status] of [[{ ...payload, extra: true },400], [{ ...payload, classCatalogVersion: 2 },409],
    [{ ...payload, sample: { ...payload.sample, raceId: "TEST-private-marker" } },404]] as const) {
    const response = await app.inject({ method: "POST", url: "/api/character-derivation/preview", payload: body });
    assert.equal(response.statusCode, status); assert.equal(response.headers["cache-control"], "no-store");
    assert.doesNotMatch(response.body, /TEST-private-marker|stack|node_modules/);
  }
  assert.equal((await app.inject({ method: "POST", url: "/api/character-derivation/preview?extra=1", payload })).statusCode, 400);
  for (const body of ['{"private-marker":', ' '.repeat(4097)]) {
    const response = await app.inject({ method: "POST", url: "/api/character-derivation/preview",
      headers: { "content-type": "application/json" }, payload: body });
    assert.ok([400,413].includes(response.statusCode)); assert.equal(response.json().code, "invalid-request");
    assert.doesNotMatch(response.body, /private-marker|stack|node_modules/);
  }
  const session = createDomainSession(createTestGameState()), before = structuredClone(session.getState());
  const game = await buildApp({ domainSession: session }); t.after(() => game.close());
  const slots = (await game.inject("/api/save-slots")).json();
  await game.inject({ method: "POST", url: "/api/character-derivation/preview", payload });
  assert.deepEqual(session.getState(), before); assert.deepEqual((await game.inject("/api/save-slots")).json(), slots);
});

function json(value: unknown) {
  const text = JSON.stringify(value);
  return new Response(text, { headers: { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(text)) } });
}
test("前端讀取器：只讀正式名冊，預覽有界、綁定本次樣本與原資源，取消不回傳結果", async () => {
  const request = initialDerivationRequest(), result = createCharacterDerivationService().calculate(request);
  const fetcher: typeof fetch = async (url, options) => {
    assert.equal(url, "/api/character-derivation/preview"); assert.equal(options?.method, "POST");
    assert.equal(options?.cache, "no-store"); assert.deepEqual(JSON.parse(options!.body as string), request); return json(result);
  };
  assert.equal((await readDerivationPreview(request, new AbortController().signal, fetcher)).after.currentMp, 48);
  for (const value of [{ ...result, scope: "character" }, { ...result, after: { ...result.after, currentMp: 49 } },
    { ...result, before: { ...result.before, currentMp: 47 } }, { ...result, sample: { ...result.sample, classId: "class.mage" } },
    { ...result, attributes: [] }, { ...result, after: { ...result.after, maxHp: 999 } }])
    await assert.rejects(() => readDerivationPreview(request, new AbortController().signal, async () => json(value)));
  const abort = new AbortController(); abort.abort();
  await assert.rejects(() => readDerivationPreview(request, abort.signal, async () => { assert.fail("取消後不 fetch"); }));
  await assert.rejects(() => readDerivationPreview(request, new AbortController().signal, async () =>
    new Response("{}", { headers: { "Content-Type": "application/json", "Content-Length": "32769" } })));
  const calls: string[] = [];
  const catalogs = await readDerivationCatalogs(new AbortController().signal, async url => {
    calls.push(String(url)); return json(url === "/api/content-catalog" ? OFFICIAL_RACES_V2 : OFFICIAL_CLASSES_V1);
  });
  assert.deepEqual(calls.sort(), ["/api/class-catalog", "/api/content-catalog"]);
  assert.equal(catalogs.races.catalogVersion, 2); assert.equal(catalogs.classes.catalogVersion, 1);
});

test("草稿不改原樣本，只有吻合目前草稿／資源的預覽可確認；非法分配可取消", () => {
  const request = initialDerivationRequest(), before = structuredClone(request);
  const preview = createCharacterDerivationService().calculate(request);
  const races = createOfficialContentCatalog().catalog, classes = OFFICIAL_CLASSES_V1;
  assert.equal(derivationDraftError(request.sample, request.resources, races, classes), "");
  assert.equal(previewMatchesDraft(preview, request.sample, request.resources), true);
  assert.equal(previewMatchesDraft(preview, { ...request.sample, classId: "class.mage" }, request.resources), false);
  assert.equal(previewMatchesDraft(preview, request.sample, { ...request.resources, currentHp: 0 }), false);
  assert.notEqual(derivationDraftError({ ...request.sample, allocation: [0,0,0,0,0,0] }, request.resources, races, classes), "");
  assert.deepEqual(request, before);
  const markup = renderToStaticMarkup(createElement(CharacterDerivationPanel));
  assert.match(markup, /角色屬性核對/); assert.match(markup, /aria-haspopup="dialog"/);
  assert.doesNotMatch(markup, /<dialog|切換目前職業/);
});
