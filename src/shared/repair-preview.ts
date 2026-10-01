import { SAVE_SLOT_IDS, type SaveSlotId } from "./save-game.js";

export const REPAIR_SOURCES = ["current", ...SAVE_SLOT_IDS] as const;
export type RepairSource = "current" | SaveSlotId;
export const REPAIR_MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const REPAIR_MAX_RESPONSE_BYTES = 64 * 1024;
export const REPAIR_TIMEOUT_MS = 30_000;
export const REPAIR_ISSUES = {
  "missing-field": "缺少必要欄位；本階段不補值。",
  "invalid-field": "欄位型別或值域不合法；不屬於允許的同步更正。",
  "unsupported-version": "本階段只分析完整的 Phase 26 v2／Save v2 原始資料。",
  "identity-conflict": "角色識別或對應不唯一，無法確認證據來源。",
  "invalid-resource": "長期角色資源或生命狀態不合法，不能用作同步證據。",
  "other-invalid": "更正兩個允許欄位後，整筆仍未通過既有格式、資源或引用驗證。",
  "normalization-required": "驗證需要補值或改動其他欄位；本階段不產生這類候選。",
  "too-large": "完整來源或候選超過本階段單項 10 MiB 的分析上限，沒有截斷分析。",
  unavailable: "目前無法讀取這項來源，不能據此判定資料損壞。",
  missing: "目前資料不存在；本階段不建立新狀態。",
} as const;
export type RepairIssueCode = keyof typeof REPAIR_ISSUES;
export interface RepairIssue { readonly code: RepairIssueCode; readonly path: string }
export interface RepairChange {
  readonly rule: "sync-activity" | "sync-player-mp";
  readonly path: "activity" | "character.currentMp";
  readonly before: number | "in-combat" | "outside-combat";
  readonly after: number | "in-combat" | "outside-combat";
  readonly evidence: { readonly path: string; readonly value: number | boolean };
}
export interface RepairResult {
  readonly source: RepairSource;
  readonly capturedAt: string;
  readonly status: "candidate" | "unchanged" | "blocked" | "missing" | "empty" | "unavailable";
  readonly fingerprint: string | null;
  readonly candidateFingerprint: string | null;
  readonly revision: number | null;
  readonly formatVersion: number | null;
  readonly changes: readonly RepairChange[];
  readonly issues: readonly RepairIssue[];
}
export interface RepairPreviewReport {
  readonly previewVersion: 1;
  readonly readOnly: true;
  readonly storage: "memory" | "postgres";
  readonly results: readonly RepairResult[];
}
export const REPAIR_STATUS_LABELS: Record<RepairResult["status"], string> = {
  candidate: "有效候選，尚未套用", unchanged: "無需修復", blocked: "受阻，沒有候選",
  missing: "目前資料不存在", empty: "空槽", unavailable: "目前無法讀取",
};
function record(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function exact(v: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
}
const integer = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const hash = (v: unknown) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const path = (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 160 && /^[A-Za-z0-9_.\[\]]+$/.test(v);
const date = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)
  && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
export function isRepairPreviewReport(value: unknown): value is RepairPreviewReport {
  if (!record(value) || !exact(value, ["previewVersion", "readOnly", "storage", "results"])
    || value.previewVersion !== 1 || value.readOnly !== true || (value.storage !== "memory" && value.storage !== "postgres")
    || !Array.isArray(value.results) || value.results.length !== 4) return false;
  return value.results.every((v: unknown, index: number) => {
    if (!record(v) || !exact(v, ["source", "capturedAt", "status", "fingerprint", "candidateFingerprint", "revision", "formatVersion", "changes", "issues"])
      || v.source !== REPAIR_SOURCES[index] || !date(v.capturedAt)
      || typeof v.status !== "string" || !Object.hasOwn(REPAIR_STATUS_LABELS, v.status)
      || !(v.fingerprint === null || hash(v.fingerprint)) || !(v.candidateFingerprint === null || hash(v.candidateFingerprint))
      || !(v.revision === null || integer(v.revision)) || !(v.formatVersion === null || integer(v.formatVersion) && v.formatVersion >= 1)
      || !Array.isArray(v.changes) || v.changes.length > 2 || !Array.isArray(v.issues) || v.issues.length > 4) return false;
    const seen = new Set<string>();
    for (const c of v.changes) {
      if (!record(c) || !exact(c, ["rule", "path", "before", "after", "evidence"]) || !record(c.evidence)
        || !exact(c.evidence, ["path", "value"]) || !path(c.evidence.path) || c.before === c.after || seen.has(String(c.rule))) return false;
      seen.add(String(c.rule));
      if (c.rule === "sync-activity") {
        if (c.path !== "activity" || typeof c.before !== "string" || typeof c.after !== "string"
          || !["in-combat", "outside-combat"].includes(c.before)
          || !["in-combat", "outside-combat"].includes(c.after) || c.evidence.path !== "combat.present"
          || typeof c.evidence.value !== "boolean" || c.after !== (c.evidence.value ? "in-combat" : "outside-combat")) return false;
      } else if (c.rule === "sync-player-mp") {
        if (c.path !== "character.currentMp" || !integer(c.before) || !integer(c.after)
          || c.evidence.value !== c.after || !/^phase26\.characters\[\d+\]\.currentMp$/.test(String(c.evidence.path))) return false;
      } else return false;
    }
    if (!v.issues.every((i: unknown) => record(i) && exact(i, ["code", "path"])
      && typeof i.code === "string" && Object.hasOwn(REPAIR_ISSUES, i.code) && path(i.path))) return false;
    if (v.status === "candidate") return hash(v.fingerprint) && hash(v.candidateFingerprint) && v.changes.length > 0 && v.issues.length === 0 && v.formatVersion === 2 && integer(v.revision);
    if (v.changes.length !== 0 || v.candidateFingerprint !== null) return false;
    if (v.status === "unchanged") return hash(v.fingerprint) && v.issues.length === 0 && v.formatVersion === 2 && integer(v.revision);
    if (v.status === "empty") return v.source !== "current" && v.fingerprint === null && v.issues.length === 0 && v.revision === null && v.formatVersion === null;
    if (v.status === "missing" && v.source !== "current") return false;
    return v.issues.length > 0;
  });
}
