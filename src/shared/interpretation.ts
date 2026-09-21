/** Phase 7 暫時的探索解析分類；不是遊戲規則或合法命令。 */
export type ExplorationIntent = "move" | "inspect" | "interact" | "speak" | "other";
export type InterpretationStatus = "candidate" | "clarification-needed" | "unsupported";

export interface CandidateAction {
  readonly status: InterpretationStatus;
  readonly kind: ExplorationIntent;
  readonly target: string | null;
  readonly manner: string | null;
  readonly clarificationQuestion: string | null;
  /** 由伺服器從玩家請求帶入，絕不採信模型自行提供的原文。 */
  readonly originalText: string;
}

export interface InterpretationResponse {
  readonly mode: "test-fixture";
  readonly candidate: CandidateAction;
}

export const MAX_PLAYER_TEXT_LENGTH = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function optionalText(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value.trim() === value
    && value.length > 0 && Array.from(value).length <= 120);
}

/** 模型 JSON 與前端 API 回應共用的嚴格 runtime boundary。 */
export function isCandidateFields(value: unknown): value is Omit<CandidateAction, "originalText"> {
  if (!isRecord(value) || !exactKeys(value, ["status", "kind", "target", "manner", "clarificationQuestion"])) return false;
  if (value.status !== "candidate" && value.status !== "clarification-needed" && value.status !== "unsupported") return false;
  if (value.kind !== "move" && value.kind !== "inspect" && value.kind !== "interact"
    && value.kind !== "speak" && value.kind !== "other") return false;
  if (!optionalText(value.target) || !optionalText(value.manner) || !optionalText(value.clarificationQuestion)) return false;
  if (value.status === "candidate" && value.clarificationQuestion !== null) return false;
  if (value.status === "clarification-needed" && value.clarificationQuestion === null) return false;
  if (value.status === "unsupported" && (value.kind !== "other" || value.clarificationQuestion !== null)) return false;
  return true;
}

export function isInterpretationResponse(value: unknown): value is InterpretationResponse {
  if (!isRecord(value) || !exactKeys(value, ["mode", "candidate"]) || value.mode !== "test-fixture") return false;
  const candidate = value.candidate;
  return isRecord(candidate) && exactKeys(candidate,
    ["status", "kind", "target", "manner", "clarificationQuestion", "originalText"])
    && isCandidateFields({
      status: candidate.status, kind: candidate.kind, target: candidate.target,
      manner: candidate.manner, clarificationQuestion: candidate.clarificationQuestion,
    })
    && typeof candidate.originalText === "string" && candidate.originalText.trim() === candidate.originalText
    && Array.from(candidate.originalText).length > 0
    && Array.from(candidate.originalText).length <= MAX_PLAYER_TEXT_LENGTH;
}

export function isCandidateAction(value: unknown): value is CandidateAction {
  return isRecord(value) && exactKeys(value,
    ["status", "kind", "target", "manner", "clarificationQuestion", "originalText"])
    && isCandidateFields({
      status: value.status, kind: value.kind, target: value.target,
      manner: value.manner, clarificationQuestion: value.clarificationQuestion,
    })
    && typeof value.originalText === "string" && value.originalText.trim() === value.originalText
    && Array.from(value.originalText).length > 0
    && Array.from(value.originalText).length <= MAX_PLAYER_TEXT_LENGTH;
}
