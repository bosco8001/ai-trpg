import { useEffect, useState } from "react";
import type { AuthoritativeGameStateResponse, CombatParticipantView } from "../shared/game-state.js";
import { advanceTestCombatTurn } from "./api.js";
import { disabledCombatCommands, getTestPresentationLanes, getTurnOrderEntries, initiativeDetail } from "./combat-ui.js";
import { Button } from "./ui/Button.js";
import { Panel } from "./ui/Panel.js";

function ParticipantCard({ participant, current }: { participant: CombatParticipantView; current: boolean }) {
  return (
    <article className="combat-participant" data-side={participant.side} data-current={current || undefined}>
      <div className="combat-participant__heading">
        <p>{participant.side === "enemy" ? "TEST 敵方" : "TEST 我方"}</p>
        {current ? <span className="combat-current-badge">目前行動</span> : null}
      </div>
      <h4>{participant.displayName}</h4>
      <dl>
        <div><dt>先攻</dt><dd>{participant.initiative.total}</dd></div>
        <div><dt>骰值</dt><dd>{initiativeDetail(participant)}</dd></div>
      </dl>
    </article>
  );
}

function CombatTurnOrder({ state }: { state: NonNullable<AuthoritativeGameStateResponse["state"]["combat"]> }) {
  return (
    <ol className="combat-turn-order" aria-label="權威行動順序">
      {getTurnOrderEntries(state).map(({ participant, current }, index) => (
        <li key={participant.id} data-current={current || undefined}>
          <span className="combat-turn-order__index" aria-hidden="true">{index + 1}</span>
          <span>{participant.displayName}</span>
          {current ? <span className="combat-turn-order__current">目前行動</span> : null}
        </li>
      ))}
    </ol>
  );
}

export function CombatPage({
  gameState,
  stateError,
  onStateUpdate,
  onRetryState,
}: {
  gameState: AuthoritativeGameStateResponse;
  stateError: string | null;
  onStateUpdate: (next: AuthoritativeGameStateResponse) => void;
  onRetryState: () => Promise<AuthoritativeGameStateResponse>;
}) {
  const combat = gameState.state.combat;
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [feedback, setFeedback] = useState(stateError ?? "");

  useEffect(() => { setFeedback(stateError ?? ""); }, [stateError]);

  if (!combat) {
    return (
      <main id="main-content" className="combat-shell" tabIndex={-1}>
        <Panel className="combat-message" role="alert"><p>目前無法讀取戰鬥狀態。</p></Panel>
      </main>
    );
  }

  const currentActor = combat.participants.find((participant) => participant.id === combat.currentActorId);
  const lanes = getTestPresentationLanes(combat.participants);

  function advanceTestTurn() {
    if (!gameState.sandbox || isAdvancing) return;
    setIsAdvancing(true);
    setFeedback("正在請裁判推進 TEST 回合……");
    void advanceTestCombatTurn(gameState.state.revision).then((response) => {
      onStateUpdate({ sandbox: response.sandbox, storage: response.storage, state: response.state });
      setFeedback("TEST 回合已由權威戰鬥引擎推進。");
    }).catch(() => {
      setFeedback("目前無法推進 TEST 戰鬥回合。請重新讀取狀態後再試。");
    }).finally(() => setIsAdvancing(false));
  }

  function retryState() {
    if (isRetrying) return;
    setIsRetrying(true);
    setFeedback("正在重新讀取戰鬥狀態……");
    void onRetryState().then((next) => {
      onStateUpdate(next);
      setFeedback("戰鬥狀態已重新讀取。");
    }).catch(() => {
      setFeedback("目前無法讀取戰鬥狀態。請確認服務後再試。");
    }).finally(() => setIsRetrying(false));
  }

  return (
    <main id="main-content" className="combat-shell" tabIndex={-1}>
      <div className="combat-shell__inner">
        <header className="combat-header">
          <div className="combat-header__identity">
            <p className="combat-eyebrow">權威戰鬥狀態</p>
            <h1>TEST 戰鬥</h1>
            <p>第 {combat.round} 回合</p>
          </div>
          <section className="combat-header__turns" aria-labelledby="combat-turn-heading">
            <div className="combat-header__turn-heading">
              <h2 id="combat-turn-heading">行動順序</h2>
              <p>目前行動：<strong>{currentActor?.displayName ?? combat.currentActorId}</strong></p>
            </div>
            <CombatTurnOrder state={combat} />
          </section>
        </header>

        <div className="combat-layout">
          <section className="combat-battlefield" aria-labelledby="battlefield-heading">
            <div className="combat-section-heading">
              <div><p className="combat-eyebrow">戰場</p><h2 id="battlefield-heading">TEST 戰場配置</h2></div>
              <p>僅供畫面展示，不是正式站位規則。</p>
            </div>
            <div className="combat-lanes">
              {lanes.map((lane, index) => (
                <section key={lane.id} className="combat-lane" data-lane={lane.id} aria-labelledby={`lane-${lane.id}`}>
                  {index === 2 ? <div className="combat-frontline" aria-label="前線分隔">前線</div> : null}
                  <h3 id={`lane-${lane.id}`}>{lane.label}</h3>
                  <div className="combat-lane__cards">
                    {lane.participants.length > 0
                      ? lane.participants.map((participant) => <ParticipantCard key={participant.id} participant={participant} current={participant.id === combat.currentActorId} />)
                      : <p className="combat-lane__empty">目前沒有 TEST participant。</p>}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <aside className="combat-rail" aria-label="戰鬥資訊與指令">
            <Panel className="combat-rail__panel" aria-labelledby="combat-status-heading">
              <p className="combat-eyebrow">戰況</p>
              <h2 id="combat-status-heading">目前狀態</h2>
              <dl className="combat-status-list">
                <div><dt>回合</dt><dd>第 {combat.round} 回合</dd></div>
                <div><dt>目前行動</dt><dd>{currentActor?.displayName ?? combat.currentActorId}</dd></div>
                <div><dt>參戰者</dt><dd>{combat.participants.length} 名</dd></div>
                <div><dt>活動</dt><dd>戰鬥中</dd></div>
                <div><dt>工程版本</dt><dd>{gameState.state.revision}</dd></div>
              </dl>
            </Panel>

            <Panel className="combat-rail__panel" aria-labelledby="combat-narration-heading">
              <p className="combat-eyebrow">戰鬥敘事</p>
              <h2 id="combat-narration-heading">尚未接入</h2>
              <p>Phase 12 不呼叫 LLM，也不產生戰鬥故事。</p>
            </Panel>

            <Panel className="combat-rail__panel" aria-labelledby="combat-skills-heading">
              <p className="combat-eyebrow">技能</p>
              <h2 id="combat-skills-heading">已裝備技能</h2>
              {gameState.state.character.equippedSkillIds.length > 0 ? (
                <ul className="combat-skill-list">{gameState.state.character.equippedSkillIds.map((skill) => <li key={skill}>{skill}</li>)}</ul>
              ) : <p>目前沒有已裝備的測試技能。</p>}
              <p className="combat-rail__notice">尚未接入戰鬥技能操作。</p>
            </Panel>

            <Panel className="combat-rail__panel" aria-labelledby="combat-commands-heading">
              <p className="combat-eyebrow">指令</p>
              <h2 id="combat-commands-heading">尚未可用</h2>
              <p className="combat-rail__notice">戰鬥指令尚未接入；按鈕不會送出請求或修改狀態。</p>
              <div className="combat-commands">
                {disabledCombatCommands.map((command) => <Button key={command.id} variant="secondary" disabled data-command={command.id}>{command.label}</Button>)}
              </div>
            </Panel>

            {gameState.sandbox ? (
              <Panel className="combat-rail__panel combat-test-controls" aria-labelledby="combat-test-heading">
                <p className="combat-eyebrow">工程測試</p>
                <h2 id="combat-test-heading">TEST 控制</h2>
                <p>此控制只在 COMBAT_SANDBOX 開啟時出現，並由後端決定下一回合。</p>
                <Button loading={isAdvancing} loadingLabel="正在推進……" disabled={isAdvancing} onClick={advanceTestTurn}>TEST：推進下一回合</Button>
              </Panel>
            ) : null}
          </aside>
        </div>

        <section className="combat-feedback" aria-label="戰鬥狀態回饋">
          {feedback ? <p role="status" aria-live="polite">{feedback}</p> : null}
          {stateError ? <p className="combat-feedback__error" role="alert">目前無法讀取戰鬥狀態。</p> : null}
          <Button variant="secondary" loading={isRetrying} loadingLabel="正在讀取……" onClick={retryState}>重新讀取戰鬥狀態</Button>
        </section>
      </div>
    </main>
  );
}
