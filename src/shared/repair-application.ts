import { isPreparationRequest, isPreparationSummary, repairIdValid,
  type RepairPreparationRequest, type RepairPreparationSummary } from "./repair-preparation.js";

// Reports contain two bounded field differences, never the complete story/raw source.
export const REPAIR_REPORT_MAX_BYTES = 64 * 1024;
export const APPLICATION_MESSAGES = {
  stale: "來源或候選已變動，請手動重新預覽及準備。",
  ineligible: "這份備份沒有有效套用資格，請重新預覽及準備。",
  blocked: "候選未通過完整驗證，沒有套用修復。",
  "identity-conflict": "來源角色與配置角色不符，沒有套用修復。",
  "revision-limit": "狀態版本已達上限，沒有套用修復。",
  conflict: "識別碼已綁定另一份請求，原紀錄沒有被改寫。",
  capacity: "結果保存容量不足，未開始修改來源；請保留識別碼查詢。",
  unavailable: "目前無法確認修復結果，請保留識別碼並手動查詢。",
  "not-found": "目前沒有可確認的修復紀錄；這不代表先前請求已撤銷。",
  "invalid-request": "修復套用請求格式不正確。",
} as const;
export type ApplicationCode = keyof typeof APPLICATION_MESSAGES;
export type RepairApplyRequest = RepairPreparationRequest & { readonly confirm: true };
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const integer = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const text = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 256;
const date = (v: unknown) => typeof v === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)
  && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
export function isRepairApplyRequest(v: unknown): v is RepairApplyRequest {
  if (!object(v) || v.confirm !== true) return false;
  const { confirm: _confirm, ...request } = v;
  return isPreparationRequest(request);
}
export const REPAIR_CHECKS = ["backup", "source", "candidate", "final"] as const;
export interface RepairEffects {
  readonly revisionBefore: number;
  readonly revisionAfter: number | null;
  readonly generationBefore: string | null;
  readonly generationAfter: string | null;
  readonly savedAt: string | null;
  readonly sourceRevision: number | null;
}
export interface RepairReport {
  readonly reportVersion: 1;
  /** This is the historical backup receipt, not the current application status. */
  readonly preparation: RepairPreparationSummary;
  readonly sourceGuard: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly status: "applied" | "rejected";
  readonly reason: ApplicationCode | null;
  readonly checks: readonly typeof REPAIR_CHECKS[number][];
  readonly effects: RepairEffects;
}
export interface RepairApplication {
  readonly applicationVersion: 1;
  readonly repairId: string;
  readonly status: "ready" | "ineligible" | "unknown" | "applied" | "rejected";
  readonly canApply: boolean;
  readonly report: RepairReport | null;
  readonly reportChecksum: string | null;
}
export function isRepairReport(v: unknown): v is RepairReport {
  if (!object(v) || !exact(v, ["reportVersion", "preparation", "sourceGuard", "startedAt", "completedAt", "status", "reason", "checks", "effects"])
    || v.reportVersion !== 1 || !isPreparationSummary(v.preparation) || !text(v.sourceGuard)
    || !date(v.startedAt) || !date(v.completedAt) || !Array.isArray(v.checks)
    || v.checks.length < 1 || v.checks.some((k, index) => k !== REPAIR_CHECKS[index])
    || !object(v.effects) || !exact(v.effects, ["revisionBefore", "revisionAfter", "generationBefore", "generationAfter", "savedAt", "sourceRevision"])) return false;
  const e = v.effects;
  if (!integer(e.revisionBefore) || e.revisionBefore !== v.preparation.revision
    || !(e.revisionAfter === null || integer(e.revisionAfter))
    || !(e.generationBefore === null || text(e.generationBefore)) || !(e.generationAfter === null || text(e.generationAfter))
    || !(e.savedAt === null || text(e.savedAt)) || !(e.sourceRevision === null || integer(e.sourceRevision))) return false;
  if (v.status === "rejected") return typeof v.reason === "string" && ["stale", "blocked", "identity-conflict", "revision-limit"].includes(v.reason)
    && e.revisionAfter === null && e.generationAfter === null;
  const checks = v.checks;
  if (v.status !== "applied" || v.reason !== null || REPAIR_CHECKS.some(k => !checks.includes(k))) return false;
  return v.preparation.source === "current"
    ? e.revisionAfter === e.revisionBefore + 1 && text(e.generationBefore) && text(e.generationAfter) && e.generationBefore !== e.generationAfter
      && e.savedAt === null && e.sourceRevision === null
    : e.revisionAfter === null && e.generationBefore === null && e.generationAfter === null && text(e.savedAt) && e.sourceRevision === e.revisionBefore;
}
export function isRepairApplication(v: unknown): v is RepairApplication {
  if (!object(v) || !exact(v, ["applicationVersion", "repairId", "status", "canApply", "report", "reportChecksum"])
    || v.applicationVersion !== 1 || !repairIdValid(v.repairId)) return false;
  if (v.status === "applied" || v.status === "rejected") return v.canApply === false && isRepairReport(v.report)
    && v.report.status === v.status && v.report.preparation.repairId === v.repairId
    && typeof v.reportChecksum === "string" && /^[a-f0-9]{64}$/.test(v.reportChecksum);
  return ["ready", "ineligible", "unknown"].includes(v.status as string) && v.canApply === (v.status === "ready")
    && v.report === null && v.reportChecksum === null;
}
export function parseRepairReport(textValue: string) {
  if (new TextEncoder().encode(textValue).byteLength > REPAIR_REPORT_MAX_BYTES) throw new Error("invalid report");
  const envelope: unknown = JSON.parse(textValue);
  if (!object(envelope) || !exact(envelope, ["reportVersion", "payload", "checksum"]) || envelope.reportVersion !== 1
    || typeof envelope.payload !== "string" || !object(envelope.checksum) || !exact(envelope.checksum, ["algorithm", "value"])
    || envelope.checksum.algorithm !== "SHA-256" || typeof envelope.checksum.value !== "string" || !/^[a-f0-9]{64}$/.test(envelope.checksum.value)) throw new Error("invalid report");
  const report: unknown = JSON.parse(envelope.payload);
  if (!isRepairReport(report)) throw new Error("invalid report");
  return { report, payload: envelope.payload, checksum: envelope.checksum.value };
}
