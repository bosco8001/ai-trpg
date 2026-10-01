import { isRepairPreviewReport, REPAIR_MAX_RESPONSE_BYTES, REPAIR_SOURCES,
  type RepairPreviewReport, type RepairSource } from "../shared/repair-preview.js";

// 只記錄本頁已知／可能的資料變動；不輪詢，也不假裝知道其他分頁的現況。
const epochs: Record<RepairSource, number> = { current: 0, 1: 0, 2: 0, 3: 0 };
const listeners = new Set<(source: RepairSource) => void>();
export function invalidateRepairSource(source: RepairSource) {
  epochs[source] += 1;
  for (const listener of listeners) listener(source);
}
export function subscribeRepairChanges(listener: (source: RepairSource) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const repairEpochs = () => ({ ...epochs });
export function changedRepairSources(before: Record<RepairSource, number>): RepairSource[] {
  return REPAIR_SOURCES.filter(source => epochs[source] !== before[source]);
}
export async function loadRepairPreview(signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<RepairPreviewReport> {
  const response = await fetcher("/api/repair-preview", { method: "GET", cache: "no-store", signal });
  const fail = () => new Error("目前無法取得完整候選預覽，請手動重試。不能據此判定資料損壞。");
  if (!response.ok || !response.body || !response.headers.get("Content-Type")?.startsWith("application/json")) {
    await response.body?.cancel(); throw fail();
  }
  const length = response.headers.get("Content-Length");
  if (!length || !/^[1-9]\d*$/.test(length) || Number(length) > REPAIR_MAX_RESPONSE_BYTES) {
    await response.body.cancel(); throw fail();
  }
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    signal.throwIfAborted();
    while (true) {
      const part = await reader.read(); signal.throwIfAborted();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > Number(length) || size > REPAIR_MAX_RESPONSE_BYTES) throw fail();
      chunks.push(part.value);
    }
    if (size !== Number(length)) throw fail();
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { signal.removeEventListener("abort", cancel); reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let report: unknown;
  try { report = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw fail(); }
  signal.throwIfAborted();
  if (!isRepairPreviewReport(report)) throw fail();
  return report;
}
