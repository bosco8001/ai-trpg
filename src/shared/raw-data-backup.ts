export const RAW_BACKUP_FORMAT_VERSION = 1;
export const RAW_BACKUP_DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
export const RAW_BACKUP_TIMEOUT_MS = 30_000;

/** Records remain JSON text: parsing and reserializing them would lose PostgreSQL precision. */
export interface RawBackupPayload {
  readonly storage: "memory" | "postgres";
  readonly capturedAt: string;
  readonly characterId: string;
  readonly current: string | null;
  readonly slots: readonly { readonly slotId: 1 | 2 | 3; readonly record: string | null }[];
}

export interface RawDataBackup {
  readonly backupFormatVersion: 1;
  /** SHA-256 covers these exact UTF-8 bytes, including scope/source/time. */
  readonly payload: string;
  readonly checksum: { readonly algorithm: "SHA-256"; readonly encoding: "utf-8"; readonly value: string };
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, names: readonly string[]) {
  return Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
}
function rawRecord(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  // Syntax only; never validate, normalize or reserialize the source record.
  try { return object(JSON.parse(value)); } catch { return false; }
}
export function parseRawBackup(value: unknown): { backup: RawDataBackup; payload: RawBackupPayload } {
  const invalid = () => new Error("備份檔案格式或完整性不正確，沒有下載檔案。");
  if (!object(value) || !keys(value, ["backupFormatVersion", "payload", "checksum"])
    || value.backupFormatVersion !== RAW_BACKUP_FORMAT_VERSION || typeof value.payload !== "string"
    || !object(value.checksum) || !keys(value.checksum, ["algorithm", "encoding", "value"])
    || value.checksum.algorithm !== "SHA-256" || value.checksum.encoding !== "utf-8"
    || typeof value.checksum.value !== "string" || !/^[a-f0-9]{64}$/.test(value.checksum.value)) throw invalid();
  let payload: unknown;
  try { payload = JSON.parse(value.payload); } catch { throw invalid(); }
  if (!object(payload) || !keys(payload, ["storage", "capturedAt", "characterId", "current", "slots"])
    || (payload.storage !== "memory" && payload.storage !== "postgres")
    || typeof payload.capturedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(payload.capturedAt)
    || !Number.isFinite(Date.parse(payload.capturedAt))
    || new Date(payload.capturedAt).toISOString() !== payload.capturedAt
    || typeof payload.characterId !== "string" || payload.characterId.length === 0
    || !rawRecord(payload.current) || !Array.isArray(payload.slots) || payload.slots.length !== 3
    || !payload.slots.every((slot, i) => object(slot) && keys(slot, ["slotId", "record"])
      && slot.slotId === i + 1 && rawRecord(slot.record))) throw invalid();
  return { backup: value as unknown as RawDataBackup, payload: payload as unknown as RawBackupPayload };
}

export function rawBackupFilename(capturedAt: string): string {
  return `ai-trpg-backup-${capturedAt.replace(/[-:]/g, "").replace("T", "-").replace(".", "-")}.json`;
}
