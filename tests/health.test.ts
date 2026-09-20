import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/server/app.js";
import { checkApiHealth } from "../src/web/api.js";

test("API 健康回應可由前端讀取，且禁止快取", async (t) => {
  const app = await buildApp();
  t.after(() => app.close());
  const response = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "no-store");
  const result = await checkApiHealth(new AbortController().signal, async (url, init) => {
    assert.equal(url, "/api/health");
    assert.equal(init?.cache, "no-store");
    return new Response(response.body, { status: response.statusCode });
  });
  assert.deepEqual(result, { status: "ok", service: "ai-trpg-api" });
});

test("不存在的 API 回傳 404", async (t) => {
  const app = await buildApp();
  t.after(() => app.close());
  const response = await app.inject({ method: "GET", url: "/api/missing" });
  assert.equal(response.statusCode, 404);
});

test("HTTP 錯誤不能被視為成功", async () => {
  await assert.rejects(
    checkApiHealth(new AbortController().signal, async () => new Response("", { status: 503 })),
    /服務目前無法回應/,
  );
});

test("錯誤格式或其他服務的回應不能被視為成功", async () => {
  for (const body of [null, {}, { status: "ok", service: "other-api" }]) {
    await assert.rejects(
      checkApiHealth(new AbortController().signal, async () => Response.json(body)),
      /服務回應格式不符/,
    );
  }
});

test("連線失敗會傳回呼叫端，且請求可取消", async () => {
  const controller = new AbortController();
  await assert.rejects(checkApiHealth(controller.signal, async (_url, init) => {
    assert.equal(init?.signal, controller.signal);
    throw new TypeError("連線中斷");
  }), /連線中斷/);
});
