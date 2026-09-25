import { isHealthResponse, type HealthResponse } from "../shared/health.js";
import { isInterpretationResponse, type InterpretationResponse } from "../shared/interpretation.js";
import {
  isExplorationActionResponse,
  isExplorationStateSummary,
  type ExplorationActionResponse,
  type ExplorationStateSummary,
} from "../shared/exploration-action.js";
import {
  isSaveOperationResponse,
  isSaveSlotsResponse,
  type SaveOperationResponse,
  type SaveSlotId,
  type SaveSlotsResponse,
} from "../shared/save-game.js";
import {
  isAuthoritativeGameStateResponse,
  isCombatNormalAttackResponse,
  isCombatRowMoveResponse,
  isCombatItemOptionsResponse,
  isCombatItemUseResponse,
  isCombatDefendResponse,
  isCombatRunResponse,
  isCombatSandboxAdvanceResponse,
  isNormalAttackOptionsResponse,
  isRowMoveOptionsResponse,
  isPhysicalSkillOptionsResponse,
  isPhysicalSkillUseResponse,
  isCastingResponse,
  isDragonBreathOptionsResponse,
  isDragonBreathResponse,
  isCombatPartyOptionsResponse,
  isCompanionTacticPreferenceResponse,
  type AuthoritativeGameStateResponse,
  type CombatNormalAttackResponse,
  type CombatRowMoveResponse,
  type CombatItemOptionsResponse,
  type CombatItemUseResponse,
  type CombatDefendResponse,
  type CombatRunResponse,
  type CombatSandboxAdvanceResponse,
  type NormalAttackOptionsResponse,
  type RowMoveOptionsResponse,
  type PhysicalSkillOptionsResponse,
  type PhysicalSkillUseResponse,
  type CastingResponse,
  type DragonBreathOptionsResponse,
  type DragonBreathResponse,
  type CombatPartyOptionsResponse,
  type CompanionTacticPreferenceResponse,
  type CombatRow,
} from "../shared/game-state.js";

export async function checkApiHealth(
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<HealthResponse> {
  const response = await fetcher("/api/health", { signal, cache: "no-store" });
  if (!response.ok) throw new Error("服務目前無法回應。");

  const body: unknown = await response.json();
  if (!isHealthResponse(body)) throw new Error("服務回應格式不符。");
  return body;
}

/** 前端只取得候選資料；任何錯誤都使用安全的通用說明。 */
export async function requestInterpretation(
  text: string,
  fetcher: typeof fetch = fetch,
): Promise<InterpretationResponse> {
  let response: Response;
  try {
    response = await fetcher("/api/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      cache: "no-store",
    });
  } catch {
    throw new Error("候選解析暫時無法使用，請稍後再試。");
  }
  if (!response.ok) throw new Error("候選解析暫時無法使用，請稍後再試。");
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("候選解析回應格式不正確。");
  }
  if (!isInterpretationResponse(body) || body.candidate.originalText !== text.trim()) {
    throw new Error("候選解析回應格式不正確。");
  }
  return body;
}

export async function loadExplorationState(fetcher: typeof fetch = fetch): Promise<ExplorationStateSummary> {
  const response = await fetcher("/api/exploration/state", { cache: "no-store" });
  if (!response.ok) throw new Error("暫時無法讀取權威探索狀態。");
  const body: unknown = await response.json();
  if (!isExplorationStateSummary(body)) throw new Error("權威探索狀態格式不正確。");
  return body;
}

/** 讀取切換探索／戰鬥畫面所需的權威快照；前端不自行推算 combat state。 */
export async function loadAuthoritativeGameState(
  fetcher: typeof fetch = fetch,
): Promise<AuthoritativeGameStateResponse> {
  let response: Response;
  try {
    response = await fetcher("/api/game-state", { cache: "no-store" });
  } catch {
    throw new Error("目前無法讀取戰鬥狀態。");
  }
  if (!response.ok) throw await saveApiError(response, "目前無法讀取戰鬥狀態。");
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("戰鬥狀態回應格式不正確。");
  }
  if (!isAuthoritativeGameStateResponse(body)) throw new Error("戰鬥狀態回應格式不正確。");
  return body;
}

export async function loadCombatPartyOptions(fetcher: typeof fetch = fetch): Promise<CombatPartyOptionsResponse> {
  let response: Response;
  try { response = await fetcher("/api/combat/party", { cache: "no-store" }); }
  catch { throw new Error("目前無法讀取隊伍資料，請確認服務後再試。"); }
  if (!response.ok) throw await saveApiError(response, "目前無法讀取隊伍資料，請重新讀取戰鬥狀態。");
  let body: unknown;
  try { body = await response.json(); } catch { throw new Error("隊伍資料回應格式不正確。"); }
  if (!isCombatPartyOptionsResponse(body)) throw new Error("隊伍資料回應格式不正確。");
  return body;
}

export async function setCombatCompanionTacticPreference(
  expectedRevision: number,
  companionId: string,
  tacticPreferenceId: string,
  fetcher: typeof fetch = fetch,
): Promise<CompanionTacticPreferenceResponse> {
  let response: Response;
  try {
    response = await fetcher("/api/combat/party/tactic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision, companionId, tacticPreferenceId }),
      cache: "no-store",
    });
  } catch { throw new Error("目前無法更新隊友偏好，請重新讀取隊伍資料後再試。"); }
  if (response.status >= 500) throw new Error("目前無法更新隊友偏好，請稍後再試。");
  if (!response.ok) throw await saveApiError(response, "隊友偏好未能更新，請重新讀取隊伍資料後再試。");
  let body: unknown;
  try { body = await response.json(); } catch { throw new Error("隊友偏好回應格式不正確。"); }
  if (!isCompanionTacticPreferenceResponse(body)
    || body.effect.companionId !== companionId || body.effect.tacticPreferenceId !== tacticPreferenceId
    || (body.effect.type === "tactic-preference-updated"
      ? body.state.revision !== expectedRevision + 1
      : body.state.revision !== expectedRevision)) throw new Error("隊友偏好回應格式不正確。");
  return body;
}

/** 只供 COMBAT_SANDBOX 的工程按鈕使用；正式玩家指令尚未建立。 */
export async function advanceTestCombatTurn(
  expectedRevision: number,
  fetcher: typeof fetch = fetch,
): Promise<CombatSandboxAdvanceResponse> {
  let response: Response;
  try {
    response = await fetcher("/api/dev/combat/advance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision }),
      cache: "no-store",
    });
  } catch {
    throw new Error("目前無法推進 TEST 戰鬥回合。");
  }
  if (!response.ok) throw await saveApiError(response, "目前無法推進 TEST 戰鬥回合。");
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("TEST 戰鬥回應格式不正確。");
  }
  if (!isCombatSandboxAdvanceResponse(body)) throw new Error("TEST 戰鬥回應格式不正確。");
  return body;
}

/** Reads server-derived target options; the result is never treated as persistent state. */
export async function loadNormalAttackOptions(
  fetcher: typeof fetch = fetch,
): Promise<NormalAttackOptionsResponse> {
  let response: Response;
  try {
    response = await fetcher("/api/combat/normal-attack/options", { cache: "no-store" });
  } catch {
    throw new Error("目前無法讀取合法攻擊目標，請確認服務後再試。");
  }
  if (!response.ok) throw await saveApiError(response, "目前無法讀取合法攻擊目標，請重新讀取戰鬥狀態。");
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("合法攻擊目標回應格式不正確。");
  }
  if (!isNormalAttackOptionsResponse(body)) throw new Error("合法攻擊目標回應格式不正確。");
  return body;
}

/** Sends only the expected revision and selected target; the server chooses the actor and rolls both checks. */
export async function executeNormalAttack(
  expectedRevision: number,
  targetId: string,
  fetcher: typeof fetch = fetch,
): Promise<CombatNormalAttackResponse> {
  let response: Response;
  try {
    response = await fetcher("/api/combat/normal-attack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision, targetId }),
      cache: "no-store",
    });
  } catch {
    throw new Error("普通攻擊暫時無法使用，請重新讀取戰鬥狀態。");
  }
  if (!response.ok) throw await saveApiError(response, "普通攻擊暫時無法使用，請重新讀取戰鬥狀態。");
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("普通攻擊回應格式不正確。");
  }
  if (!isCombatNormalAttackResponse(body)) throw new Error("普通攻擊回應格式不正確。");
  return body;
}

export async function loadPhysicalSkillOptions(fetcher: typeof fetch = fetch): Promise<PhysicalSkillOptionsResponse> {
  let response: Response;
  try { response = await fetcher("/api/combat/physical-skills/options", { cache: "no-store" }); }
  catch { throw new Error("目前無法讀取物理技能，請確認服務後再試。"); }
  if (!response.ok) throw await saveApiError(response, "目前無法讀取物理技能，請重新讀取戰鬥狀態。");
  let body: unknown;
  try { body = await response.json(); }
  catch { throw new Error("物理技能選項回應格式不正確。"); }
  if (!isPhysicalSkillOptionsResponse(body)) throw new Error("物理技能選項回應格式不正確。");
  return body;
}

export async function loadDragonBreathOptions(fetcher: typeof fetch = fetch): Promise<DragonBreathOptionsResponse> {
  let response: Response;
  try { response = await fetcher("/api/combat/dragon-breath/options", { cache: "no-store" }); }
  catch { throw new Error("目前無法讀取龍息狀態，請確認服務後再試。"); }
  if (!response.ok) throw await saveApiError(response, "目前無法讀取龍息狀態，請重新讀取戰鬥狀態。");
  let body: unknown;
  try { body = await response.json(); } catch { throw new Error("龍息選項回應格式不正確。"); }
  if (!isDragonBreathOptionsResponse(body)) throw new Error("龍息選項回應格式不正確。");
  return body;
}

export async function executeDragonBreath(
  expectedRevision: number, targetRow: CombatRow, fetcher: typeof fetch = fetch,
): Promise<DragonBreathResponse> {
  let response: Response;
  try { response = await fetcher("/api/combat/dragon-breath", {
    method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
    body: JSON.stringify({ expectedRevision, targetRow }),
  }); } catch { throw new Error("龍息暫時無法使用，請重新讀取戰鬥狀態。"); }
  if (response.status >= 500) throw new Error("目前無法完成龍息判定，請再試一次。");
  if (!response.ok) throw await saveApiError(response, "龍息暫時無法使用，請重新讀取戰鬥狀態。");
  let body: unknown;
  try { body = await response.json(); } catch { throw new Error("龍息回應格式不正確。"); }
  if (!isDragonBreathResponse(body) || body.state.revision !== expectedRevision + 1
    || body.state.combat?.lastAction?.type !== "dragon-breath"
    || body.state.combat.lastAction.targetRow !== targetRow) throw new Error("龍息回應格式不正確。");
  return body;
}

export async function executePhysicalSkill(
  expectedRevision: number, skillId: string, targetId: string, fetcher: typeof fetch = fetch,
): Promise<PhysicalSkillUseResponse> {
  let response: Response;
  try {
    response = await fetcher("/api/combat/physical-skills/use", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision, skillId, targetId }), cache: "no-store",
    });
  } catch { throw new Error("物理技能暫時無法使用，請重新讀取戰鬥狀態。"); }
  if (response.status >= 500) throw new Error("目前無法完成技能判定，請再試一次。");
  if (!response.ok) throw await saveApiError(response, "物理技能暫時無法使用，請重新讀取戰鬥狀態。");
  let body: unknown;
  try { body = await response.json(); }
  catch { throw new Error("物理技能回應格式不正確。"); }
  if (!isPhysicalSkillUseResponse(body) || body.state.revision !== expectedRevision + 1
    || body.state.combat?.lastAction?.type !== "physical-skill"
    || body.state.combat.lastAction.skillId !== skillId
    || body.state.combat.lastAction.targetId !== targetId) throw new Error("物理技能回應格式不正確。");
  return body;
}

export async function executeCasting(
  kind: "start" | "continue" | "cancel", expectedRevision: number,
  skillId?: string, fetcher: typeof fetch = fetch,
): Promise<CastingResponse> {
  let response: Response;
  try {
    response = await fetcher(`/api/combat/casting/${kind}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      body: JSON.stringify(kind === "start" ? { expectedRevision, skillId } : { expectedRevision }),
    });
  } catch { throw new Error("目前無法提交詠唱，請重新讀取戰鬥狀態。"); }
  if (response.status >= 500) throw new Error("目前無法完成詠唱操作，請再試一次。");
  if (!response.ok) throw await saveApiError(response, "詠唱操作未能完成，請重新讀取戰鬥狀態。");
  let body: unknown;
  try { body = await response.json(); }
  catch { throw new Error("詠唱回應格式不正確。"); }
  if (!isCastingResponse(body) || body.state.revision !== expectedRevision + 1
    || (kind === "start" && body.effect.type !== "casting-started")
    || (kind === "cancel" && body.effect.type !== "casting-cancelled")
    || (kind === "continue" && body.effect.type !== "casting-continued" && body.effect.type !== "casting-completed")) {
    throw new Error("詠唱回應格式不正確。");
  }
  return body;
}

/** Reads server-derived row options; this request never mutates combat state. */
export async function loadRowMoveOptions(
  fetcher: typeof fetch = fetch,
): Promise<RowMoveOptionsResponse> {
  let response: Response;
  try {
    response = await fetcher("/api/combat/row-move/options", { cache: "no-store" });
  } catch {
    throw new Error("目前無法讀取合法換排選項，請確認服務後再試。");
  }
  if (!response.ok) throw await saveApiError(response, "目前無法讀取合法換排選項，請重新讀取戰鬥狀態。");
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("換排選項回應格式不正確。");
  }
  if (!isRowMoveOptionsResponse(body)) throw new Error("換排選項回應格式不正確。");
  return body;
}

/** Sends only the selected row and expected revision; the server chooses the actor. */
export async function executeRowMove(
  expectedRevision: number,
  targetRow: "front" | "back",
  fetcher: typeof fetch = fetch,
): Promise<CombatRowMoveResponse> {
  let response: Response;
  try {
    response = await fetcher("/api/combat/row-move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision, targetRow }),
      cache: "no-store",
    });
  } catch {
    throw new Error("移動暫時無法使用，請重新讀取戰鬥狀態。");
  }
  if (!response.ok) throw await saveApiError(response, "移動暫時無法使用，請重新讀取戰鬥狀態。");
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("移動回應格式不正確。");
  }
  if (!isCombatRowMoveResponse(body)
    || body.state.revision !== expectedRevision + 1
    || body.state.combat?.lastAction?.type !== "row-move"
    || body.state.combat.lastAction.toRow !== targetRow) {
    throw new Error("移動回應格式不正確。");
  }
  return body;
}

/** Loads server-derived inventory options; reading the bag has no mutation endpoint. */
export async function loadCombatItemOptions(fetcher: typeof fetch = fetch): Promise<CombatItemOptionsResponse> {
  let response: Response;
  try {
    response = await fetcher("/api/combat/items/options", { cache: "no-store" });
  } catch {
    throw new Error("目前無法讀取戰鬥背包，請確認服務後再試。");
  }
  if (!response.ok) throw await saveApiError(response, "目前無法讀取戰鬥背包，請重新讀取戰鬥狀態。");
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("戰鬥背包回應格式不正確。");
  }
  if (!isCombatItemOptionsResponse(body)) throw new Error("戰鬥背包回應格式不正確。");
  return body;
}

/** Only the server can select the current actor, consume quantity, and advance the Turn. */
export async function executeCombatItemUse(
  expectedRevision: number,
  itemId: string,
  fetcher: typeof fetch = fetch,
): Promise<CombatItemUseResponse> {
  let response: Response;
  try {
    response = await fetcher("/api/combat/items/use", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision, itemId }),
      cache: "no-store",
    });
  } catch {
    throw new Error("物品暫時無法使用，請重新讀取戰鬥狀態。");
  }
  if (!response.ok) throw await saveApiError(response, "物品暫時無法使用，請重新讀取戰鬥狀態。");
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("物品使用回應格式不正確。");
  }
  if (!isCombatItemUseResponse(body)) throw new Error("物品使用回應格式不正確。");
  const action = body.state.combat?.lastAction;
  if (body.state.revision !== expectedRevision + 1
    || action?.type !== "item-use" || action.itemId !== itemId
    || body.options.revision !== expectedRevision + 1) {
    throw new Error("物品使用回應格式不正確。");
  }
  return body;
}

/** Sends the exact revision-only command; actor and Turn advancement are decided by the server. */
export async function executeDefend(
  expectedRevision: number,
  fetcher: typeof fetch = fetch,
): Promise<CombatDefendResponse> {
  let response: Response;
  try {
    response = await fetcher("/api/combat/defend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision }),
      cache: "no-store",
    });
  } catch {
    throw new Error("防禦暫時無法使用，請重新讀取戰鬥狀態。");
  }
  if (!response.ok) throw await saveApiError(response, "防禦暫時無法使用，請重新讀取戰鬥狀態。");
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("防禦回應格式不正確。");
  }
  if (!isCombatDefendResponse(body) || body.state.revision !== expectedRevision + 1) {
    throw new Error("防禦回應格式不正確。");
  }
  return body;
}

/** Only revision crosses the boundary; the server chooses actor, D20 and DC. */
export async function executeRun(
  expectedRevision: number,
  fetcher: typeof fetch = fetch,
): Promise<CombatRunResponse> {
  let response: Response;
  try {
    response = await fetcher("/api/combat/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision }),
      cache: "no-store",
    });
  } catch {
    throw new Error("逃跑暫時無法使用，請重新讀取戰鬥狀態。");
  }
  if (!response.ok) throw await saveApiError(response, "逃跑暫時無法使用，請重新讀取戰鬥狀態。");
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("逃跑回應格式不正確。");
  }
  if (!isCombatRunResponse(body) || body.state.revision !== expectedRevision + 1) {
    throw new Error("逃跑回應格式不正確。");
  }
  return body;
}

export async function executeExplorationAction(
  text: string,
  expectedRevision: number,
  fetcher: typeof fetch = fetch,
): Promise<ExplorationActionResponse> {
  let response: Response;
  try {
    response = await fetcher("/api/exploration/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, expectedRevision }),
      cache: "no-store",
    });
  } catch {
    throw new Error("探索裁定暫時無法使用，請稍後再試。");
  }
  if (!response.ok && response.status !== 409) throw new Error("探索裁定暫時無法使用，請稍後再試。");
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("探索裁定回應格式不正確。");
  }
  if (!isExplorationActionResponse(body) || body.candidate.originalText !== text.trim()) {
    throw new Error("探索裁定回應格式不正確。");
  }
  return body;
}

function isSafeApiError(value: unknown): value is { error: string; message: string } {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === 2 && "error" in value && typeof value.error === "string"
    && "message" in value && typeof value.message === "string";
}

async function saveApiError(response: Response, fallback: string): Promise<Error> {
  try {
    const body: unknown = await response.json();
    if (isSafeApiError(body) && body.message.trim().length > 0) return new Error(body.message);
  } catch {
    // 使用固定安全訊息；不顯示原始 response 或內部錯誤。
  }
  return new Error(fallback);
}

export async function listSaveSlots(fetcher: typeof fetch = fetch): Promise<SaveSlotsResponse> {
  let response: Response;
  try {
    response = await fetcher("/api/save-slots", { cache: "no-store" });
  } catch {
    throw new Error("存檔列表暫時無法使用，請稍後再試。");
  }
  if (!response.ok) throw await saveApiError(response, "存檔列表暫時無法使用，請稍後再試。");
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("存檔列表回應格式不正確。");
  }
  if (!isSaveSlotsResponse(body)) throw new Error("存檔列表回應格式不正確。");
  return body;
}

async function changeSaveSlot(
  method: "PUT" | "POST",
  slotId: SaveSlotId,
  expectedRevision: number,
  fetcher: typeof fetch,
): Promise<SaveOperationResponse> {
  const suffix = method === "POST" ? "/load" : "";
  let response: Response;
  try {
    response = await fetcher(`/api/save-slots/${slotId}${suffix}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision }),
      cache: "no-store",
    });
  } catch {
    throw new Error(method === "PUT" ? "目前無法儲存，請稍後再試。" : "目前無法載入，請稍後再試。");
  }
  if (!response.ok) {
    throw await saveApiError(response, method === "PUT" ? "目前無法儲存，請稍後再試。" : "目前無法載入，請稍後再試。");
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("存檔操作回應格式不正確。");
  }
  if (!isSaveOperationResponse(body)) throw new Error("存檔操作回應格式不正確。");
  return body;
}

export function saveGame(slotId: SaveSlotId, expectedRevision: number, fetcher: typeof fetch = fetch) {
  return changeSaveSlot("PUT", slotId, expectedRevision, fetcher);
}

export function loadGame(slotId: SaveSlotId, expectedRevision: number, fetcher: typeof fetch = fetch) {
  return changeSaveSlot("POST", slotId, expectedRevision, fetcher);
}
