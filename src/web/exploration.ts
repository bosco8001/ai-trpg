import { MAX_PLAYER_TEXT_LENGTH, type CandidateAction } from "../shared/interpretation.js";
import type { ExplorationRuling } from "../shared/exploration-action.js";

export type NarrativeSource = "narration" | "action" | "system" | "interpretation" | "ruling";

export interface NarrativeEntry {
  readonly id: string;
  readonly source: NarrativeSource;
  readonly label: string;
  readonly text: string;
}

export const initialNarrativeEntries: readonly NarrativeEntry[] = [
  {
    id: "fixture-scene",
    source: "narration",
    label: "測試場景",
    text: "這是探索介面的固定測試敘事。它不代表正式世界場景、事件或遊戲結果。",
  },
  {
    id: "fixture-action",
    source: "action",
    label: "測試玩家行動",
    text: "我停下腳步，觀察眼前的路徑。",
  },
  {
    id: "fixture-response",
    source: "system",
    label: "介面測試回覆",
    text: "這是固定的初始介面 fixture。你新送出的文字會另外顯示候選解析與權威裁定。",
  },
];

export function isSubmittableAction(value: string): boolean {
  const length = Array.from(value.trim()).length;
  return length > 0 && length <= MAX_PLAYER_TEXT_LENGTH;
}

export function shouldSubmitOnEnter(key: string, shiftKey: boolean): boolean {
  return key === "Enter" && !shiftKey;
}

/** Phase 6 的純 UI history helper，不讀寫 domain、API 或持久化資料。 */
export function appendLocalExplorationAction(
  entries: readonly NarrativeEntry[],
  value: string,
): readonly NarrativeEntry[] {
  const action = value.trim();
  if (!action) return entries;
  const id = `local-${entries.length + 1}`;
  return [
    ...entries,
    { id: `${id}-action`, source: "action", label: "你的行動", text: action },
    {
      id: `${id}-response`,
      source: "system",
      label: "處理提示",
      text: "已記錄你的文字，正在依序進行候選解析、權威裁定與固定測試敘事。",
    },
  ];
}

export interface LocalActionSubmission {
  readonly entries: readonly NarrativeEntry[];
  readonly input: string;
  readonly feedback?: string;
}

/** 將 UI 輸入轉成單次本機互動結果；不會呼叫 AI 或 domain。 */
export function submitLocalExplorationAction(
  entries: readonly NarrativeEntry[],
  value: string,
): LocalActionSubmission {
  if (!isSubmittableAction(value)) return { entries, input: value };
  return {
    entries: appendLocalExplorationAction(entries, value),
    input: "",
    feedback: "已加入探索紀錄，正在解析、裁定並整理敘事……",
  };
}

const kindLabels: Record<CandidateAction["kind"], string> = {
  move: "移動／接近", inspect: "觀察", interact: "互動", speak: "說話", other: "其他／未分類",
};

export function describeCandidate(candidate: CandidateAction): string {
  if (candidate.status === "unsupported") return "固定測試解析尚未支援這句話；沒有判定遊戲結果。";
  if (candidate.status === "clarification-needed") {
    return `需要澄清：${candidate.clarificationQuestion} 尚未判定遊戲結果。`;
  }
  return `候選意圖：${kindLabels[candidate.kind]}；目標：${candidate.target ?? "未指明"}；方式：${candidate.manner ?? "未指明"}。尚未判定是否合法或成功。`;
}

export function describeRuling(ruling: ExplorationRuling): string {
  if (!ruling.accepted) return `未執行：${ruling.message}`;
  if (ruling.effect.type === "location-changed") {
    return `已接受：權威位置更新為 ${ruling.effect.locationId}。`;
  }
  return `已接受：權威觀察標記更新為 ${ruling.effect.targetId}。`;
}
