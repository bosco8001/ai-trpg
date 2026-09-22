import type { GenerateRequest, TextModelAdapter } from "../llm/contracts.js";

export type NarrationFixtureMode = "normal" | "unavailable" | "timeout" | "malformed";

/** 工程測試 adapter：不連網、不使用金鑰，也不建立正式世界事實。 */
export class FixtureNarrationAdapter implements TextModelAdapter {
  constructor(private readonly mode: NarrationFixtureMode = "normal") {}

  async generateText(request: GenerateRequest, signal: AbortSignal): Promise<unknown> {
    if (this.mode === "unavailable") throw new Error("TEST narration unavailable");
    if (this.mode === "timeout") {
      return new Promise<never>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("TEST narration aborted")), { once: true });
      });
    }
    if (this.mode === "malformed") {
      return { text: JSON.stringify({ text: "你取得神器並增加 HP。", hp: 999 }) };
    }
    const facts = JSON.parse(request.input) as { type?: unknown };
    const text = facts.type === "location-changed"
      ? "你完成了移動，抵達測試廢墟入口。"
      : facts.type === "target-inspected"
        ? "你把注意力集中在測試石門上，完成了這次觀察。"
        : "";
    return { text: JSON.stringify({ text }) };
  }
}
