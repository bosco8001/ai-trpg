import { useEffect, useRef, useState } from "react";
import { APPLICATION_MESSAGES, type RepairApplication } from "../shared/repair-application.js";
import type { RepairPreparationSummary } from "../shared/repair-preparation.js";
import { REPAIR_TIMEOUT_MS } from "../shared/repair-preview.js";
import { applyRepair, lookupApplication, loadRepairReport } from "./repair-application.js";
import { PreparationClientFailure } from "./repair-preparation.js";
import { invalidateRepairSource } from "./repair-preview.js";
import { downloadRawBackup } from "./raw-data-backup.js";
import { Button } from "./ui/Button.js";

const attemptKey = (id: string) => `ai-trpg.repair-application.${id}`;
function attempted(id: string) { try { return localStorage.getItem(attemptKey(id)) === "started"; } catch { return false; } }
export function RepairApplicationPanel({ record, initial, stale, onApplied }: {
  record: RepairPreparationSummary; initial: RepairApplication | null; stale: boolean; onApplied?: () => Promise<unknown>;
}) {
  const [state, setState] = useState(initial), [busy, setBusy] = useState(false), [confirming, setConfirming] = useState(false);
  const [sent, setSent] = useState(() => attempted(record.repairId)), [message, setMessage] = useState("");
  const request = useRef<AbortController | null>(null), live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; request.current?.abort(); }; }, []);
  useEffect(() => { setState(initial); setConfirming(false); }, [initial]);
  async function run<T>(work: (signal: AbortSignal) => Promise<T>, success: (value: T) => void) {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setMessage("");
    const timer = setTimeout(() => controller.abort(), REPAIR_TIMEOUT_MS);
    try {
      const value = await work(controller.signal);
      if (live.current && request.current === controller && !controller.signal.aborted) success(value);
    } catch (failure) {
      if (live.current && request.current === controller) setMessage(failure instanceof PreparationClientFailure ? failure.message : APPLICATION_MESSAGES.unavailable);
    } finally {
      clearTimeout(timer);
      if (live.current && request.current === controller) { request.current = null; setBusy(false); }
    }
  }
  function receive(next: RepairApplication) {
    setState(next); setConfirming(false);
    if (next.status === "applied") {
      invalidateRepairSource(record.source);
      setMessage("這次修復已套用，報告已保存。");
      if (record.source === "current" && onApplied) void onApplied().catch(() => {
        if (live.current) setMessage("修復已完成且報告已保存；目前畫面讀取失敗，請手動重新讀取遊戲。");
      });
    }
  }
  const eligible = state?.canApply === true && !stale && record.sameRuntime && !sent;
  return <section className="repair-application" aria-busy={busy}>
    <h4>修復套用與報告</h4>
    <p role="status" aria-live="polite" aria-atomic="true">{message}</p>
    {!state ? <p>目前未取得可確認的套用資格或結果，請手動查詢。</p> : state.status === "applied" ? <>
      <p><strong>確定已套用。</strong>結果時間：{state.report?.completedAt}。</p>
      {record.source === "current" ? <p>狀態版本：{state.report?.effects.revisionBefore} → {state.report?.effects.revisionAfter}；未完成的舊 AI 回覆不再保存或顯示。</p>
        : <p>原保存時間與來源版本保留；目前遊戲沒有被載入或替換。</p>}
    </> : state.status === "rejected" ? <p><strong>確定未套用。</strong>{state.report?.reason ? APPLICATION_MESSAGES[state.report.reason] : ""}請手動重新預覽並使用新識別碼準備。</p>
      : state.status === "unknown" || sent ? <p><strong>結果尚未確認。</strong>本次識別碼不再套用，請手動查詢。若一直無法確認，可手動重新預覽並以新識別碼準備；舊請求不會自動重做。</p>
        : state.status === "ineligible" ? <p>這份歷史備份沒有有效套用資格，仍可下載原稿；請重新預覽及準備。</p>
          : <p>備份與套用資格已保存，尚未套用。{stale ? "來源已知過期，請重新預覽。" : "寫入前還會重新核對完整來源。"}</p>}
    {eligible && !confirming ? <Button variant="secondary" disabled={busy} onClick={() => { if (!request.current) setConfirming(true); }}>核對這份修復</Button> : null}
    {confirming ? <div className="repair-preparation__candidate">
      <p><strong>再次確認：{record.source === "current" ? "目前遊戲資料" : `存檔 ${record.source}`}。</strong>上方列出的差異會一次套用；完整原稿已備份並校驗。</p>
      <p>識別碼：<code>{record.repairId}</code>；準備時間：{record.preparedAt}。</p>
      <p>{record.source === "current" ? "成功後狀態版本加一並更換敘事 generation，已保存故事保留；未完成的舊回覆會丟棄。" : "只修改這個槽，保留原保存時間與來源版本，不會 Load。"}</p>
      <Button disabled={busy || !eligible} onClick={() => {
        if (request.current || !eligible) return;
        try { localStorage.setItem(attemptKey(record.repairId), "started"); } catch { /* Visible ID and server claim still prevent automatic retry. */ }
        setSent(true); setConfirming(false);
        setState({ applicationVersion: 1, repairId: record.repairId, status: "unknown", canApply: false, report: null, reportChecksum: null });
        void run(signal => applyRepair(record, signal), receive);
      }}>確認套用這份修復</Button>
      <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>取消確認，保留備份</Button>
    </div> : null}
    <div className="raw-backup__controls">
      <Button variant="secondary" disabled={busy} onClick={() => { void run(signal => lookupApplication(record.repairId, signal), receive); }}>查詢這次套用結果</Button>
      {state?.report ? <Button variant="secondary" disabled={busy} onClick={() => {
        const selected = state;
        if (selected) void run(signal => loadRepairReport(selected, signal), file => { downloadRawBackup(file.text, file.filename); setMessage("已發起完整報告下載，請確認下載檔案。"); });
      }}>下載這次修復報告</Button> : null}
      {busy ? <Button variant="secondary" onClick={() => {
        request.current?.abort(); request.current = null; setBusy(false); setMessage("已停止等待；這不代表撤銷套用。請保留識別碼，稍後手動查詢。");
      }}>停止等待</Button> : null}
    </div>
  </section>;
}
