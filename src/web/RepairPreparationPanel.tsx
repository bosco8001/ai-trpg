import { useEffect, useId, useRef, useState } from "react";
import type { RepairPreviewReport, RepairResult, RepairSource } from "../shared/repair-preview.js";
import { REPAIR_TIMEOUT_MS } from "../shared/repair-preview.js";
import { repairIdValid, type RepairPreparationPage, type RepairPreparationSummary } from "../shared/repair-preparation.js";
import { listPreparations, loadPreparationBackup, lookupPreparation, prepareRepair, PreparationClientFailure } from "./repair-preparation.js";
import { downloadRawBackup } from "./raw-data-backup.js";
import { Button } from "./ui/Button.js";

const pendingKey = "ai-trpg.repair-preparation-id";
const knownKey = "ai-trpg.repair-preparation-ids";
const confirmedKey = "ai-trpg.repair-preparation-confirmed-id";
function rememberedId() {
  try { const id = window.localStorage.getItem(pendingKey); return repairIdValid(id) ? id : ""; } catch { return ""; }
}
function rememberedIds(): string[] {
  try {
    const text = window.localStorage.getItem(knownKey);
    const value: unknown = text && text.length <= 64 * 1024 ? JSON.parse(text) : [];
    return Array.isArray(value) ? [...new Set(value.filter(repairIdValid))] : [];
  } catch { return []; }
}
function rememberedUncertain() {
  try { const id = rememberedId(); return !!id && window.localStorage.getItem(confirmedKey) !== id; } catch { return false; }
}
function rememberId(id: string) { try { window.localStorage.setItem(pendingKey, id); } catch { /* Visible ID remains available when browser storage is disabled. */ } }
function confirmId(id: string) { try { window.localStorage.setItem(confirmedKey, id); } catch { /* No automatic resubmission. */ } }
const sourceName = (source: RepairSource) => source === "current" ? "目前遊戲資料" : `存檔 ${source}`;
const valueName = (value: number | string) => value === "in-combat" ? "戰鬥中" : value === "outside-combat" ? "戰鬥外" : String(value);

export function RepairPreparationSummaryView({ record, stale = false }: { record: RepairPreparationSummary; stale?: boolean }) {
  return <>
    <h4>{sourceName(record.source)}：備份就緒，尚未套用</h4>
    <p>修復識別碼：<code>{record.repairId}</code></p>
    <p>擷取時間：{new Date(record.capturedAt).toLocaleString("zh-Hant", { hour12: false })}；備份只代表這個時刻。</p>
    {record.changes.map(change => <p key={change.path}><code>{change.path}</code>：{valueName(change.before)} → {valueName(change.after)}（建議，尚未套用）。</p>)}
    {stale ? <p>來源已有變動或候選已過期；備份仍保留，未來套用必須重新核對。</p> : null}
    {!record.sameRuntime ? <p>這是舊 Memory 程序的備份，只供查詢與下載；未來須重新預覽及準備。</p> : null}
    <p>完整備份：{record.backupBytes.toLocaleString("zh-Hant")} bytes。原稿包含已保存故事，請妥善保管下載檔案。</p>
  </>;
}
export function RepairPreparationPanel({ report, stale }: { report: RepairPreviewReport | null; stale: readonly RepairSource[] }) {
  const id = useId(), live = useRef(true), request = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [feedback, setFeedback] = useState(""), [error, setError] = useState("");
  const [repairId, setRepairId] = useState(rememberedId), [uncertain, setUncertain] = useState(rememberedUncertain);
  const [knownIds, setKnownIds] = useState(rememberedIds);
  const [record, setRecord] = useState<RepairPreparationSummary | null>(null), [page, setPage] = useState<RepairPreparationPage | null>(null);
  useEffect(() => { live.current = true; return () => { live.current = false; request.current?.abort(); request.current = null; }; }, []);
  function cancel() {
    request.current?.abort(); request.current = null; setBusy(false); setError("");
    setFeedback("已停止等待；保存可能已完成，請保留識別碼並手動查詢。已保存備份不會被刪除。");
  }
  async function run<T>(message: string, work: (signal: AbortSignal) => Promise<T>, success: (value: T) => void) {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(""); setFeedback(message);
    let timedOut = false;
    const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, REPAIR_TIMEOUT_MS);
    try {
      const value = await work(controller.signal);
      if (!live.current || request.current !== controller || controller.signal.aborted) return;
      success(value);
    } catch (failure) {
      if (!live.current || request.current !== controller) return;
      setFeedback(""); setError(timedOut ? "等待超過 30 秒。請保留識別碼並手動查詢，不會自動重送。"
        : failure instanceof PreparationClientFailure ? failure.message : "目前無法確認結果，請保留識別碼並手動查詢。");
    } finally {
      window.clearTimeout(timer);
      if (live.current && request.current === controller) { request.current = null; setBusy(false); }
    }
  }
  function prepare(result: RepairResult) {
    if (request.current || uncertain || !report || stale.includes(result.source) || result.status !== "candidate" || !result.fingerprint || !result.candidateFingerprint) return;
    const newId = crypto.randomUUID(); rememberId(newId); setRepairId(newId); setUncertain(true); setRecord(null);
    setKnownIds(old => {
      const ids = old.includes(newId) ? old : [newId, ...old];
      try { window.localStorage.setItem(knownKey, JSON.stringify(ids)); } catch { /* Keep visible IDs in this page. */ }
      return ids;
    });
    void run("正在保存並驗證完整原稿，你可以繼續遊戲……", signal => prepareRepair({ repairId: newId, source: result.source,
      storage: report.storage, previewVersion: 1, rulesVersion: 1, fingerprint: result.fingerprint!, candidateFingerprint: result.candidateFingerprint! }, signal), next => {
      setRecord(next); setUncertain(false); confirmId(newId); setFeedback("備份就緒，尚未套用。遊戲資料沒有被修復或改寫。");
    });
  }
  function lookup() {
    if (request.current || !repairIdValid(repairId)) return;
    const selectedId = repairId; rememberId(selectedId);
    void run("正在查詢本次備份紀錄……", signal => lookupPreparation(selectedId, signal), next => {
      setRecord(next); setUncertain(false); confirmId(selectedId); setFeedback("已確認備份就緒，尚未套用。");
    });
  }
  function list(cursor: string | null) {
    void run("正在讀取備份紀錄……", signal => listPreparations(cursor, signal), next => {
      setPage(next); setFeedback(next.records.length ? "已讀取備份紀錄，依識別碼分頁排列。" : "目前沒有可確認的備份紀錄。");
    });
  }
  function download(selected: RepairPreparationSummary) {
    void run("正在讀取並校驗完整備份……", signal => loadPreparationBackup(selected, signal), next => {
      downloadRawBackup(next.text, next.filename); setFeedback("已發起下載，請確認下載檔案。尚未套用任何修復。");
    });
  }
  function isStale(selected: RepairPreparationSummary) {
    const preview = report?.results.find(r => r.source === selected.source);
    return stale.includes(selected.source) || !!preview && preview.fingerprint !== selected.fingerprint;
  }
  return <section className="repair-preparation">
    <Button variant="secondary" aria-expanded={open} aria-controls={id} onClick={() => {
      if (open) { cancel(); setOpen(false); } else setOpen(true);
    }}>{open ? "收起修復前備份與紀錄" : "修復前備份與紀錄"}</Button>
    {open ? <div id={id} className="data-health__report" aria-busy={busy}>
      <h3>修復前備份與紀錄</h3>
      <p>先從有效候選保存一份完整原稿。備份全部保留；本階段只有查詢與下載，尚未開放套用。</p>
      <p role="status" aria-live="polite" aria-atomic="true">{feedback}</p>
      {error ? <p role="alert">{error}</p> : null}
      {report?.results.filter(r => r.status === "candidate").map(result => <div key={result.source} className="repair-preparation__candidate">
        <p>{sourceName(result.source)}：{stale.includes(result.source) ? "候選已過期，請重新預覽" : "有效候選，尚未套用"}。</p>
        <Button variant="secondary" aria-disabled={busy || uncertain || stale.includes(result.source)} onClick={() => prepare(result)}>保存{sourceName(result.source)}的修復前備份</Button>
      </div>)}
      {!report ? <p>要建立備份，請先取得有效修復候選；查詢與下載不需要遊戲資料成功載入。</p> : null}
      {uncertain ? <p>前一次結果尚未確認。請先查詢識別碼；停止等待不等於撤銷保存。</p> : null}
      {knownIds.length ? <details><summary>本瀏覽器記錄的修復識別碼</summary>
        <p>只保存識別碼；完整備份由伺服器保留。瀏覽器停用儲存時，請自行記下識別碼。</p>
        <ul>{knownIds.map(known => <li key={known}><Button variant="secondary" aria-disabled={busy} onClick={() => {
          if (request.current) return; setRepairId(known); setRecord(null);
        }}>選取 {known}</Button></li>)}</ul>
      </details> : null}
      <label htmlFor={`${id}-lookup`}>修復識別碼</label>
      <input id={`${id}-lookup`} className="repair-preparation__id" value={repairId} readOnly={busy} maxLength={36} autoComplete="off" spellCheck={false}
        onChange={event => { setRepairId(event.target.value); setRecord(null); }} />
      <div className="raw-backup__controls">
        <Button variant="secondary" aria-disabled={busy || !repairIdValid(repairId)} onClick={lookup}>查詢這次結果</Button>
        <Button variant="secondary" aria-disabled={busy} onClick={() => { if (!request.current) list(null); }}>讀取備份紀錄</Button>
        <Button variant="secondary" aria-disabled={!busy} onClick={() => { if (request.current) cancel(); }}>停止等待</Button>
        {uncertain ? <Button variant="secondary" aria-disabled={busy} onClick={() => {
          if (request.current) return; setUncertain(false);
          setFeedback("已結束本次等待，識別碼仍保留，可稍後查詢。這不代表保存已撤銷；建立另一份備份須再次手動觸發。");
        }}>保留識別碼，結束本次等待</Button> : null}
      </div>
      {record ? <article className="data-health__item"><RepairPreparationSummaryView record={record} stale={isStale(record)} />
        <Button variant="secondary" aria-disabled={busy} onClick={() => download(record)}>下載這份完整備份</Button></article> : null}
      {page ? <>
        <ul className="data-health__results">{page.records.map(item => <li key={item.repairId} className="data-health__item">
          <RepairPreparationSummaryView record={item} stale={isStale(item)} />
          <Button variant="secondary" aria-disabled={busy} onClick={() => download(item)}>下載這份完整備份</Button>
        </li>)}</ul>
        {page.nextCursor ? <Button variant="secondary" aria-disabled={busy} onClick={() => { if (!request.current) list(page.nextCursor); }}>下一頁備份紀錄</Button> : null}
      </> : null}
    </div> : null}
  </section>;
}
