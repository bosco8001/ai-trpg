import { useEffect, useRef, useState } from "react";
import type {
  AuthoritativeGameStateResponse,
  CombatParticipantView,
  CombatStateView,
  NormalAttackOptionsResponse,
  NormalAttackTargetOptionView,
} from "../shared/game-state.js";
import { advanceTestCombatTurn, executeNormalAttack, loadNormalAttackOptions } from "./api.js";
import {
  disabledCombatCommands,
  getCombatPresentationLanes,
  getTurnOrderEntries,
  initiativeDetail,
  canPlayerUseNormalAttack,
  isServerListedLegalTarget,
} from "./combat-ui.js";
import { Button } from "./ui/Button.js";
import { Panel } from "./ui/Panel.js";

function modifierTerm(value: number): string {
  return (value >= 0 ? "+ " : "− ") + Math.abs(value);
}

function ParticipantCard({
  participant,
  current,
  targeting,
  targetOption,
  canSubmitTarget,
  onSelectTarget,
}: {
  participant: CombatParticipantView;
  current: boolean;
  targeting: boolean;
  targetOption: NormalAttackTargetOptionView | undefined;
  canSubmitTarget: boolean;
  onSelectTarget: (targetId: string) => void;
}) {
  const canChoose = targeting && participant.side === "enemy" && targetOption?.legal === true && canSubmitTarget;
  const blocked = targeting && participant.side === "enemy" && !canChoose;
  const blockedReason = targetOption?.reason === "front-row-blocked"
    ? "前排敵人阻擋"
    : "此目標目前不可選。";
  const blockedReasonId = "target-reason-" + participant.id;
  return (
    <article className="combat-participant" data-side={participant.side} data-row={participant.row} data-current={current || undefined}>
      <div className="combat-participant__heading">
        <p>{participant.side === "enemy" ? "敵方" : "我方"}・{participant.row === "front" ? "前排" : "後排"}</p>
        {current ? <span className="combat-current-badge">目前行動</span> : null}
      </div>
      <h4>{participant.displayName}</h4>
      <dl>
        <div><dt>先攻</dt><dd>{participant.initiative.total}</dd></div>
        <div><dt>骰值</dt><dd>{initiativeDetail(participant)}</dd></div>
      </dl>
      {canChoose ? (
        <Button
          variant="secondary"
          className="combat-target-button"
          data-target={participant.id}
          aria-label={"選擇攻擊目標：" + participant.displayName}
          onClick={() => onSelectTarget(participant.id)}
        >
          選擇此目標
        </Button>
      ) : blocked ? (
        <div className="combat-target-blocked">
          <Button variant="secondary" className="combat-target-button" disabled aria-describedby={blockedReasonId}>
            不可選擇
          </Button>
          <p id={blockedReasonId}>{blockedReason}</p>
        </div>
      ) : null}
    </article>
  );
}

function CombatTurnOrder({ state }: { state: CombatStateView }) {
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

function LastActionPanel({ combat }: { combat: CombatStateView }) {
  const action = combat.lastAction;
  const participants = new Map(combat.participants.map((participant) => [participant.id, participant]));
  if (!action) {
    return (
      <Panel className="combat-rail__panel" aria-labelledby="combat-last-action-heading">
        <p className="combat-eyebrow">戰鬥裁定</p>
        <h2 id="combat-last-action-heading">最近裁定</h2>
        <p>尚無已完成的普通攻擊裁定。</p>
      </Panel>
    );
  }
  const actor = participants.get(action.actorId)?.displayName ?? action.actorId;
  const target = participants.get(action.targetId)?.displayName ?? action.targetId;
  return (
    <Panel className="combat-rail__panel combat-last-action" aria-labelledby="combat-last-action-heading">
      <p className="combat-eyebrow">戰鬥裁定・第 {action.round} 回合</p>
      <h2 id="combat-last-action-heading">最近裁定</h2>
      <p className="combat-last-action__pair">{actor} → {target}</p>
      <dl className="combat-last-action__checks">
        <div>
          <dt>攻擊檢定</dt>
          <dd>
            {action.attack.rawD20} {modifierTerm(action.attack.perceptionModifier)}
            {" "}{modifierTerm(action.attack.weaponMainStatModifier)}
            {" "}{modifierTerm(action.attack.proficiencyModifier)} = {action.attack.total}
          </dd>
        </div>
        <div>
          <dt>閃避檢定</dt>
          <dd>{action.evasion.rawD20} {modifierTerm(action.evasion.dexterityModifier)} = {action.evasion.total}</dd>
        </div>
      </dl>
      <p className="combat-last-action__outcome" data-outcome={action.outcome}>
        結果：{action.outcome === "hit" ? "命中" : "未命中"}
      </p>
    </Panel>
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
  const [isTargeting, setIsTargeting] = useState(false);
  const [isLoadingTargets, setIsLoadingTargets] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [targetOptions, setTargetOptions] = useState<NormalAttackOptionsResponse | null>(null);
  const [feedback, setFeedback] = useState(stateError ?? "");
  const attackButton = useRef<HTMLButtonElement>(null);
  const restoreAttackFocus = useRef(false);

  useEffect(() => { setFeedback(stateError ?? ""); }, [stateError]);
  useEffect(() => {
    if (!isTargeting && restoreAttackFocus.current) {
      attackButton.current?.focus();
      restoreAttackFocus.current = false;
    }
  }, [isTargeting]);

  if (!combat) {
    return (
      <main id="main-content" className="combat-shell" tabIndex={-1}>
        <Panel className="combat-message" role="alert"><p>目前無法讀取戰鬥狀態。</p></Panel>
      </main>
    );
  }

  const currentActor = combat.participants.find((participant) => participant.id === combat.currentActorId);
  const currentActorId = combat.currentActorId;
  const lanes = getCombatPresentationLanes(combat.participants);
  const targetOptionsById = new Map((targetOptions?.targets ?? []).map((target) => [target.targetId, target]));
  const requestInFlight = isAdvancing || isRetrying || isLoadingTargets || isResolving;
  const canPlayerAttack = canPlayerUseNormalAttack(combat, requestInFlight);

  function cancelTargeting() {
    restoreAttackFocus.current = true;
    setIsTargeting(false);
    setIsLoadingTargets(false);
    setTargetOptions(null);
    setFeedback("已取消選擇目標；戰鬥狀態沒有改變。");
  }

  function beginTargetSelection() {
    if (!canPlayerAttack || requestInFlight) return;
    setIsTargeting(true);
    setTargetOptions(null);
    setIsLoadingTargets(true);
    setFeedback("正在取得伺服器提供的合法目標……");
    void loadNormalAttackOptions().then(async (options) => {
      if (options.revision !== gameState.state.revision
        || options.currentActorId !== currentActorId || !options.canPlayerAct) {
        setIsTargeting(false);
        setTargetOptions(null);
        setFeedback("戰鬥狀態已更新，正在重新讀取。");
        try {
          const latest = await onRetryState();
          onStateUpdate(latest);
        } catch {
          setFeedback("目前無法確認最新戰鬥狀態，請稍後重新讀取。");
        }
        return;
      }
      setTargetOptions(options);
      setFeedback("");
    }).catch((error: unknown) => {
      setFeedback(error instanceof Error ? error.message : "目前無法讀取合法攻擊目標，請重新讀取戰鬥狀態。");
    }).finally(() => setIsLoadingTargets(false));
  }

  function selectTarget(targetId: string) {
    const option = targetOptionsById.get(targetId);
    if (!option?.legal || !isServerListedLegalTarget(targetOptions, targetId, gameState.state.revision)
      || requestInFlight) return;
    setIsResolving(true);
    setIsTargeting(false);
    setTargetOptions(null);
    setFeedback("正在由戰鬥系統擲骰並保存裁定……");
    void executeNormalAttack(gameState.state.revision, targetId).then((response) => {
      onStateUpdate({
        sandbox: response.sandbox,
        storage: response.storage,
        state: response.state,
      });
      setFeedback(response.effect.outcome === "hit" ? "普通攻擊裁定完成：命中。" : "普通攻擊裁定完成：未命中。");
    }).catch(async (error: unknown) => {
      setFeedback(error instanceof Error ? error.message : "普通攻擊暫時無法使用，請重新讀取戰鬥狀態。");
      try {
        const latest = await onRetryState();
        onStateUpdate(latest);
      } catch {
        // Keep the safe action error; a separate retry control remains available.
      }
    }).finally(() => setIsResolving(false));
  }

  function advanceTestTurn() {
    if (!gameState.sandbox || requestInFlight) return;
    setIsAdvancing(true);
    setFeedback("正在請裁判推進 TEST 回合……");
    void advanceTestCombatTurn(gameState.state.revision).then((response) => {
      setIsTargeting(false);
      setTargetOptions(null);
      onStateUpdate({ sandbox: response.sandbox, storage: response.storage, state: response.state });
      setFeedback("TEST 回合已由權威戰鬥引擎推進。");
    }).catch(() => {
      setFeedback("目前無法推進 TEST 戰鬥回合。請重新讀取狀態後再試。");
    }).finally(() => setIsAdvancing(false));
  }

  function retryState() {
    if (requestInFlight) return;
    setIsRetrying(true);
    setFeedback("正在重新讀取戰鬥狀態……");
    void onRetryState().then((next) => {
      setIsTargeting(false);
      setTargetOptions(null);
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
              <div><p className="combat-eyebrow">戰場</p><h2 id="battlefield-heading">參戰者位置</h2></div>
              <p>排位來自權威狀態；目前不支援換排。</p>
            </div>
            {isTargeting ? (
              <section className="combat-target-mode" aria-labelledby="combat-target-heading" aria-live="polite">
                <div>
                  <h3 id="combat-target-heading">請選擇攻擊目標</h3>
                  <p>{isLoadingTargets ? "正在讀取合法目標……" : "只有伺服器列出的合法敵人可以選擇。"}</p>
                </div>
                <Button variant="secondary" disabled={isResolving} onClick={cancelTargeting}>取消</Button>
              </section>
            ) : null}
            <div className="combat-lanes">
              {lanes.map((lane, index) => (
                <section key={lane.id} className="combat-lane" data-lane={lane.id} aria-labelledby={"lane-" + lane.id}>
                  {index === 2 ? <div className="combat-frontline" aria-label="前線分隔">前線</div> : null}
                  <h3 id={"lane-" + lane.id}>{lane.label}</h3>
                  <div className="combat-lane__cards">
                    {lane.participants.length > 0
                      ? lane.participants.map((participant) => (
                        <ParticipantCard
                          key={participant.id}
                          participant={participant}
                          current={participant.id === combat.currentActorId}
                          targeting={isTargeting && !isLoadingTargets}
                          targetOption={targetOptionsById.get(participant.id)}
                          canSubmitTarget={!requestInFlight}
                          onSelectTarget={selectTarget}
                        />
                      ))
                      : <p className="combat-lane__empty">目前沒有參戰者。</p>}
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

            <LastActionPanel combat={combat} />

            <Panel className="combat-rail__panel" aria-labelledby="combat-narration-heading">
              <p className="combat-eyebrow">戰鬥敘事</p>
              <h2 id="combat-narration-heading">尚未接入</h2>
              <p>本階段只顯示系統裁定，不產生戰鬥敘事。</p>
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
              <h2 id="combat-commands-heading">基本指令</h2>
              <p className="combat-rail__notice">普通攻擊可用；其他指令仍由系統停用。</p>
              <div className="combat-commands">
                <Button
                  ref={attackButton}
                  variant="primary"
                  data-command="attack"
                  disabled={!canPlayerAttack || requestInFlight || isTargeting}
                  loading={isResolving}
                  loadingLabel="正在裁定……"
                  onClick={beginTargetSelection}
                >
                  普通攻擊
                </Button>
                {disabledCombatCommands.map((command) => (
                  <Button key={command.id} variant="secondary" disabled data-command={command.id}>{command.label}</Button>
                ))}
              </div>
              {currentActor?.side === "enemy" ? <p className="combat-rail__notice">目前是敵方回合，玩家不能執行普通攻擊。</p> : null}
            </Panel>

            {gameState.sandbox ? (
              <Panel className="combat-rail__panel combat-test-controls" aria-labelledby="combat-test-heading">
                <p className="combat-eyebrow">工程測試</p>
                <h2 id="combat-test-heading">TEST 控制</h2>
                <p>此控制只在 COMBAT_SANDBOX 開啟時出現，並由後端決定下一回合。</p>
                <Button loading={isAdvancing} loadingLabel="正在推進……" disabled={requestInFlight} onClick={advanceTestTurn}>TEST：推進下一回合</Button>
              </Panel>
            ) : null}
          </aside>
        </div>

        <section className="combat-feedback" aria-label="戰鬥狀態回饋">
          {feedback ? <p role="status" aria-live="polite">{feedback}</p> : null}
          {stateError ? <p className="combat-feedback__error" role="alert">目前無法讀取戰鬥狀態。</p> : null}
          <Button variant="secondary" loading={isRetrying} loadingLabel="正在讀取……" disabled={requestInFlight && !isRetrying} onClick={retryState}>重新讀取戰鬥狀態</Button>
        </section>
      </div>
    </main>
  );
}
