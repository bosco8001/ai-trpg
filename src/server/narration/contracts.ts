import type { ExplorationLocationId } from "../../domain/game.js";

/** 只包含已由 authoritative transition 確定的事實。 */
export type ExplorationNarrationRequest =
  | {
      readonly type: "location-changed";
      readonly fromLocationId: ExplorationLocationId;
      readonly toLocationId: ExplorationLocationId;
    }
  | {
      readonly type: "target-inspected";
      readonly locationId: ExplorationLocationId;
      readonly targetId: "TEST-stone-door";
    };

export interface ExplorationNarrationResult {
  readonly text: string;
}

export interface ExplorationNarrator {
  narrate(request: ExplorationNarrationRequest): Promise<ExplorationNarrationResult>;
}

export type NarrationFailureCode = "invalid-request" | "timeout" | "unavailable" | "malformed-response";

const safeMessages: Record<NarrationFailureCode, string> = {
  "invalid-request": "探索敘事請求格式不正確。",
  timeout: "探索敘事等候逾時。",
  unavailable: "探索敘事服務暫時無法使用。",
  "malformed-response": "探索敘事回應格式不正確。",
};

/** 不保存模型錯誤、原始輸出或 prompt。 */
export class NarrationFailure extends Error {
  constructor(readonly code: NarrationFailureCode) {
    super(safeMessages[code]);
    this.name = "NarrationFailure";
  }
}
