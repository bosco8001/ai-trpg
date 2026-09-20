import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import type { GenerateRequest, LanguageModel, TextModelAdapter } from "../src/server/llm/contracts.js";
import { ModelFailure } from "../src/server/llm/contracts.js";
import { FixedTextModelAdapter } from "../src/server/llm/fake-adapter.js";
import { createLanguageModel } from "../src/server/llm/language-model.js";

async function applicationProbe(model: LanguageModel) {
  return model.generateText({ input: "TEST：應用層請求" });
}

test("application 只透過中立介面取得固定 fake 回應", async () => {
  const model: LanguageModel = createLanguageModel(new FixedTextModelAdapter(), { timeoutMs: 1_000 });
  assert.deepEqual(await applicationProbe(model), { text: "TEST：文字模型介面已連通。" });
  assert.deepEqual(await applicationProbe(model), { text: "TEST：文字模型介面已連通。" });
});

test("不可信的模型回應必須經過 runtime validation", async () => {
  for (const response of [null, {}, { text: 123 }, { text: "   " }, { text: "可讀", hp: 999 }, ["可讀"]]) {
    const model = createLanguageModel(new FixedTextModelAdapter(response), { timeoutMs: 1_000 });
    await assert.rejects(applicationProbe(model), (error: unknown) => {
      assert.ok(error instanceof ModelFailure);
      assert.equal(error.code, "malformed-response");
      return true;
    });
  }
});

test("外部失敗轉成安全錯誤，不保留供應商內容或假秘密", async () => {
  const privateDetail = "FAKE_PRIVATE_PROVIDER_DETAIL";
  const adapter: TextModelAdapter = {
    async generateText() { throw new Error(`內部例外：${privateDetail}`); },
  };
  const model = createLanguageModel(adapter, { timeoutMs: 1_000 });
  await assert.rejects(applicationProbe(model), (error: unknown) => {
    assert.ok(error instanceof ModelFailure);
    assert.equal(error.code, "unavailable");
    assert.ok(!error.message.includes(privateDetail));
    assert.ok(!String(error.stack).includes(privateDetail));
    assert.ok(!JSON.stringify(error).includes(privateDetail));
    assert.equal("cause" in error, false);
    return true;
  });
});

test("模型未回應時按設定逾時，並中止 adapter 訊號", async () => {
  let receivedSignal: AbortSignal | undefined;
  const adapter: TextModelAdapter = {
    async generateText(_request, signal) {
      receivedSignal = signal;
      return new Promise<never>(() => {});
    },
  };
  const model = createLanguageModel(adapter, { timeoutMs: 20 });
  await assert.rejects(applicationProbe(model), (error: unknown) => {
    assert.ok(error instanceof ModelFailure);
    assert.equal(error.code, "timeout");
    return true;
  });
  assert.equal(receivedSignal?.aborted, true);
});

test("無效請求與逾時設定在呼叫 adapter 前被拒絕", async () => {
  let called = false;
  const model = createLanguageModel({
    async generateText() { called = true; return { text: "不應出現" }; },
  }, { timeoutMs: 1_000 });
  for (const request of [null, {}, { input: " " }, { input: 12 }, { input: "可讀", hp: 999 }]) {
    await assert.rejects(model.generateText(request as GenerateRequest), (error: unknown) => {
      assert.ok(error instanceof ModelFailure);
      assert.equal(error.code, "invalid-request");
      return true;
    });
  }
  assert.equal(called, false);
  assert.throws(() => createLanguageModel(new FixedTextModelAdapter(), { timeoutMs: 0 }));
});

test("authoritative domain 與 PostgreSQL adapter 不依賴 LLM，套件不含 provider SDK", async () => {
  const domainFiles = await readdir(new URL("../src/domain/", import.meta.url));
  for (const file of domainFiles.filter((name) => name.endsWith(".ts"))) {
    const source = await readFile(new URL(`../src/domain/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /from\s+["'][^"']*(?:\/llm\/|openai|anthropic|gemini)/i);
  }
  const persistence = await readFile(new URL("../src/server/postgres-game-state-repository.ts", import.meta.url), "utf8");
  assert.doesNotMatch(persistence, /from\s+["'][^"']*(?:\/llm\/|openai|anthropic|gemini)/i);
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  const dependencies = Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies });
  assert.deepEqual(dependencies.filter((name) => /openai|anthropic|gemini|generative-ai/i.test(name)), []);
});
