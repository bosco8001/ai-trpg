import { REPAIR_MAX_RESPONSE_BYTES } from "../shared/repair-preview.js";
import { PREPARATION_MESSAGES, REPAIR_BACKUP_MAX_BYTES, isPreparationPage, isPreparationSummary, parseRepairBackup,
  type RepairPreparationPage, type RepairPreparationRequest, type RepairPreparationSummary } from "../shared/repair-preparation.js";

export class PreparationClientFailure extends Error {
  constructor(message: string, readonly code = "unavailable") { super(message); }
}
export async function receive(response: Response, signal: AbortSignal, limit: number): Promise<string> {
  const length = response.headers.get("Content-Length");
  if (!response.body || !response.headers.get("Content-Type")?.startsWith("application/json") || !length
    || !/^[1-9]\d*$/.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) > limit) {
    await response.body?.cancel(); throw new PreparationClientFailure("回應格式或大小不正確，請保留識別碼並手動查詢。");
  }
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  let size = 0;
  try {
    signal.throwIfAborted();
    while (true) {
      const part = await reader.read(); signal.throwIfAborted();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > Number(length) || size > limit) throw new PreparationClientFailure("回應超過大小上限。");
      chunks.push(part.value);
    }
    if (size !== Number(length)) throw new PreparationClientFailure("回應內容不完整，請手動查詢。");
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { signal.removeEventListener("abort", cancel); reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
async function responseText(url: string, signal: AbortSignal, fetcher: typeof fetch, request?: RepairPreparationRequest,
  download = false): Promise<string> {
  signal.throwIfAborted();
  const response = await fetcher(url, { method: request ? "POST" : "GET", cache: "no-store", signal,
    ...(request ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) } : {}) });
  if (!response.ok) {
    const text = await receive(response, signal, REPAIR_MAX_RESPONSE_BYTES);
    const value: unknown = JSON.parse(text);
    if (value && typeof value === "object" && "code" in value && typeof value.code === "string" && Object.hasOwn(PREPARATION_MESSAGES, value.code)) {
      const code = value.code as keyof typeof PREPARATION_MESSAGES;
      throw new PreparationClientFailure(PREPARATION_MESSAGES[code], code);
    }
    throw new PreparationClientFailure("目前無法確認結果，請手動查詢。");
  }
  let limit = REPAIR_MAX_RESPONSE_BYTES;
  if (download) {
    const header = response.headers.get("X-Repair-Backup-Max-Bytes");
    if (!header || !/^[1-9]\d*$/.test(header) || !Number.isSafeInteger(Number(header)) || Number(header) > REPAIR_BACKUP_MAX_BYTES) {
      await response.body?.cancel(); throw new PreparationClientFailure("備份大小契約不正確，沒有下載檔案。");
    }
    limit = Number(header);
  }
  return receive(response, signal, limit);
}
export async function prepareRepair(value: RepairPreparationRequest, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<RepairPreparationSummary> {
  const result: unknown = JSON.parse(await responseText("/api/repair-preparations", signal, fetcher, value));
  if (!isPreparationSummary(result) || result.repairId !== value.repairId || result.source !== value.source
    || result.storage !== value.storage || result.fingerprint !== value.fingerprint || result.candidateFingerprint !== value.candidateFingerprint)
    throw new PreparationClientFailure("備份回應不符合本次準備，請保留識別碼並手動查詢。");
  signal.throwIfAborted(); return result;
}
export async function lookupPreparation(id: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<RepairPreparationSummary> {
  const result: unknown = JSON.parse(await responseText(`/api/repair-preparations/${encodeURIComponent(id)}`, signal, fetcher));
  if (!isPreparationSummary(result) || result.repairId !== id) throw new PreparationClientFailure("查詢回應格式不正確。");
  signal.throwIfAborted(); return result;
}
export async function listPreparations(cursor: string | null, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<RepairPreparationPage> {
  const result: unknown = JSON.parse(await responseText(`/api/repair-preparations${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, signal, fetcher));
  if (!isPreparationPage(result)) throw new PreparationClientFailure("備份紀錄回應格式不正確。");
  signal.throwIfAborted(); return result;
}
const digest = async (text: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map(b => b.toString(16).padStart(2, "0")).join("");
export async function loadPreparationBackup(expected: RepairPreparationSummary, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<{ text: string; filename: string }> {
  const text = await responseText(`/api/repair-preparations/${encodeURIComponent(expected.repairId)}/backup`, signal, fetcher, undefined, true);
  const { envelope, data } = parseRepairBackup(text);
  if (data.repairId !== expected.repairId || data.characterId !== expected.characterId || data.storage !== expected.storage
    || data.source !== expected.source || data.fingerprint !== expected.fingerprint || data.candidateFingerprint !== expected.candidateFingerprint
    || data.runtimeId !== expected.runtimeId || data.capturedAt !== expected.capturedAt || data.preparedAt !== expected.preparedAt
    || data.revision !== expected.revision || JSON.stringify(data.changes) !== JSON.stringify(expected.changes)
    || new TextEncoder().encode(text).byteLength !== expected.backupBytes || envelope.checksum.value !== expected.backupChecksum
    || await digest(envelope.payload) !== envelope.checksum.value
    || await digest(JSON.stringify([1, data.storage, data.characterId, data.source]) + "\n" + data.raw) !== data.fingerprint)
    throw new PreparationClientFailure("備份校驗或範圍不符，沒有下載檔案。");
  signal.throwIfAborted();
  return { text, filename: `ai-trpg-repair-${data.repairId}.json` };
}
