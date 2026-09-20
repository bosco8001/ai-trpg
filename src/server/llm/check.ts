import { ModelFailure, type LanguageModel, type TextModelAdapter } from "./contracts.js";
import { FixedTextModelAdapter } from "./fake-adapter.js";
import { createLanguageModel } from "./language-model.js";

/** 終端機手動檢查，不建立 HTTP 路由，也不讀取任何金鑰。 */
const scenario = process.argv[2] ?? "ok";
const expectedFailure = {
  malformed: "malformed-response",
  unavailable: "unavailable",
  timeout: "timeout",
} as const;

let adapter: TextModelAdapter;
switch (scenario) {
  case "ok":
    adapter = new FixedTextModelAdapter();
    break;
  case "malformed":
    adapter = new FixedTextModelAdapter({ wrongField: "TEST" });
    break;
  case "unavailable":
    adapter = {
      async generateText() {
        throw new Error("TEST：不應顯示的供應商內部資訊 FAKE_PRIVATE_PROVIDER_DETAIL");
      },
    };
    break;
  case "timeout":
    adapter = { generateText: async () => new Promise<never>(() => {}) };
    break;
  default:
    throw new Error("請選擇 ok、malformed、unavailable 或 timeout。");
}

const model: LanguageModel = createLanguageModel(adapter, {
  timeoutMs: scenario === "timeout" ? 50 : 1_000,
});

try {
  const result = await model.generateText({ input: "TEST：檢查文字模型插座" });
  if (scenario !== "ok") throw new Error("預期錯誤，但模型卻回傳成功。");
  process.stdout.write(`成功：${result.text}\n`);
} catch (error) {
  if (!(error instanceof ModelFailure)) throw error;
  if (scenario === "ok" || error.code !== expectedFailure[scenario]) throw error;
  process.stdout.write(`已安全處理：${error.code}／${error.message}\n`);
}
