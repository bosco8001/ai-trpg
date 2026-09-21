import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/Button.js";
import { Panel } from "./ui/Panel.js";
import { executeExplorationAction, loadExplorationState } from "./api.js";
import { MAX_PLAYER_TEXT_LENGTH } from "../shared/interpretation.js";
import type { ExplorationStateSummary } from "../shared/exploration-action.js";
import {
  initialNarrativeEntries,
  describeCandidate,
  describeRuling,
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
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [gameState, setGameState] = useState<ExplorationStateSummary | null>(null);
  const entryId = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);
  const submittedCount = entries.length - initialNarrativeEntries.length;

  useEffect(() => {
    let disposed = false;
    void loadExplorationState()
      .then((state) => { if (!disposed) setGameState(state); })
      .catch(() => { if (!disposed) setFeedback("暫時無法讀取權威探索狀態。"); });
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    if (submittedCount > 0) {
      historyEndRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [submittedCount]);

  function submitAction() {
    if (!isSubmittableAction(action) || isInterpreting || !gameState) return;
    const text = action.trim();
    const next = submitLocalExplorationAction(entries, text);
    setEntries(next.entries);
    setAction("");
    setFeedback(next.feedback ?? "正在取得候選解析。");
    setIsInterpreting(true);
    void executeExplorationAction(text, gameState.revision).then((response) => {
      entryId.current += 1;
      const id = entryId.current;
      setEntries((current) => [...current,
        {
          id: `interpretation-${id}`,
          source: "interpretation",
          label: "候選解析（固定測試）",
          text: describeCandidate(response.candidate),
        },
        {
          id: `ruling-${id}`,
          source: "ruling",
          label: "系統裁定（權威）",
          text: describeRuling(response.ruling),
        },
      ]);
      setGameState(response.state);
      setFeedback(response.ruling.accepted
        ? "權威狀態已更新；尚未產生故事敘述。"
        : "行動未執行；權威狀態未被這次請求修改。");
    }).catch(() => {
      entryId.current += 1;
      setEntries((current) => [...current, {
        id: `interpretation-${entryId.current}`,
        source: "system",
        label: "解析暫時不可用",
        text: "探索解析或裁定暫時不可用；你的文字仍只在本頁紀錄，沒有更新遊戲狀態。",
      }]);
      setFeedback("探索解析或裁定暫時不可用；請稍後再試。");
    }).finally(() => setIsInterpreting(false));
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
            <p className="exploration-panel__mode">權威探索測試</p>
          </div>

          <p className="exploration-panel__notice">
            候選解析會交給 deterministic 裁判；只有合法命令能更新下方權威 TEST 狀態。畫面不會產生故事敘述。
          </p>

          <section className="exploration-state" aria-labelledby="exploration-state-heading">
            <h3 id="exploration-state-heading">Phase 8 工程測試狀態</h3>
            {gameState ? (
              <dl>
                <div><dt>目前位置</dt><dd>{gameState.locationId}</dd></div>
                <div><dt>版本</dt><dd>{gameState.revision}</dd></div>
                <div><dt>最近觀察</dt><dd>{gameState.lastObservationTargetId ?? "尚無"}</dd></div>
                <div><dt>保存方式</dt><dd>{gameState.storage === "postgres" ? "PostgreSQL" : "記憶體（API 重啟即重設）"}</dd></div>
              </dl>
            ) : <p role="status">正在讀取權威探索狀態……</p>}
          </section>

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
              Enter 送出，Shift+Enter 換行。最多 {MAX_PLAYER_TEXT_LENGTH} 字；目前只有文件列出的固定測試句可解析。
            </p>
            <textarea
              ref={inputRef}
              id="exploration-action"
              name="exploration-action"
              value={action}
              rows={4}
              maxLength={MAX_PLAYER_TEXT_LENGTH}
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
              <Button type="submit" loading={isInterpreting} loadingLabel="裁定中……"
                disabled={!isSubmittableAction(action) || isInterpreting || !gameState}>送出行動</Button>
            </div>
          </form>
        </Panel>
      </div>
    </main>
  );
}
