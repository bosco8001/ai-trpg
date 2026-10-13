// 工具錯誤優先序；不模擬頁面、CSS、焦點或閱讀狀態。
const failureReports = new WeakMap();
export function probeErrorDetails(error) {
  return { name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error) };
}

/** 原錯誤可以是 frozen Error；另存診斷，不改它的 cause／stack／識別。 */
export function probeFailureReport(error) {
  return error !== null && (typeof error === "object" || typeof error === "function")
    ? failureReports.get(error) ?? null : null;
}

/** failure 用包裝物件區分「沒有錯誤」與 throw undefined；不包裝原錯誤。 */
export async function saveProbeEvidence(report, onEvidence, failure = null) {
  report.secondaryErrors ??= [];
  try { await onEvidence(report); }
  catch (error) {
    report.secondaryErrors.push({ stage: "evidence-save", ...probeErrorDetails(error) });
    report.productVerdict = report.verdict;
    report.verdict = "BLOCKED";
    report.evidenceSaveCompleted = false;
    if (!failure) report.error = probeErrorDetails(error);
    failure ??= { error };
  }
  if (failure) {
    const error = failure.error;
    if (error !== null && (typeof error === "object" || typeof error === "function"))
      failureReports.set(error, report);
    throw error;
  }
}
