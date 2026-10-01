import { useEffect, useId, useState } from "react";
import { DATA_DIAGNOSTIC_DESCRIPTIONS, DATA_DIAGNOSTIC_LABELS, type DataDiagnosticResult, type DataDiagnosticsReport } from "../shared/data-diagnostics.js";
import { loadDataDiagnostics } from "./api.js";
import { Button } from "./ui/Button.js";

function Result({ title, result }: { title: string; result: DataDiagnosticResult }) {
  return <li className="data-health__item" data-status={result.status}>
    <div className="data-health__item-heading"><h4>{title}</h4>
      <strong>{DATA_DIAGNOSTIC_LABELS[result.status]}</strong></div>
    <p>{DATA_DIAGNOSTIC_DESCRIPTIONS[result.status]}</p>
    {result.revision !== null || result.formatVersion !== null ? <p className="data-health__metadata">
      {result.formatVersion !== null ? <span>資料版本 {result.formatVersion}</span> : null}
      {result.revision !== null ? <span>狀態版本 {result.revision}</span> : null}
    </p> : null}
  </li>;
}

export function DataHealthReport({ report }: { report: DataDiagnosticsReport }) {
  return <>
    <p className="data-health__summary">資料來源：{report.storage === "memory" ? "暫存記憶體" : "資料庫"}。
      檢查時間：{new Date(report.checkedAt).toLocaleString("zh-Hant", { hour12: false })}。</p>
    <ul className="data-health__results">
      <Result title="目前遊戲資料" result={report.current} />
      {report.slots.map(slot => <Result key={slot.slotId} title={`存檔 ${slot.slotId}`} result={slot} />)}
    </ul>
  </>;
}

export function DataHealthPanel() {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [report, setReport] = useState<DataDiagnosticsReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    let disposed = false;
    setBusy(true);
    setReport(null);
    setError("");
    void loadDataDiagnostics(controller.signal).then(next => {
      if (!disposed) setReport(next);
    }).catch(() => {
      if (!disposed) setError("目前無法取得檢查報告，請確認服務後重新檢查。不能據此判定資料已損壞。");
    }).finally(() => {
      window.clearTimeout(timeout);
      if (!disposed) setBusy(false);
    });
    return () => { disposed = true; window.clearTimeout(timeout); controller.abort(); };
  }, [open, attempt]);
  return <section className="data-health">
    <Button variant="secondary" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      {open ? "收起資料健康檢查" : "資料健康檢查"}
    </Button>
    {open ? <div id={id} className="data-health__report" aria-busy={busy}>
      <h3>資料健康檢查</h3>
      <p>只讀取目前遊戲資料與三個存檔槽，不會更改遊戲或存檔。這份報告不會暫停其他遊戲操作，也不是備份。</p>
      <p role="status" aria-live="polite" aria-atomic="true">
        {busy ? "正在檢查資料……" : report ? "資料健康檢查已完成，以下列出目前資料與三個存檔槽的結果。" : ""}
      </p>
      {error ? <p role="alert">{error}</p> : null}
      {report ? <DataHealthReport report={report} /> : null}
      <Button variant="secondary" disabled={busy} onClick={() => setAttempt(value => value + 1)}>
        重新檢查資料
      </Button>
    </div> : null}
  </section>;
}
