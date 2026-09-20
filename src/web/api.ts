import { isHealthResponse, type HealthResponse } from "../shared/health.js";

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
