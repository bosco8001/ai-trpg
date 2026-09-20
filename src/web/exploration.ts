export type NarrativeSource = "narration" | "action" | "system";

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
    text: "這是固定測試回覆；尚未進行自然語言判定、規則驗證或狀態更新。",
  },
];

export function isSubmittableAction(value: string): boolean {
  return value.trim().length > 0;
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
      label: "介面測試回覆",
      text: "已記錄你的文字。這是 Phase 6 介面測試，尚未進行自然語言判定、規則驗證或狀態更新。",
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
    feedback: "已加入探索紀錄。尚未進行自然語言判定或遊戲狀態更新。",
  };
}
