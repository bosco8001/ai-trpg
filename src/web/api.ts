import { isHealthResponse, type HealthResponse } from "../shared/health.js";
import { isInterpretationResponse, type InterpretationResponse } from "../shared/interpretation.js";
import {
  isExplorationActionResponse,
  isExplorationStateSummary,
  type ExplorationActionResponse,
  type ExplorationStateSummary,
} from "../shared/exploration-action.js";

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
