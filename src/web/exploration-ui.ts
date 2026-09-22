import type { ExplorationLocationId } from "../shared/exploration-action.js";

/**
 * Phase 9.5 的建議只是一段可點選的玩家文字。
 * 它不攜帶 command、成功結果、位置 ID 或其他 authoritative 資料。
 */
export interface SuggestedAction {
  readonly id: string;
  readonly text: string;
}

const forestEdgeSuggestions: readonly SuggestedAction[] = [
  { id: "approach-ruin", text: "我慢慢走向森林裡的廢墟。" },
  { id: "inspect-door", text: "我仔細查看門上的符號。" },
  { id: "approach-door", text: "我走向門口。" },
  { id: "clarify-attack", text: "我用它攻擊那個東西。" },
  { id: "unsupported-wait", text: "我暫時等待，保持距離。" },
];

const ruinEntranceSuggestions: readonly SuggestedAction[] = [
  { id: "inspect-door", text: "我仔細查看門上的符號。" },
  { id: "approach-ruin", text: "我慢慢走向森林裡的廢墟。" },
  { id: "approach-door", text: "我走向門口。" },
  { id: "clarify-attack", text: "我用它攻擊那個東西。" },
  { id: "unsupported-wait", text: "我暫時等待，保持距離。" },
];

/** 隨目前已知 TEST 狀態換一組排序；仍然是 Phase 7–8 的工程 fixture。 */
export function getSuggestedActions(locationId: ExplorationLocationId): readonly SuggestedAction[] {
  return locationId === "TEST-ruin-entrance" ? ruinEntranceSuggestions : forestEdgeSuggestions;
}

export interface ActionComposerState {
  readonly isOpen: boolean;
  readonly text: string;
}

export type ActionComposerEvent =
  | { readonly type: "open" }
  | { readonly type: "close" }
  | { readonly type: "change"; readonly text: string }
  | { readonly type: "submitted" };

export const initialActionComposerState: ActionComposerState = { isOpen: false, text: "" };

/** submitted 僅清空文字，刻意保留展開狀態，讓玩家可連續輸入。 */
export function actionComposerReducer(
  state: ActionComposerState,
  event: ActionComposerEvent,
): ActionComposerState {
  switch (event.type) {
    case "open": return { ...state, isOpen: true };
    case "close": return { ...state, isOpen: false };
    case "change": return { ...state, text: event.text };
    case "submitted": return { ...state, text: "" };
  }
}

export type UtilityPanelId = "inventory" | "equipment" | "party" | "system";

export interface UtilityPanelContent {
  readonly title: string;
  readonly description: string;
  readonly items: readonly string[];
}

export const utilityPanels: Readonly<Record<UtilityPanelId, UtilityPanelContent>> = {
  inventory: {
    title: "背包",
    description: "背包功能尚未接入。這個面板只保留未來 UI 位置。",
    items: ["TEST placeholder：尚無可用物品", "不會讀寫 inventory、loot 或經濟資料"],
  },
  equipment: {
    title: "裝備",
    description: "裝備功能尚未接入。以下欄位只是展示 placeholder。",
    items: ["主手：尚未接入", "護甲：尚未接入", "飾品：尚未接入"],
  },
  party: {
    title: "隊伍",
    description: "隊伍功能尚未接入。這裡沒有代行者、招募或隊友 AI 資料。",
    items: ["TEST placeholder：隊伍資料尚未建立"],
  },
  system: {
    title: "系統",
    description: "手動 Save / Load 與系統功能。",
    items: ["顯示設定：尚未接入"],
  },
};

export function utilityPanelReducer(
  state: UtilityPanelId | null,
  event: { readonly type: "open"; readonly panel: UtilityPanelId } | { readonly type: "close" },
): UtilityPanelId | null {
  return event.type === "open" ? event.panel : null;
}

export function isUtilityDismissKey(key: string): boolean {
  return key === "Escape";
}
