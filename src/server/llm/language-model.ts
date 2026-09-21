import {
  ModelFailure,
  type GenerateRequest,
  type GenerateResult,
  type LanguageModel,
  type ModelSettings,
  type TextModelAdapter,
} from "./contracts.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validRequest(value: unknown): value is GenerateRequest {
  return isRecord(value) && Object.keys(value).every((key) => key === "input" || key === "instruction")
    && Object.hasOwn(value, "input")
    && typeof value.input === "string" && value.input.trim().length > 0
    && (!Object.hasOwn(value, "instruction")
      || (typeof value.instruction === "string" && value.instruction.trim().length > 0));
}

function parseResult(value: unknown): GenerateResult {
  if (!isRecord(value) || Object.keys(value).length !== 1
    || !Object.hasOwn(value, "text")
    || typeof value.text !== "string" || value.text.trim().length === 0) {
    throw new ModelFailure("malformed-response");
  }
  return { text: value.text };
}

/** 統一驗證、逾時與安全錯誤；adapter 實作不進入 domain 或前端。 */
export function createLanguageModel(adapter: TextModelAdapter, settings: ModelSettings): LanguageModel {
  if (!Number.isSafeInteger(settings.timeoutMs) || settings.timeoutMs < 1
    || settings.timeoutMs > 2_147_483_647) {
    throw new Error("文字模型逾時設定必須是有效的正整數毫秒。");
  }

  return {
    async generateText(request: GenerateRequest): Promise<GenerateResult> {
      if (!validRequest(request)) throw new ModelFailure("invalid-request");

      const controller = new AbortController();
      let timedOut = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
          reject(new Error("timeout"));
        }, settings.timeoutMs);
      });

      let raw: unknown;
      try {
        raw = await Promise.race([
          Promise.resolve().then(() => adapter.generateText(request, controller.signal)),
          timeout,
        ]);
      } catch {
        throw new ModelFailure(timedOut ? "timeout" : "unavailable");
      } finally {
        if (timer) clearTimeout(timer);
      }
      return parseResult(raw);
    },
  };
}
