import { useEffect, useRef, useState } from "react";
import { RAW_BACKUP_TIMEOUT_MS } from "../shared/raw-data-backup.js";
import { downloadRawBackup, loadRawBackup, RawBackupClientFailure } from "./raw-data-backup.js";
import { Button } from "./ui/Button.js";

export function RawDataBackupPanel() {
  const request = useRef<AbortController | null>(null), live = useRef(true);
  const [busy, setBusy] = useState(false), [feedback, setFeedback] = useState(""), [error, setError] = useState("");
  useEffect(() => {
    live.current = true;
    return () => { live.current = false; request.current?.abort(); request.current = null; };
  }, []);
  async function run() {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(""); setFeedback("正在準備完整備份，你可以繼續遊戲……");
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, RAW_BACKUP_TIMEOUT_MS);
    try {
      const result = await loadRawBackup(controller.signal);
      if (!live.current || controller.signal.aborted || request.current !== controller) return;
      downloadRawBackup(result.text, result.filename);
      setFeedback(`已發起下載，請確認下載檔案。擷取時間：${new Date(result.payload.capturedAt).toLocaleString("zh-Hant", { hour12: false })}。`);
    } catch (failure) {
      if (!live.current || request.current !== controller) return;
      setFeedback("");
      setError(timedOut ? "備份等待超過 30 秒，沒有下載檔案。請手動重試。"
        : failure instanceof RawBackupClientFailure ? failure.message : "目前無法完整取得備份，沒有下載檔案。請確認服務後手動重試。");
    } finally {
      window.clearTimeout(timeout);
      if (live.current && request.current === controller) { request.current = null; setBusy(false); }
    }
  }
  return <section className="raw-backup" aria-label="原始資料備份">
    <p>下載目前資料與三個存檔槽的完整原稿，包含已保存的故事。備份不會更改遊戲，也不會送給 AI。</p>
    <p>取得完整檔案後才發起下載；這份備份供後續檢查，不能直接用一般載入存檔功能還原。</p>
    <div className="raw-backup__controls">
      <Button variant="secondary" aria-disabled={busy} onClick={() => void run()}>下載原始資料備份</Button>
      <Button variant="secondary" aria-disabled={!busy} onClick={() => {
        if (!request.current) return;
        request.current?.abort(); request.current = null; setBusy(false); setError(""); setFeedback("已取消備份下載。");
      }}>取消備份下載</Button>
    </div>
    <p role="status" aria-live="polite" aria-atomic="true">{feedback}</p>
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
