import { parseRawBackup, rawBackupFilename, type RawBackupPayload } from "../shared/raw-data-backup.js";

export class RawBackupClientFailure extends Error {}

export async function loadRawBackup(signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<{
  text: string; filename: string; payload: RawBackupPayload;
}> {
  signal.throwIfAborted();
  const response = await fetcher("/api/raw-data-backup", { method: "GET", cache: "no-store", signal });
  if (!response.ok) {
    await response.body?.cancel();
    throw new RawBackupClientFailure(response.status === 413
      ? "備份超過大小上限，沒有下載檔案；資料沒有被刪減。"
      : "目前無法完整取得備份，沒有下載檔案。請確認服務後手動重試。");
  }
  const header = response.headers.get("X-Backup-Max-Bytes"), length = response.headers.get("Content-Length");
  const maxBytes = Number(header), expectedLength = Number(length);
  if (!header || !/^[1-9]\d*$/.test(header) || !Number.isSafeInteger(maxBytes)
    || !length || !/^[1-9]\d*$/.test(length) || !Number.isSafeInteger(expectedLength)
    || !response.headers.get("Content-Type")?.startsWith("application/json") || !response.body)
    { await response.body?.cancel(); throw new RawBackupClientFailure("備份回應格式不正確，沒有下載檔案。"); }
  if (expectedLength > maxBytes) { await response.body.cancel(); throw new RawBackupClientFailure("備份超過大小上限，沒有下載檔案。"); }
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  const cancel = () => { void reader.cancel().catch(() => {}); };
  let received = 0;
  signal.addEventListener("abort", cancel, { once: true });
  try {
    signal.throwIfAborted();
    while (true) {
      const { value, done } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes || received > expectedLength) {
        await reader.cancel(); throw new RawBackupClientFailure("備份大小不符合回應，沒有下載檔案。");
      }
      chunks.push(value);
    }
    if (received !== expectedLength) throw new RawBackupClientFailure("備份內容不完整，沒有下載檔案。");
  } catch (error) {
    await reader.cancel().catch(() => {}); throw error;
  } finally {
    signal.removeEventListener("abort", cancel); reader.releaseLock();
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new RawBackupClientFailure("備份檔案格式不正確，沒有下載檔案。"); }
  let parsed: ReturnType<typeof parseRawBackup>;
  try { parsed = parseRawBackup(value); } catch { throw new RawBackupClientFailure("備份檔案格式或完整性不正確，沒有下載檔案。"); }
  const { backup, payload } = parsed;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(backup.payload));
  signal.throwIfAborted();
  const checksum = [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  if (checksum !== backup.checksum.value) throw new RawBackupClientFailure("備份校驗失敗，沒有下載檔案。請手動重試。");
  return { text, filename: rawBackupFilename(payload.capturedAt), payload };
}

export function downloadRawBackup(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename;
  document.body.append(anchor);
  try { anchor.click(); } finally { anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
