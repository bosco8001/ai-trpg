import type { GenerateRequest, TextModelAdapter } from "./contracts.js";

/** 工程測試專用：固定回應、不用網路、金鑰或正式模型。 */
export class FixedTextModelAdapter implements TextModelAdapter {
  constructor(private readonly response: unknown = { text: "TEST：文字模型介面已連通。" }) {}

  async generateText(_request: GenerateRequest, _signal: AbortSignal): Promise<unknown> {
    return this.response;
  }
}
