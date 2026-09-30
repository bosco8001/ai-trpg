import { acceptState, acceptHistory } from "./state-sync.js";
import { RuntimeSystemPanel } from "./RuntimeSystemPanel.js";
import { useEffect, useState } from "react";
import { checkApiHealth, loadAuthoritativeGameState } from "./api.js";
import { CombatPage } from "./CombatPage.js";
import { ExplorationPage, type ConnectionState } from "./ExplorationPage.js";
import type { AuthoritativeGameStateResponse } from "../shared/game-state.js";
import { Button } from "./ui/Button.js";
import { Panel } from "./ui/Panel.js";

const CONNECTION_TIMEOUT_MS = 5000;

export function App() {
  const [presentation,setPresentation]=useState<{text:string|null;warning:string;generation:string;revision:number}|null>(null);
  const [menu,setMenu]=useState(false);
  const [state, setState] = useState<ConnectionState>("checking");
  const [attempt, setAttempt] = useState(0);
  const [authoritativeState, setAuthoritativeState] = useState<AuthoritativeGameStateResponse | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);
  const acceptAuthoritativeState = (next: AuthoritativeGameStateResponse) => {
    setAuthoritativeState(current=>acceptState(current,next));
  };

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

  useEffect(() => {
    let disposed = false;
    void loadAuthoritativeGameState().then((next) => {
      if (disposed) return;
      acceptAuthoritativeState(next);
      setStateError(null);
    }).catch(() => {
      if (!disposed) setStateError("目前無法讀取遊戲狀態。");
    });
    return () => { disposed = true; };
  }, [attempt]);

  async function retryAuthoritativeState(): Promise<AuthoritativeGameStateResponse> {
    const next = await loadAuthoritativeGameState();
    acceptAuthoritativeState(next);
    setStateError(null);
    return next;
  }

  const retryAll = () => {
    setState("checking");
    setAttempt((value) => value + 1);
  };

  const inCombat = authoritativeState?.state.activity === "in-combat";

  return (
    <>
      <a className="skip-link" href="#main-content">{inCombat ? "跳至戰鬥畫面" : "跳至故事紀錄"}</a>
      {menu && authoritativeState ? <main id="main-content" className="site-shell" tabIndex={-1}><h1>主選單</h1><Button onClick={()=>{void retryAuthoritativeState().then(()=>setMenu(false)).catch(()=>setStateError("目前無法讀取遊戲狀態。"));}}>返回目前遊戲</Button><RuntimeSystemPanel state={authoritativeState} onStateUpdate={next=>{acceptAuthoritativeState(next);setMenu(false);}} onRetryState={retryAuthoritativeState}/></main> : authoritativeState && inCombat ? (
        <CombatPage
          key={`${authoritativeState.state.phase26?.runtimeGeneration}:${authoritativeState.state.combat?.lifecycle?.combatId}`}
          gameState={authoritativeState}
          onMainMenu={()=>setMenu(true)}
          onPresentation={(text,warning,generation,revision)=>setPresentation({text,warning,generation,revision})}
          onHistoryEntry={(entry,generation)=>setAuthoritativeState(current=>acceptHistory(current,generation,entry))}
          stateError={stateError}
          onStateUpdate={acceptAuthoritativeState}
          onRetryState={retryAuthoritativeState}
        />
      ) : authoritativeState ? (
        <ExplorationPage onHistoryEntry={(entry,generation)=>setAuthoritativeState(current=>acceptHistory(current,generation,entry))} key={authoritativeState.state.phase26?.runtimeGeneration} authoritativeState={authoritativeState} presentation={presentation?.generation === authoritativeState.state.phase26?.runtimeGeneration && presentation?.revision === authoritativeState.state.revision ? presentation : null} onStateUpdate={acceptAuthoritativeState} onRetryState={retryAuthoritativeState} connectionState={state} onRetryConnection={retryAll} />
      ) : (
        <main id="main-content" className="site-shell" tabIndex={-1}>
          <div className="site-shell__inner">
            <section className="site-shell__intro">
              <p className="site-shell__eyebrow">權威狀態</p>
              <h1>AI TRPG</h1>
              <p className="site-shell__lede">正在確認目前是探索或戰鬥狀態……</p>
            </section>
            <Panel className="connection-panel" aria-labelledby="application-state-heading">
              <p className="connection-panel__eyebrow">狀態讀取</p>
              <h2 id="application-state-heading">{stateError ? "目前無法讀取遊戲狀態" : "正在讀取遊戲狀態……"}</h2>
              <p className="connection-panel__hint" role={stateError ? "alert" : "status"}>{stateError ?? "畫面會依權威狀態切換探索或戰鬥。"}</p>
              <Button loading={!stateError} loadingLabel="正在讀取……" disabled={!stateError} onClick={retryAll}>重新嘗試</Button>
            </Panel>
          </div>
        </main>
      )}
    </>
  );
}
