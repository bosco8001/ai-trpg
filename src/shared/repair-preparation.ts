import { isRepairPreviewReport, REPAIR_MAX_SOURCE_BYTES, REPAIR_SOURCES, type RepairChange, type RepairSource } from "./repair-preview.js";

export const REPAIR_BACKUP_MAX_BYTES = 32 * 1024 * 1024;
export const REPAIR_ARCHIVE_MAX_BYTES = 1024 * 1024 * 1024;
export const REPAIR_PAGE_SIZE = 20;
export const repairIdValid = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const hash = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, names: readonly string[]) => Object.keys(v).length === names.length && names.every(n => Object.hasOwn(v, n));
const date = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
export interface RepairPreparationRequest {
  readonly repairId: string;
  readonly source: RepairSource;
  readonly storage: "memory" | "postgres";
  readonly previewVersion: 1;
  readonly rulesVersion: 1;
  readonly fingerprint: string;
  readonly candidateFingerprint: string;
}
export function isPreparationRequest(v: unknown): v is RepairPreparationRequest {
  return object(v) && exact(v, ["repairId", "source", "storage", "previewVersion", "rulesVersion", "fingerprint", "candidateFingerprint"])
    && repairIdValid(v.repairId) && REPAIR_SOURCES.some(s => s === v.source)
    && (v.storage === "memory" || v.storage === "postgres") && v.previewVersion === 1 && v.rulesVersion === 1
    && hash(v.fingerprint) && hash(v.candidateFingerprint);
}
export interface RepairPreparationData extends RepairPreparationRequest {
  readonly characterId: string;
  readonly runtimeId: string | null;
  readonly capturedAt: string;
  readonly preparedAt: string;
  readonly revision: number;
  readonly formatVersion: 2;
  readonly changes: readonly RepairChange[];
}
export interface RepairBackupPayload extends RepairPreparationData { readonly raw: string }
export interface RepairBackupEnvelope {
  readonly backupVersion: 1;
  readonly payload: string;
  readonly checksum: { readonly algorithm: "SHA-256"; readonly value: string };
}
const dataKeys = ["repairId", "source", "storage", "previewVersion", "rulesVersion", "fingerprint", "candidateFingerprint",
  "characterId", "runtimeId", "capturedAt", "preparedAt", "revision", "formatVersion", "changes"];
function dataValid(v: Record<string, unknown>): boolean {
  const req = Object.fromEntries(["repairId", "source", "storage", "previewVersion", "rulesVersion", "fingerprint", "candidateFingerprint"].map(k => [k, v[k]]));
  if (!isPreparationRequest(req) || typeof v.characterId !== "string" || !v.characterId.length || v.characterId.length > 256
    || v.characterId.trim() !== v.characterId || !date(v.preparedAt)
    || (v.storage === "memory" ? !repairIdValid(v.runtimeId) : v.runtimeId !== null)) return false;
  // Reuse the strict R02 evidence contract rather than accepting arbitrary diff objects.
  const result = { source: v.source, capturedAt: v.capturedAt, status: "candidate", fingerprint: v.fingerprint,
    candidateFingerprint: v.candidateFingerprint, revision: v.revision, formatVersion: v.formatVersion, changes: v.changes, issues: [] };
  return isRepairPreviewReport({ previewVersion: 1, readOnly: true, storage: v.storage,
    results: REPAIR_SOURCES.map(source => source === v.source ? result : source === "current"
      ? { source, capturedAt: v.capturedAt, status: "missing", fingerprint: null, candidateFingerprint: null, revision: null, formatVersion: null, changes: [], issues: [{ code: "missing", path: "record" }] }
      : { source, capturedAt: v.capturedAt, status: "empty", fingerprint: null, candidateFingerprint: null, revision: null, formatVersion: null, changes: [], issues: [] }) });
}
export function parseRepairBackup(text: string): { envelope: RepairBackupEnvelope; data: RepairBackupPayload } {
  if (new TextEncoder().encode(text).byteLength > REPAIR_BACKUP_MAX_BYTES) throw new Error("invalid backup");
  const value: unknown = JSON.parse(text);
  if (!object(value) || !exact(value, ["backupVersion", "payload", "checksum"]) || value.backupVersion !== 1
    || typeof value.payload !== "string" || !object(value.checksum) || !exact(value.checksum, ["algorithm", "value"])
    || value.checksum.algorithm !== "SHA-256" || !hash(value.checksum.value)) throw new Error("invalid backup");
  const data: unknown = JSON.parse(value.payload);
  if (!object(data) || !exact(data, [...dataKeys, "raw"]) || !dataValid(data) || typeof data.raw !== "string"
    || new TextEncoder().encode(data.raw).byteLength > REPAIR_MAX_SOURCE_BYTES) throw new Error("invalid backup");
  return { envelope: value as unknown as RepairBackupEnvelope, data: data as unknown as RepairBackupPayload };
}
export interface RepairPreparationSummary extends RepairPreparationData {
  readonly status: "ready";
  readonly applied: false;
  readonly backupBytes: number;
  readonly backupChecksum: string;
  readonly sameRuntime: boolean;
}
export function isPreparationSummary(v: unknown): v is RepairPreparationSummary {
  return object(v) && exact(v, [...dataKeys, "status", "applied", "backupBytes", "backupChecksum", "sameRuntime"])
    && dataValid(v) && v.status === "ready" && v.applied === false && typeof v.sameRuntime === "boolean"
    && typeof v.backupBytes === "number" && Number.isSafeInteger(v.backupBytes) && v.backupBytes > 0
    && v.backupBytes <= REPAIR_BACKUP_MAX_BYTES && hash(v.backupChecksum);
}
export interface RepairPreparationPage { readonly records: readonly RepairPreparationSummary[]; readonly nextCursor: string | null }
export function isPreparationPage(v: unknown): v is RepairPreparationPage {
  return object(v) && exact(v, ["records", "nextCursor"]) && Array.isArray(v.records) && v.records.length <= REPAIR_PAGE_SIZE
    && v.records.every(isPreparationSummary) && new Set(v.records.map(r => r.repairId)).size === v.records.length
    && (v.nextCursor === null || repairIdValid(v.nextCursor) && v.records.length === REPAIR_PAGE_SIZE && v.records.at(-1)?.repairId === v.nextCursor);
}
export const PREPARATION_MESSAGES = {
  "invalid-request": "修復準備請求格式不正確。",
  stale: "來源或候選已變動，請手動重新預覽。",
  blocked: "來源沒有可用候選，未建立就緒備份。",
  "identity-conflict": "存檔角色與配置角色不同，不能準備修復。",
  conflict: "這個修復識別碼已綁定另一份請求，請查詢原紀錄。",
  capacity: "備份總容量已達上限，未新增備份；舊備份仍保留。",
  "capacity-after-backup": "完整備份已保存，但容量不足，未取得套用資格。請保留識別碼查詢及下載備份；容量問題處理後，重新預覽並使用新識別碼準備。遊戲資料尚未修改。",
  "too-large": "備份超過大小上限，沒有截斷資料。",
  "not-found": "目前沒有可確認的紀錄；這不代表先前請求已撤銷。",
  unavailable: "目前無法確認備份結果，請保留識別碼並手動查詢。",
} as const;
