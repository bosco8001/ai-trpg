import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { RAW_BACKUP_DEFAULT_MAX_BYTES, RAW_BACKUP_TIMEOUT_MS, rawBackupFilename,
  type RawBackupPayload, type RawDataBackup } from "../shared/raw-data-backup.js";

export class RawBackupFailure extends Error {
  constructor(readonly code: "too-large" | "unavailable") { super(code); }
}
export interface RawBackupReader {
  capture(maxBytes: number, signal: AbortSignal): Promise<RawBackupPayload> | RawBackupPayload;
}

export function backupMaxBytes(value: string | undefined): number {
  if (value === undefined) return RAW_BACKUP_DEFAULT_MAX_BYTES;
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))
    throw new Error("RAW_BACKUP_MAX_BYTES 必須是正整數。");
  return Number(value);
}

/** Bounded JSON encoding for memory records and the envelope; no unbounded deep clone. */
export function boundedJson(value: unknown, maxBytes: number): string {
  const parts: string[] = [];
  let size = 0;
  const ancestors = new Set<object>();
  const append = (text: string) => {
    size += Buffer.byteLength(text, "utf8");
    if (size > maxBytes) throw new RawBackupFailure("too-large");
    parts.push(text);
  };
  const string = (text: string) => {
    if (Buffer.byteLength(text, "utf8") + size + 2 > maxBytes) throw new RawBackupFailure("too-large");
    append(JSON.stringify(text));
  };
  function encode(item: unknown, depth: number) {
    if (depth > 512) throw new RawBackupFailure("unavailable");
    if (item === null) { append("null"); return; }
    if (typeof item === "string") { string(item); return; }
    if (typeof item === "boolean" || typeof item === "number" && Number.isFinite(item)) {
      append(JSON.stringify(item)); return;
    }
    if (typeof item !== "object" || ancestors.has(item)) throw new RawBackupFailure("unavailable");
    ancestors.add(item);
    if (Array.isArray(item)) {
      append("[");
      for (let i = 0; i < item.length; i++) { if (i) append(","); encode(item[i], depth + 1); }
      append("]");
    } else {
      append("{");
      Object.entries(item).forEach(([key, entry], i) => {
        if (i) append(","); string(key); append(":"); encode(entry, depth + 1);
      });
      append("}");
    }
    ancestors.delete(item);
  }
  encode(value, 0);
  return parts.join("");
}

export function createMemoryBackupReader(characterId: string,
  capture: () => { current: unknown | undefined; slots: readonly { slotId: 1 | 2 | 3 }[] },
  now: () => Date = () => new Date()): RawBackupReader {
  return {
    capture(maxBytes, signal) {
      signal.throwIfAborted();
      // No await: state and slots are captured and encoded in one JavaScript turn.
      const capturedAt = now().toISOString(), source = capture();
      let remaining = maxBytes;
      const encode = (record: unknown) => {
        const raw = boundedJson(record, remaining);
        remaining -= Buffer.byteLength(raw);
        return raw;
      };
      return { storage: "memory", capturedAt, characterId,
        current: source.current === undefined ? null : encode(source.current),
        slots: ([1, 2, 3] as const).map(slotId => {
          const record = source.slots.find(slot => slot.slotId === slotId);
          return { slotId, record: record === undefined ? null : encode(record) };
        }) };
    },
  };
}

export function encodeRawBackup(payload: RawBackupPayload, maxBytes: number): string {
  const raw = boundedJson(payload, maxBytes);
  const backup: RawDataBackup = { backupFormatVersion: 1, payload: raw,
    checksum: { algorithm: "SHA-256", encoding: "utf-8", value: createHash("sha256").update(raw, "utf8").digest("hex") } };
  return boundedJson(backup, maxBytes);
}

export function registerRawBackupRoute(app: FastifyInstance, reader: RawBackupReader,
  maxBytes = RAW_BACKUP_DEFAULT_MAX_BYTES, timeoutMs = RAW_BACKUP_TIMEOUT_MS) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error("備份大小限制不正確。");
  app.get("/api/raw-data-backup", async (request, reply) => {
    reply.header("Cache-Control", "no-store").header("X-Backup-Max-Bytes", String(maxBytes));
    if (Object.keys(request.query as object).length) return reply.code(400).send({ error: "invalid-request", message: "備份範圍由伺服器設定，請重新下載。" });
    const controller = new AbortController();
    const cancel = () => controller.abort();
    const disconnected = () => { if (!reply.raw.writableFinished) cancel(); };
    request.raw.on("aborted", cancel); reply.raw.on("close", disconnected);
    const timeout = setTimeout(cancel, timeoutMs);
    let onAbort: (() => void) | undefined;
    try {
      const cancelled = new Promise<never>((_resolve, reject) => {
        onAbort = () => reject(new RawBackupFailure("unavailable"));
        controller.signal.addEventListener("abort", onAbort, { once: true });
      });
      const payload = await Promise.race([Promise.resolve().then(() => reader.capture(maxBytes, controller.signal)), cancelled]);
      controller.signal.throwIfAborted();
      const text = encodeRawBackup(payload, maxBytes);
      controller.signal.throwIfAborted();
      return reply.type("application/json; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="${rawBackupFilename(payload.capturedAt)}"`)
        .header("Content-Length", String(Buffer.byteLength(text))).send(text);
    } catch (error) {
      const large = error instanceof RawBackupFailure && error.code === "too-large";
      return reply.code(large ? 413 : 503).send({ error: large ? "backup-too-large" : "backup-unavailable",
        message: large ? "備份超過大小上限，沒有下載檔案；資料沒有被刪減。" : "目前無法完整取得備份，沒有下載檔案。請確認服務後手動重試。" });
    } finally {
      clearTimeout(timeout);
      if (onAbort) controller.signal.removeEventListener("abort", onAbort);
      request.raw.removeListener("aborted", cancel); reply.raw.removeListener("close", disconnected);
    }
  });
}
