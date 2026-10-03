import { useEffect, useId, useRef, useState } from "react";
import type { AuthoritativeGameStateResponse } from "../shared/game-state.js";
import { REPAIR_ISSUES, REPAIR_STATUS_LABELS, REPAIR_TIMEOUT_MS,
  type RepairPreviewReport, type RepairSource } from "../shared/repair-preview.js";
import { changedRepairSources, invalidateRepairSource, loadRepairPreview, repairEpochs, subscribeRepairChanges } from "./repair-preview.js";
import { Button } from "./ui/Button.js";
import { RepairPreparationPanel } from "./RepairPreparationPanel.js";

const display = (v: number | string) => v === "in-combat" ? "戰鬥中" : v === "outside-combat" ? "戰鬥外" : String(v);
export function RepairPreviewReportView({ report, stale = [] }: { report: RepairPreviewReport; stale?: readonly RepairSource[] }) {
  return <>
    <p>資料來源：{report.storage === "memory" ? "暫存記憶體" : "資料庫"}。四項各自擷取，不是備份，也不是同一時間的跨來源快照。</p>
    <ul className="data-health__results">
      {report.results.map(result => <li key={result.source} className="data-health__item repair-preview__item" data-status={result.status}>
        <div className="data-health__item-heading"><h4>{result.source === "current" ? "目前遊戲資料" : `存檔 ${result.source}`}</h4>
          <strong>{stale.includes(result.source) ? "結果已過期，請重新預覽" : REPAIR_STATUS_LABELS[result.status]}</strong></div>
        <p>擷取時間：{new Date(result.capturedAt).toLocaleString("zh-Hant", { hour12: false })}。只代表擷取時刻。</p>
        {stale.includes(result.source) ? <p>有資料操作或已知變動，這份舊結果不能當作目前候選。</p> : null}
        {result.revision !== null ? <p>來源狀態版本：{result.revision}；資料版本：{result.formatVersion ?? "尚未確認"}。</p> : null}
        {result.issues.map((issue, index) => <p key={index}><code>{issue.path}</code>：{REPAIR_ISSUES[issue.code]}</p>)}
        {result.status === "unchanged" ? <p>通過本階段整筆驗證，沒有兩種允許的同步差異；不保證能在目前 Run 載入。</p> : null}
        {result.status === "empty" ? <p>這個槽沒有資料，本階段不建立存檔。</p> : null}
        {result.status === "candidate" ? <>
          <p><strong>唯讀預覽，尚未套用。</strong>擷取時的完整候選已通過整筆驗證；不保證能在目前 Run 載入。</p>
          <ol className="repair-preview__changes">{result.changes.map(change => <li key={change.rule}>
            <h5>{change.rule === "sync-activity" ? "活動標記" : "玩家 MP 相容欄位"}</h5>
            <p><code>{change.path}</code></p>
            <dl><div><dt>原值</dt><dd>{display(change.before)}</dd></div><div><dt>建議值</dt><dd>{display(change.after)}</dd></div></dl>
            <p>規則：{change.rule === "sync-activity" ? "依完整、合法的 Combat 是否存在，同步活動標記；結束但尚未結算及 Game Over 仍屬戰鬥中。" : "依唯一對應且合法的長期玩家 MP 同步外層相容欄位；不改長期或 Combat 的權威 MP。"}</p>
            <p>證據欄位：<code>{change.evidence.path}</code>；值：{typeof change.evidence.value === "boolean" ? change.evidence.value ? "存在" : "不存在" : change.evidence.value}。</p>
          </li>)}</ol>
        </> : null}
        {result.fingerprint ? <details><summary>來源識別資訊（供後續核對）</summary><p>完整原始來源 SHA-256：<code>{result.fingerprint}</code></p>
          {result.candidateFingerprint ? <p>完整候選 SHA-256：<code>{result.candidateFingerprint}</code></p> : null}</details> : null}
      </li>)}
    </ul>
  </>;
}
export function RepairPreviewPanel({ currentState, onApplied }: { currentState?: AuthoritativeGameStateResponse["state"]; onApplied?: () => Promise<unknown> }) {
  const id = useId(), request = useRef<AbortController | null>(null), live = useRef(true);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [report, setReport] = useState<RepairPreviewReport | null>(null), [stale, setStale] = useState<RepairSource[]>([]);
  const [feedback, setFeedback] = useState(""), [error, setError] = useState("");
  const signature = currentState ? JSON.stringify(currentState) : null;
  const previous = useRef(signature);
  useEffect(() => {
    if (previous.current !== signature) { previous.current = signature; invalidateRepairSource("current"); }
  }, [signature]);
  useEffect(() => {
    live.current = true;
    const unsubscribe = subscribeRepairChanges(source => setStale(old => old.includes(source) ? old : [...old, source]));
    return () => { live.current = false; unsubscribe(); request.current?.abort(); request.current = null; };
  }, []);
  function cancel() {
    request.current?.abort(); request.current = null; setBusy(false); setError(""); setFeedback("已取消候選預覽。");
  }
  async function run() {
    if (request.current) return;
    const controller = new AbortController(), before = repairEpochs();
    request.current = controller;
    setBusy(true); setReport(null); setStale([]); setError(""); setFeedback("正在讀取原始資料並驗證候選，你可以繼續遊戲……");
    let timedOut = false;
    const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, REPAIR_TIMEOUT_MS);
    try {
      const next = await loadRepairPreview(controller.signal);
      if (!live.current || request.current !== controller || controller.signal.aborted) return;
      setReport(next); setStale(changedRepairSources(before));
      setFeedback("候選預覽已完成。資料沒有被修改；結果只代表各項擷取時刻。");
    } catch (failure) {
      if (!live.current || request.current !== controller) return;
      setFeedback(""); setError(timedOut ? "候選預覽等待超過 30 秒，請手動重試。"
        : "目前無法取得完整候選預覽，請確認服務後手動重試。不能據此判定資料損壞。");
    } finally {
      window.clearTimeout(timer);
      if (live.current && request.current === controller) { request.current = null; setBusy(false); }
    }
  }
  return <section className="repair-preview">
    <Button variant="secondary" aria-expanded={open} aria-controls={id} onClick={() => {
      if (open) { cancel(); setOpen(false); setReport(null); }
      else { setOpen(true); void run(); }
    }}>{open ? "收起修復候選預覽" : "修復候選預覽"}</Button>
    {open ? <div id={id} className="data-health__report" aria-busy={busy}>
      <h3>修復候選預覽</h3>
      <p>只檢查活動標記與玩家 MP 相容欄位；不補缺值、不更改權威資源、不寫入資料，也不送給 AI。</p>
      <p>結果只代表擷取時刻。其他分頁或程序的變動未必即時可見；套用時必須重新核對完整來源。</p>
      <p role="status" aria-live="polite" aria-atomic="true">{feedback}{report && stale.length ? " 有來源結果已過期，請手動重新預覽。" : ""}</p>
      {error ? <p role="alert">{error}</p> : null}
      {report ? <RepairPreviewReportView report={report} stale={stale} /> : null}
      <div className="raw-backup__controls">
        <Button variant="secondary" aria-disabled={busy} onClick={() => void run()}>重新取得候選預覽</Button>
        <Button variant="secondary" aria-disabled={!busy} onClick={() => { if (request.current) cancel(); }}>取消候選預覽</Button>
      </div>
    </div> : null}
    <RepairPreparationPanel report={open ? report : null} stale={stale} onApplied={onApplied} />
  </section>;
}
