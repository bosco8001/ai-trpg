/** 後端 application 使用的中立文字模型契約；不屬於權威 domain state。 */
export interface GenerateRequest {
  readonly input: string;
  /** 應用層指示與玩家文字分開；正式 adapter 須映射為較高權限的指示。 */
  readonly instruction?: string;
}

export interface GenerateResult {
  readonly text: string;
}

export interface LanguageModel {
  generateText(request: GenerateRequest): Promise<GenerateResult>;
}

/** 供應商 adapter 的回應視為不可信，必須由模型邊界驗證。 */
export interface TextModelAdapter {
  generateText(request: GenerateRequest, signal: AbortSignal): Promise<unknown>;
}

export interface ModelSettings {
  readonly timeoutMs: number;
}

export type ModelFailureCode = "invalid-request" | "timeout" | "unavailable" | "malformed-response";

const safeMessages: Record<ModelFailureCode, string> = {
  "invalid-request": "文字模型請求格式不正確。",
  timeout: "文字模型回應逾時，請稍後再試。",
  unavailable: "文字模型暫時無法回應，請稍後再試。",
  "malformed-response": "文字模型回應格式不正確。",
};

/** 不保存外部錯誤物件或原始回應，避免供應商細節與秘密流出。 */
export class ModelFailure extends Error {
  constructor(readonly code: ModelFailureCode) {
    super(safeMessages[code]);
    this.name = "ModelFailure";
  }
}
