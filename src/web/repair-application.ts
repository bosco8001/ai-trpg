import { APPLICATION_MESSAGES, REPAIR_REPORT_MAX_BYTES, isRepairApplication, parseRepairReport,
  type RepairApplyRequest, type RepairApplication } from "../shared/repair-application.js";
import { REPAIR_MAX_RESPONSE_BYTES } from "../shared/repair-preview.js";
import { PreparationClientFailure, receive } from "./repair-preparation.js";
import type { RepairPreparationSummary } from "../shared/repair-preparation.js";

async function requestText(id: string, signal: AbortSignal, fetcher: typeof fetch,
  request?: RepairApplyRequest, download = false) {
  signal.throwIfAborted();
  const response = await fetcher(`/api/repair-applications/${encodeURIComponent(id)}${download ? "/report" : ""}`, {
    method: request ? "POST" : "GET", cache: "no-store", signal,
    ...(request ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) } : {}) });
  if (!response.ok) {
    const failure: unknown = JSON.parse(await receive(response, signal, REPAIR_MAX_RESPONSE_BYTES));
    if (failure && typeof failure === "object" && "code" in failure && typeof failure.code === "string" && Object.hasOwn(APPLICATION_MESSAGES, failure.code))
      throw new PreparationClientFailure(APPLICATION_MESSAGES[failure.code as keyof typeof APPLICATION_MESSAGES], failure.code);
    throw new PreparationClientFailure(APPLICATION_MESSAGES.unavailable);
  }
  if (download && response.headers.get("X-Repair-Report-Max-Bytes") !== String(REPAIR_REPORT_MAX_BYTES)) {
    await response.body?.cancel(); throw new PreparationClientFailure("報告大小契約不正確，未發起下載。");
  }
  return receive(response, signal, download ? REPAIR_REPORT_MAX_BYTES : REPAIR_MAX_RESPONSE_BYTES);
}
export async function lookupApplication(id: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<RepairApplication> {
  const state: unknown = JSON.parse(await requestText(id, signal, fetcher));
  if (!isRepairApplication(state) || state.repairId !== id) throw new PreparationClientFailure("修復結果格式或識別碼不符。");
  signal.throwIfAborted(); return state;
}
export async function applyRepair(record: RepairPreparationSummary, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const request: RepairApplyRequest = { repairId: record.repairId, source: record.source, storage: record.storage,
    previewVersion: record.previewVersion, rulesVersion: record.rulesVersion, fingerprint: record.fingerprint,
    candidateFingerprint: record.candidateFingerprint, confirm: true };
  const state: unknown = JSON.parse(await requestText(record.repairId, signal, fetcher, request));
  if (!isRepairApplication(state) || state.repairId !== record.repairId
    || state.report && (state.report.preparation.backupChecksum !== record.backupChecksum
      || state.report.preparation.characterId !== record.characterId || state.report.preparation.source !== record.source
      || state.report.preparation.storage !== record.storage)) throw new PreparationClientFailure("結果不符合本次修復，請保留識別碼並手動查詢。");
  signal.throwIfAborted(); return state;
}
const digest = async (text: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map(b => b.toString(16).padStart(2, "0")).join("");
export async function loadRepairReport(expected: RepairApplication, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  if (!expected.report || !expected.reportChecksum) throw new PreparationClientFailure("尚未有可確認的完成報告。");
  const text = await requestText(expected.repairId, signal, fetcher, undefined, true), parsed = parseRepairReport(text);
  if (parsed.report.preparation.repairId !== expected.repairId || parsed.checksum !== expected.reportChecksum
    || await digest(parsed.payload) !== parsed.checksum || JSON.stringify(parsed.report) !== JSON.stringify(expected.report))
    throw new PreparationClientFailure("報告校驗或範圍不符，未發起下載。");
  signal.throwIfAborted(); return { text, filename: `ai-trpg-repair-report-${expected.repairId}.json` };
}
