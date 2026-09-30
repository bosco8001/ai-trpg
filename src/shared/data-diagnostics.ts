import { SAVE_SLOT_IDS, type SaveSlotId } from "./save-game.js";

export const DATA_DIAGNOSTIC_STATUSES = [
  "healthy", "empty", "missing-data", "invalid-data", "unsupported-version", "unavailable",
] as const;
export type DataDiagnosticStatus = typeof DATA_DIAGNOSTIC_STATUSES[number];

export interface DataDiagnosticResult {
  readonly status: DataDiagnosticStatus;
  readonly revision: number | null;
  readonly formatVersion: number | null;
}

export interface DataDiagnosticsReport {
  readonly readOnly: true;
  readonly storage: "memory" | "postgres";
  readonly checkedAt: string;
  readonly current: DataDiagnosticResult;
  readonly slots: readonly (DataDiagnosticResult & { readonly slotId: SaveSlotId })[];
}

export const DATA_DIAGNOSTIC_LABELS: Record<DataDiagnosticStatus, string> = {
  healthy: "正常",
  empty: "空槽",
  "missing-data": "缺少必要資料",
  "invalid-data": "資料不合法",
  "unsupported-version": "版本不支援",
  unavailable: "目前無法讀取",
};

export const DATA_DIAGNOSTIC_DESCRIPTIONS: Record<DataDiagnosticStatus, string> = {
  healthy: "通過現有格式、資源與內部引用檢查；能否載入仍由載入規則判定。",
  empty: "這個存檔槽尚未保存資料。",
  "missing-data": "未找到資料，或舊資料缺少可驗證的角色／世界資訊。",
  "invalid-data": "資料格式、資源或引用不符合目前規則，這次檢查沒有修改資料。",
  "unsupported-version": "目前程式不支援這個資料版本，這次檢查沒有轉換資料。",
  unavailable: "服務暫時無法讀取資料，不能據此判定資料已損壞。",
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

function result(value: unknown, slotId?: SaveSlotId): boolean {
  if (!record(value) || !exact(value, slotId === undefined
    ? ["status", "revision", "formatVersion"] : ["slotId", "status", "revision", "formatVersion"])) return false;
  if (slotId !== undefined && value.slotId !== slotId) return false;
  if (!DATA_DIAGNOSTIC_STATUSES.some(status => value.status === status)) return false;
  if (slotId === undefined && value.status === "empty") return false;
  const validRevision = value.revision === null
    || typeof value.revision === "number" && Number.isSafeInteger(value.revision) && value.revision >= 0;
  const validVersion = value.formatVersion === null
    || typeof value.formatVersion === "number" && Number.isSafeInteger(value.formatVersion) && value.formatVersion >= 1;
  return validRevision && validVersion;
}

export function isDataDiagnosticsReport(value: unknown): value is DataDiagnosticsReport {
  return record(value) && exact(value, ["readOnly", "storage", "checkedAt", "current", "slots"])
    && value.readOnly === true && (value.storage === "memory" || value.storage === "postgres")
    && typeof value.checkedAt === "string" && !Number.isNaN(Date.parse(value.checkedAt))
    && result(value.current) && Array.isArray(value.slots) && value.slots.length === SAVE_SLOT_IDS.length
    && value.slots.every((slot, index) => result(slot, SAVE_SLOT_IDS[index]));
}
