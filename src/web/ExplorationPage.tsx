import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/Button.js";
import { Panel } from "./ui/Panel.js";
import {
  initialNarrativeEntries,
  isSubmittableAction,
  shouldSubmitOnEnter,
  submitLocalExplorationAction,
  type NarrativeEntry,
} from "./exploration.js";

export type ConnectionState = "checking" | "connected" | "unavailable";

const connectionLabels: Record<ConnectionState, string> = {
  checking: "正在確認服務連線",
  connected: "服務已連線",
  unavailable: "服務目前無法連線",
};

function NarrativeHistory({ entries }: { entries: readonly NarrativeEntry[] }) {
  return (
    <ol className="narrative-history" aria-label="探索紀錄">
      {entries.map((entry) => (
        <li key={entry.id} className="narrative-entry" data-source={entry.source}>
          <p className="narrative-entry__label">{entry.label}</p>
          <p className="narrative-entry__text reading-copy">{entry.text}</p>
        </li>
      ))}
    </ol>
  );
}

export function ExplorationPage({
  connectionState,
  onRetryConnection,
}: {
  connectionState: ConnectionState;
  onRetryConnection?: () => void;
}) {
  const [entries, setEntries] = useState<readonly NarrativeEntry[]>(initialNarrativeEntries);
  const [action, setAction] = useState("");
  const [feedback, setFeedback] = useState("介面測試模式：輸入只會暫存在這個頁面。 ");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);
  const submittedCount = entries.length - initialNarrativeEntries.length;

  useEffect(() => {
    if (submittedCount > 0) {
      historyEndRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [submittedCount]);

  function submitAction() {
    if (!isSubmittableAction(action)) return;
    const next = submitLocalExplorationAction(entries, action);
    setEntries(next.entries);
    setAction(next.input);
    setFeedback(next.feedback ?? feedback);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <main id="main-content" className="exploration-shell" tabIndex={-1}>
      <div className="exploration-shell__inner">
        <header className="exploration-header">
          <div>
            <p className="exploration-header__eyebrow">探索</p>
            <h1>AI TRPG</h1>
            <p className="exploration-header__lede reading-copy">文字探索介面</p>
          </div>
          <div className="connection-brief" data-state={connectionState}>
            <p role="status" aria-live="polite">
              <span aria-hidden="true" className="connection-brief__marker" />
              {connectionLabels[connectionState]}
            </p>
            {onRetryConnection ? (
              <Button
                className="connection-brief__retry"
                variant="secondary"
                loading={connectionState === "checking"}
                loadingLabel="確認中……"
                onClick={onRetryConnection}
              >
                重新檢查
              </Button>
            ) : null}
          </div>
        </header>

        <Panel className="exploration-panel" aria-labelledby="history-heading">
          <div className="exploration-panel__heading">
            <div>
              <p className="exploration-panel__eyebrow">故事紀錄</p>
              <h2 id="history-heading">旅程尚待書寫</h2>
            </div>
            <p className="exploration-panel__mode">本機介面測試</p>
          </div>

          <p className="exploration-panel__notice">
            這裡只記錄畫面上的文字。重新整理後紀錄會消失，尚未連接 AI、規則或保存資料。
          </p>

          <NarrativeHistory entries={entries} />
          <div ref={historyEndRef} aria-hidden="true" />

          <form
            className="action-form"
            onSubmit={(event) => {
              event.preventDefault();
              submitAction();
            }}
          >
            <label htmlFor="exploration-action">你的行動</label>
            <p id="exploration-action-help" className="action-form__hint">
              Enter 送出，Shift+Enter 換行。
            </p>
            <textarea
              ref={inputRef}
              id="exploration-action"
              name="exploration-action"
              value={action}
              rows={4}
              placeholder="描述你想做的事情……"
              aria-describedby="exploration-action-help"
              onChange={(event) => setAction(event.target.value)}
              onKeyDown={(event) => {
                if (shouldSubmitOnEnter(event.key, event.shiftKey)) {
                  event.preventDefault();
                  submitAction();
                }
              }}
            />
            <div className="action-form__footer">
              <p
                className="action-form__feedback"
                {...(submittedCount > 0 ? { role: "status", "aria-live": "polite", "aria-atomic": "true" } : {})}
              >
                {feedback}
              </p>
              <Button type="submit" disabled={!isSubmittableAction(action)}>送出行動</Button>
            </div>
          </form>
        </Panel>
      </div>
    </main>
  );
}
