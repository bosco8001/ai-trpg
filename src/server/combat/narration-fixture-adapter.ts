import type { GenerateRequest, TextModelAdapter } from "../llm/contracts.js";
import type { NarrationFixtureMode } from "../narration/fixture-adapter.js";
import { buildCombatNarrationFallback, type CombatNarrationFacts } from "./narration.js";

/** Uses the Phase 9 fixture modes with committed combat facts only. */
export class FixtureCombatNarrationAdapter implements TextModelAdapter {
  constructor(private readonly mode: NarrationFixtureMode = "normal") {}

  async generateText(request: GenerateRequest, signal: AbortSignal): Promise<unknown> {
    if (this.mode === "unavailable") throw new Error("TEST combat narration unavailable");
    if (this.mode === "timeout") return new Promise<never>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("TEST combat narration aborted")), { once: true });
    });
    if (this.mode === "malformed") return { text: JSON.stringify({ text: "敵人死亡。", hp: 0, revision: 999 }) };
    const input = JSON.parse(request.input) as { data: CombatNarrationFacts };
    return { text: JSON.stringify({ text: buildCombatNarrationFallback(input.data) }) };
  }
}
