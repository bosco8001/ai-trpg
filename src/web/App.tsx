import { useEffect, useState } from "react";
import { checkApiHealth } from "./api.js";
import { Button } from "./ui/Button.js";
import { Panel } from "./ui/Panel.js";

type ConnectionState = "checking" | "connected" | "unavailable";
const CONNECTION_TIMEOUT_MS = 5000;
const messages: Record<ConnectionState, string> = {
  checking: "正在檢查連線……",
  connected: "已連線。",
  unavailable: "目前無法連線，請稍後重試。",
};
const labels: Record<ConnectionState, string> = {
  checking: "檢查中",
  connected: "連線正常",
  unavailable: "連線失敗",
};
const hints: Record<ConnectionState, string> = {
  checking: "正在等待服務回應。",
  connected: "服務目前正常回應。",
  unavailable: "請確認後端已啟動，然後重新檢查。",
};

export function App() {
  const [state, setState] = useState<ConnectionState>("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), CONNECTION_TIMEOUT_MS);

    void checkApiHealth(controller.signal)
      .then(() => { if (!disposed) setState("connected"); })
      .catch(() => { if (!disposed) setState("unavailable"); })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);

  return (
    <main className="site-shell">
      <div className="site-shell__inner">
        <header className="site-shell__intro">
          <p className="site-shell__eyebrow">旅程入口</p>
          <h1>AI TRPG</h1>
          <p className="site-shell__lede reading-copy">在旅程開始前，先確認服務連線。</p>
        </header>

        <Panel className="connection-panel" aria-labelledby="connection-heading">
          <p className="connection-panel__eyebrow">服務狀態</p>
          <h2 id="connection-heading">連線檢查</h2>
          <div className="connection-status" data-state={state} role="status" aria-live="polite" aria-atomic="true">
            <span className="connection-status__marker" aria-hidden="true" />
            <div className="connection-status__content">
              <strong>{labels[state]}</strong>
              <p>{messages[state]}</p>
            </div>
          </div>
          <p className="connection-panel__hint">{hints[state]}</p>
          <Button
            loading={state === "checking"}
            loadingLabel="檢查中……"
            onClick={() => {
              setState("checking");
              setAttempt((value) => value + 1);
            }}
          >
            重新檢查連線
          </Button>
        </Panel>
      </div>
    </main>
  );
}
