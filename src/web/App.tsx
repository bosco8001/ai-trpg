import { useEffect, useState } from "react";
import { checkApiHealth } from "./api.js";
import { ExplorationPage, type ConnectionState } from "./ExplorationPage.js";

const CONNECTION_TIMEOUT_MS = 5000;

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
    <>
      <a className="skip-link" href="#main-content">跳至故事紀錄</a>
      <ExplorationPage
        connectionState={state}
        onRetryConnection={() => {
          setState("checking");
          setAttempt((value) => value + 1);
        }}
      />
    </>
  );
}
