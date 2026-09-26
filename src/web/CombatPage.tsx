import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  AuthoritativeGameStateResponse,
  CombatRow,
  CombatParticipantView,
  CombatStateView,
  CombatItemOptionsResponse,
  NormalAttackOptionsResponse,
  NormalAttackTargetOptionView,
  RowMoveOptionsResponse,
  PhysicalSkillOptionsResponse,
  DragonBreathOptionsResponse,
  CombatPartyOptionsResponse,
} from "../shared/game-state.js";
import { CombatPartyDialog } from "./CombatPartyDialog.js";
import {
  advanceTestCombatTurn,
  executeCombatItemUse,
  executeDefend,
  executeRun,
  executeNormalAttack,
  executeRowMove,
  loadCombatItemOptions,
  loadNormalAttackOptions,
  loadRowMoveOptions,
  loadPhysicalSkillOptions,
  executePhysicalSkill,
  executeCasting,
  loadDragonBreathOptions,
  executeDragonBreath,
  loadCombatPartyOptions,
  setCombatCompanionTacticPreference,
  executeCompanionTurn,
  executeRescue,
} from "./api.js";
import {
  getCombatPresentationLanes,
  getVisualTurnOrderEntries,
  initiativeDetail,
  canPlayerUseRowMove,
  canPlayerUseNormalAttack,
  canPlayerDefend,
  isServerListedLegalTarget,
  isServerListedLegalTargetRow,
  isServerListedUsableCombatItem,
} from "./combat-ui.js";
import { getCombatItemDisplayName } from "../shared/combat-items.js";
import type { CombatNarrationPresentation } from "../shared/combat-narration.js";
import { Button } from "./ui/Button.js";
import { Panel } from "./ui/Panel.js";
import { useCombatPacing } from "./useCombatPacing.js";

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
    : targetOption?.reason === "incapacitated" ? "目標已瀕死或死亡" : "此目標目前不可選。";
  const blockedReasonId = "target-reason-" + participant.id;
  return (
    <article className="combat-participant" data-side={participant.side} data-row={participant.row}
      data-life-state={participant.health.lifeState} data-current={current || undefined}>
      <div className="combat-participant__heading">
        <p>{participant.side === "enemy" ? "敵方" : "我方"}・{participant.row === "front" ? "前排" : "後排"}</p>
        {current ? <span className="combat-current-badge">目前行動</span> : null}
      </div>
      <h4>{participant.displayName}</h4>
      <p className="combat-participant__health">HP {participant.health.currentHp} / {participant.health.maxHp}・{participant.health.lifeState === "active"
        ? "可行動" : participant.health.lifeState === "dying"
          ? `瀕死・剩餘 ${participant.health.dyingTurnsRemaining} 回合` : "死亡"}</p>
      <dl>
        <div><dt>先攻</dt><dd>{participant.initiative.total}</dd></div>
        <div><dt>骰值</dt><dd>{initiativeDetail(participant)}</dd></div>
      </dl>
      {canChoose ? (
        <Button
          variant="secondary"
          className="combat-target-button"
          data-target={participant.id}
          aria-label={"選擇目標：" + participant.displayName}
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

function CombatTurnOrder({ state, visualActorId }: { state: CombatStateView; visualActorId: string | null }) {
  const list = useRef<HTMLOListElement>(null);
  const previousPositions = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const element = list.current;
    if (!element) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const currentPositions = new Map<string, number>();
    for (const chip of Array.from(element.children) as HTMLElement[]) {
      const id = chip.dataset.actorId;
      if (!id) continue;
      const left = chip.getBoundingClientRect().left;
      currentPositions.set(id, left);
      const oldLeft = previousPositions.current.get(id);
      if (!reduced && oldLeft !== undefined && oldLeft !== left) {
        chip.getAnimations().forEach((animation) => animation.cancel());
        chip.animate([{ transform: `translateX(${oldLeft - left}px)` }, { transform: "translateX(0)" }],
          { duration: 320, easing: "ease-out" });
      }
    }
    previousPositions.current = currentPositions;
    const current = Array.from(element.children).find((child) => (child as HTMLElement).dataset.actorId === visualActorId) as HTMLElement | undefined;
    if (current) element.scrollTo({ left: Math.max(0, current.offsetLeft - element.offsetLeft), behavior: reduced ? "instant" : "smooth" });
  }, [state, visualActorId]);
  return (
    <ol ref={list} className="combat-turn-order" aria-label="行動順序；由權威順序輪轉顯示">
      {getVisualTurnOrderEntries(state, visualActorId).map(({ participant, current }, index) => (
        <li key={participant.id} data-actor-id={participant.id} data-current={current || undefined} aria-current={current ? "step" : undefined}>
          <span className="combat-turn-order__index" aria-hidden="true">{index + 1}</span>
          <span>{participant.displayName}</span>
          {participant.health.lifeState !== "active" ? <span>・{participant.health.lifeState === "dying"
            ? `瀕死 ${participant.health.dyingTurnsRemaining}` : "死亡"}</span> : null}
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
        <p>尚無已完成的戰鬥行動。</p>
      </Panel>
    );
  }
  const actor = participants.get(action.actorId)?.displayName ?? action.actorId;
  if (action.type === "rescue") return <Panel className="combat-rail__panel combat-last-action" aria-labelledby="combat-last-action-heading">
    <p className="combat-eyebrow">最近行動・第 {action.round} 回合</p>
    <h2 id="combat-last-action-heading">救助</h2>
    <p>{actor}救助了{participants.get(action.targetId)?.displayName ?? action.targetId}，目標恢復至 1 HP。</p>
  </Panel>;
  if (action.type === "row-move") {
    const rowLabel = (row: CombatRow) => `我方${row === "front" ? "前排" : "後排"}`;
    return (
      <Panel className="combat-rail__panel combat-last-action" aria-labelledby="combat-last-action-heading">
        <p className="combat-eyebrow">最近行動・第 {action.round} 回合</p>
        <h2 id="combat-last-action-heading">最近行動</h2>
        <p className="combat-last-action__pair">{actor}</p>
        <p className="combat-last-action__row-move">
          {rowLabel(action.fromRow)} → {rowLabel(action.toRow)}
        </p>
        <p className="combat-last-action__outcome">結果：換排完成</p>
      </Panel>
    );
  }
  if (action.type === "item-use") {
    const itemName = getCombatItemDisplayName(action.itemId) ?? action.itemId;
    return (
      <Panel className="combat-rail__panel combat-last-action" aria-labelledby="combat-last-action-heading">
        <p className="combat-eyebrow">最近行動・第 {action.round} 回合</p>
        <h2 id="combat-last-action-heading">最近行動</h2>
        <p className="combat-last-action__pair">{actor}</p>
        <p className="combat-last-action__row-move">使用：{itemName}</p>
        <p className="combat-last-action__outcome">數量：{action.quantityBefore} → {action.quantityAfter}</p>
        <p className="combat-last-action__outcome">結果：物品已使用</p>
      </Panel>
    );
  }
  if (action.type === "defend") {
    return (
      <Panel className="combat-rail__panel combat-last-action" aria-labelledby="combat-last-action-heading">
        <p className="combat-eyebrow">最近行動・第 {action.round} 回合</p>
        <h2 id="combat-last-action-heading">最近行動</h2>
        <p className="combat-last-action__pair">{actor}</p>
        {action.tacticPreferenceId ? <p>TEST 隊友自主選擇：防禦（{action.tacticPreferenceId}）</p> : null}
        <p className="combat-last-action__row-move">選擇：防禦</p>
        <p className="combat-last-action__outcome">防禦行動已完成。實際減傷效果尚未接入。</p>
      </Panel>
    );
  }
  if (action.type === "run") {
    return (
      <Panel className="combat-rail__panel combat-last-action" aria-labelledby="combat-last-action-heading">
        <p className="combat-eyebrow">逃跑裁定・第 {action.round} 回合</p>
        <h2 id="combat-last-action-heading">最近裁定</h2>
        <p>{actor}</p>
        <p>逃跑判定：{action.rawD20} {modifierTerm(action.dexterityModifier)}{action.racialModifier === 0 ? "" : ` ${modifierTerm(action.racialModifier)}`} = {action.total}</p>
        <p>目標：{action.dc}</p>
        <p>結果：逃跑{action.outcome === "success" ? "成功" : "失敗"}</p>
        {action.outcome === "success" ? <p>戰鬥已結束</p> : null}
      </Panel>
    );
  }
  if (action.type === "casting-start" || action.type === "casting-continue"
    || action.type === "casting-cancel" || action.type === "casting-complete") {
    const casting = action;
    return <Panel className="combat-rail__panel combat-last-action" aria-labelledby="combat-last-action-heading">
      <p className="combat-eyebrow">最近行動・第 {casting.round} 回合</p>
      <h2 id="combat-last-action-heading">最近行動</h2>
      <p>{actor}・TEST 多回合法術</p>
      <p>{casting.type === "casting-start" ? "開始詠唱" : casting.type === "casting-continue" ? "繼續詠唱"
        : casting.type === "casting-cancel" ? "已取消詠唱" : "詠唱完成"}</p>
      <p>進度：{casting.completedCastingTurns} / {casting.totalCastingTurns}</p>
      <p>本次投入：{casting.mpSpentThisAction} MP・總投入：{casting.totalMpSpent} MP</p>
    </Panel>;
  }
  if (action.type === "dragon-breath") {
    const element = action.element === "fire" ? "火" : action.element === "ice" ? "冰" : "雷";
    return <Panel className="combat-rail__panel combat-last-action" aria-labelledby="combat-last-action-heading">
      <p className="combat-eyebrow">戰鬥裁定・第 {action.round} 回合</p>
      <h2 id="combat-last-action-heading">龍息・{element}</h2>
      <p>目標：敵方{action.targetRow === "front" ? "前排" : "後排"}</p>
      {action.results.map((result) => <div key={result.targetId} className="combat-aoe-result">
        <h3>{participants.get(result.targetId)?.displayName ?? result.targetId}</h3>
        <p>攻擊：{result.attack.rawD20} {modifierTerm(result.attack.perceptionModifier)} PER = {result.attack.total}</p>
        <p>閃避：{result.evasion.rawD20} {modifierTerm(result.evasion.dexterityModifier)} DEX = {result.evasion.total}</p>
        <p>結果：{result.outcome === "hit" ? `命中${result.critical ? "・暴擊" : ""}` : "未命中"}</p>
      </div>)}
      <p>第 {action.readyRound} 回合可再次使用。</p>
    </Panel>;
  }
  const target = participants.get(action.targetId)?.displayName ?? action.targetId;
  return (
    <Panel className="combat-rail__panel combat-last-action" aria-labelledby="combat-last-action-heading">
      <p className="combat-eyebrow">戰鬥裁定・第 {action.round} 回合</p>
      <h2 id="combat-last-action-heading">最近裁定</h2>
      {action.type === "physical-skill" ? <p>技能：{action.skillId === "TEST-skill-1" ? "TEST 物理技能" : action.skillId}</p> : null}
      {action.type === "normal-attack" && action.tacticPreferenceId
        ? <p>TEST 隊友自主選擇：普通攻擊（{action.tacticPreferenceId}）</p> : null}
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
      {action.type === "physical-skill" ? <p>第 {action.readyRound} 回合可再次使用。未計算傷害。</p> : null}
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
  const currentActor = combat?.participants.find((participant) => participant.id === combat.currentActorId);
  const currentActorId = combat?.currentActorId ?? "";
  const hasPlayerActionActor = currentActor?.side === "party" && currentActor.controlledBy !== "companion"
    && currentActor.normalAttack !== null && currentActor.health.lifeState === "active";
  const currentCasting = combat?.activeCastings.find((entry) => entry.actorId === currentActorId);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isTargeting, setIsTargeting] = useState(false);
  const [isLoadingTargets, setIsLoadingTargets] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isRescueOpen, setIsRescueOpen] = useState(false);
  const [isRescuing, setIsRescuing] = useState(false);
  const rescueInFlight = useRef(false);
  const [isRowMoveMode, setIsRowMoveMode] = useState(false);
  const [isLoadingRowMoveOptions, setIsLoadingRowMoveOptions] = useState(false);
  const [isMovingRow, setIsMovingRow] = useState(false);
  const [rowMoveOptions, setRowMoveOptions] = useState<RowMoveOptionsResponse | null>(null);
  const [rowMoveOptionsReloadId, setRowMoveOptionsReloadId] = useState(0);
  const [isBagOpen, setIsBagOpen] = useState(false);
  const [isLoadingBagOptions, setIsLoadingBagOptions] = useState(false);
  const [bagOptions, setBagOptions] = useState<CombatItemOptionsResponse | null>(null);
  const [bagOptionsError, setBagOptionsError] = useState<string | null>(null);
  const [bagOptionsReloadId, setBagOptionsReloadId] = useState(0);
  const [isPartyOpen, setIsPartyOpen] = useState(false);
  const [partyOptions, setPartyOptions] = useState<CombatPartyOptionsResponse | null>(null);
  const [isLoadingParty, setIsLoadingParty] = useState(false);
  const [partyError, setPartyError] = useState<string | null>(null);
  const [partyStatus, setPartyStatus] = useState("");
  const [partyReloadId, setPartyReloadId] = useState(0);
  const [partyMutationCompanionId, setPartyMutationCompanionId] = useState<string | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [isUsingItem, setIsUsingItem] = useState(false);
  const [isDefendConfirmationOpen, setIsDefendConfirmationOpen] = useState(false);
  const [isSubmittingDefend, setIsSubmittingDefend] = useState(false);
  const [isRunConfirmationOpen, setIsRunConfirmationOpen] = useState(false);
  const [isSubmittingRun, setIsSubmittingRun] = useState(false);
  const [targetOptions, setTargetOptions] = useState<NormalAttackOptionsResponse | null>(null);
  const [skillOptions, setSkillOptions] = useState<PhysicalSkillOptionsResponse | null>(null);
  const [skillOptionsError, setSkillOptionsError] = useState<string | null>(null);
  const [isLoadingSkillOptions, setIsLoadingSkillOptions] = useState(false);
  const [skillOptionsReloadId, setSkillOptionsReloadId] = useState(0);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [isUsingSkill, setIsUsingSkill] = useState(false);
  const [isStartCastingConfirmationOpen, setIsStartCastingConfirmationOpen] = useState(false);
  const [isCastingMutation, setIsCastingMutation] = useState(false);
  const [castingError, setCastingError] = useState<string | null>(null);
  const [breathOptions, setBreathOptions] = useState<DragonBreathOptionsResponse | null>(null);
  const [breathOptionsError, setBreathOptionsError] = useState<string | null>(null);
  const [breathReloadId, setBreathReloadId] = useState(0);
  const [isBreathRowSelectionOpen, setIsBreathRowSelectionOpen] = useState(false);
  const [isUsingBreath, setIsUsingBreath] = useState(false);
  const breathButton = useRef<HTMLButtonElement>(null);
  const breathHeading = useRef<HTMLHeadingElement>(null);
  const restoreBreathFocus = useRef(false);
  const focusStatusAfterBreath = useRef(false);
  const castingButton = useRef<HTMLButtonElement>(null);
  const castingHeading = useRef<HTMLHeadingElement>(null);
  const statusHeading = useRef<HTMLHeadingElement>(null);
  const focusStatusAfterCasting = useRef(false);
  const restoreCastingFocus = useRef(false);
  const skillButton = useRef<HTMLButtonElement>(null);
  const skillTargetHeading = useRef<HTMLHeadingElement>(null);
  const restoreSkillFocus = useRef(false);
  const [feedback, setFeedback] = useState(stateError ?? "");
  const [narrationEntry, setNarrationEntry] = useState<{
    revision: number; narration: CombatNarrationPresentation;
  } | null>(null);
  const showNarration = (response: { state: { revision: number }; narration?: CombatNarrationPresentation }) => {
    if (response.narration) setNarrationEntry({ revision: response.state.revision, narration: response.narration });
  };
  const [skillUseError, setSkillUseError] = useState<string | null>(null);
  const attackButton = useRef<HTMLButtonElement>(null);
  const defendButton = useRef<HTMLButtonElement>(null);
  const defendHeading = useRef<HTMLHeadingElement>(null);
  const restoreDefendFocus = useRef(false);
  const defendRequestInFlight = useRef(false);
  const runButton = useRef<HTMLButtonElement>(null);
  const runHeading = useRef<HTMLHeadingElement>(null);
  const restoreRunFocus = useRef(false);
  const runRequestInFlight = useRef(false);
  const rowMoveButton = useRef<HTMLButtonElement>(null);
  const bagButton = useRef<HTMLButtonElement>(null);
  const partyButton = useRef<HTMLButtonElement>(null);
  const restorePartyFocus = useRef(false);
  const bagHeading = useRef<HTMLHeadingElement>(null);
  const bagUseButton = useRef<HTMLButtonElement>(null);
  const itemConfirmButton = useRef<HTMLButtonElement>(null);
  const rowMoveHeading = useRef<HTMLHeadingElement>(null);
  const restoreAttackFocus = useRef(false);
  const restoreRowMoveFocus = useRef(false);
  const restoreBagFocus = useRef(false);
  const restoreBagUseFocus = useRef(false);
  const rowMoveRequestInFlight = useRef(false);
  const debugRequestInFlight = useRef(false);
  const retryStateRef = useRef(onRetryState);
  const stateUpdateRef = useRef(onStateUpdate);
  retryStateRef.current = onRetryState;
  stateUpdateRef.current = onStateUpdate;

  const mutationInFlight = isAdvancing || isRetrying || isResolving || isMovingRow || isUsingItem
    || isSubmittingDefend || isSubmittingRun || isUsingSkill || isCastingMutation || isUsingBreath
    || partyMutationCompanionId !== null || isRescuing;
  const pacing = useCombatPacing(gameState, mutationInFlight, onStateUpdate, onRetryState, (response) => {
    showNarration(response);
    setFeedback(response.effect.selectedAction === "normal-attack"
      ? "TEST 隊友自主選擇：普通攻擊。" : response.effect.selectedAction === "rescue"
        ? "TEST 隊友優先救助瀕死隊員。" : "TEST 隊友自主選擇：防禦。");
  }, (response) => {
    showNarration(response);
    setFeedback(response.event.lifeState === "dead" ? "瀕死：1 → 0，角色已死亡。"
      : "瀕死：2 → 1；本回合已跳過。");
  });
  const visualActorId = pacing.visualActorId ?? currentActorId;
  const visualActor = combat?.participants.find((participant) => participant.id === visualActorId);
  const controlMutationBusy = mutationInFlight || pacing.phase !== "idle";
  const requestInFlight = controlMutationBusy || isLoadingTargets || isLoadingRowMoveOptions
    || isLoadingBagOptions || isLoadingSkillOptions;
  const debugDisabled = mutationInFlight || pacing.inFlight || isLoadingTargets || isLoadingRowMoveOptions
    || isLoadingBagOptions || isLoadingSkillOptions;

  useEffect(() => { setFeedback(stateError ?? ""); }, [stateError]);
  useEffect(() => { setIsRescueOpen(false); }, [gameState.state.revision]);
  useEffect(() => {
    let active = true;
    setBreathOptions(null);
    setIsBreathRowSelectionOpen(false);
    if (!combat || combat.status === "ended") return () => { active = false; };
    setBreathOptionsError(null);
    void loadDragonBreathOptions().then((options) => {
      if (!active) return;
      if (options.revision !== gameState.state.revision || options.currentActorId !== currentActorId
        || options.currentRound !== combat.round) {
        setBreathOptionsError("戰鬥狀態已更新，請重新讀取龍息狀態。");
        return;
      }
      setBreathOptions(options);
    }).catch((error: unknown) => {
      if (active) setBreathOptionsError(error instanceof Error ? error.message : "目前無法讀取龍息狀態。");
    });
    return () => { active = false; };
  }, [gameState.state.revision, currentActorId, combat?.round, breathReloadId]);
  useEffect(() => {
    if (isBreathRowSelectionOpen) breathHeading.current?.focus();
    else if (restoreBreathFocus.current) {
      breathButton.current?.focus();
      restoreBreathFocus.current = false;
    }
  }, [isBreathRowSelectionOpen]);
  useEffect(() => {
    if (focusStatusAfterBreath.current && combat?.lastAction?.type === "dragon-breath") {
      statusHeading.current?.focus();
      focusStatusAfterBreath.current = false;
    }
  }, [gameState.state.revision]);
  useEffect(() => {
    if (isStartCastingConfirmationOpen) castingHeading.current?.focus();
    else if (restoreCastingFocus.current) {
      castingButton.current?.focus();
      restoreCastingFocus.current = false;
    }
  }, [isStartCastingConfirmationOpen]);
  useEffect(() => {
    if (focusStatusAfterCasting.current && combat?.lastAction?.type.startsWith("casting-")) {
      statusHeading.current?.focus();
      focusStatusAfterCasting.current = false;
    }
  }, [gameState.state.revision]);
  useEffect(() => {
    if (!currentCasting || !hasPlayerActionActor) return;
    setIsTargeting(false); setSelectedSkillId(null); setIsRowMoveMode(false);
    setIsBagOpen(false); setPendingItemId(null); setIsDefendConfirmationOpen(false);
    setIsRunConfirmationOpen(false); setIsStartCastingConfirmationOpen(false);
    setIsBreathRowSelectionOpen(false);
  }, [currentCasting, hasPlayerActionActor]);
  useEffect(() => {
    if (selectedSkillId) skillTargetHeading.current?.focus();
    else if (restoreSkillFocus.current) {
      skillButton.current?.focus();
      restoreSkillFocus.current = false;
    }
  }, [selectedSkillId]);
  useEffect(() => {
    let active = true;
    setSkillOptions(null);
    if (!combat || combat.status === "ended") return () => { active = false; };
    setIsLoadingSkillOptions(true);
    setSkillOptionsError(null);
    void loadPhysicalSkillOptions().then((options) => {
      if (!active) return;
      if (options.revision !== gameState.state.revision || options.currentActorId !== currentActorId) {
        setSkillOptionsError("戰鬥狀態已更新，請重新讀取技能。");
        return;
      }
      setSkillOptions(options);
    }).catch(() => {
      if (active) setSkillOptionsError("目前無法讀取物理技能，請確認服務後再試。");
    }).finally(() => { if (active) setIsLoadingSkillOptions(false); });
    return () => { active = false; };
  }, [gameState.state.revision, currentActorId, skillOptionsReloadId]);
  useEffect(() => {
    if (!isTargeting && restoreAttackFocus.current) {
      attackButton.current?.focus();
      restoreAttackFocus.current = false;
    }
  }, [isTargeting]);
  useEffect(() => {
    if (isDefendConfirmationOpen) {
      defendHeading.current?.focus();
    } else if (restoreDefendFocus.current) {
      defendButton.current?.focus();
      restoreDefendFocus.current = false;
    }
  }, [isDefendConfirmationOpen]);
  useEffect(() => {
    if (isRunConfirmationOpen) runHeading.current?.focus();
    else if (restoreRunFocus.current) {
      runButton.current?.focus();
      restoreRunFocus.current = false;
    }
  }, [isRunConfirmationOpen]);
  useEffect(() => {
    if (isRowMoveMode) {
      rowMoveHeading.current?.focus();
      return;
    }
    if (!isRowMoveMode && restoreRowMoveFocus.current) {
      rowMoveButton.current?.focus();
      restoreRowMoveFocus.current = false;
    }
  }, [isRowMoveMode]);
  useEffect(() => {
    if (isBagOpen) {
      bagHeading.current?.focus();
      return;
    }
    if (restoreBagFocus.current) {
      bagButton.current?.focus();
      restoreBagFocus.current = false;
    }
  }, [isBagOpen]);
  useEffect(() => {
    if (pendingItemId) {
      itemConfirmButton.current?.focus();
      return;
    }
    if (restoreBagUseFocus.current) {
      bagUseButton.current?.focus();
      restoreBagUseFocus.current = false;
    }
  }, [pendingItemId]);
  useEffect(() => {
    let active = true;
    if (!isPartyOpen) {
      setIsLoadingParty(false);
      return () => { active = false; };
    }
    setPartyOptions(null);
    setPartyError(null);
    setIsLoadingParty(true);
    void loadCombatPartyOptions().then(async (options) => {
      if (!active) return;
      if (options.revision !== gameState.state.revision) {
        setPartyError("隊伍狀態已更新，正在重新讀取。");
        try {
          const latest = await retryStateRef.current();
          if (active) {
            stateUpdateRef.current(latest);
            setPartyReloadId((value) => value + 1);
          }
        } catch {
          if (active) setPartyError("目前無法確認最新隊伍狀態，請稍後重新讀取。");
        }
        return;
      }
      setPartyOptions(options);
    }).catch((error: unknown) => {
      if (active) setPartyError(error instanceof Error ? error.message : "目前無法讀取隊伍資料，請稍後再試。");
    }).finally(() => {
      if (active) setIsLoadingParty(false);
    });
    return () => { active = false; };
  }, [isPartyOpen, gameState.state.revision, partyReloadId]);
  function closeParty() {
    if (!isPartyOpen) return;
    restorePartyFocus.current = true;
    setIsPartyOpen(false);
    setFeedback("已關閉隊伍資訊；遊戲狀態沒有改變。");
  }

  function restoreFocusToPartyButton() {
    if (!restorePartyFocus.current) return;
    partyButton.current?.focus();
    restorePartyFocus.current = false;
  }

  function toggleParty() {
    if (mutationInFlight) return;
    if (isPartyOpen) {
      closeParty();
      return;
    }
    setIsTargeting(false);
    setTargetOptions(null);
    setSelectedSkillId(null);
    setIsRowMoveMode(false);
    setIsBagOpen(false);
    setPendingItemId(null);
    setIsDefendConfirmationOpen(false);
    setIsRunConfirmationOpen(false);
    setIsStartCastingConfirmationOpen(false);
    setIsBreathRowSelectionOpen(false);
    setPartyStatus("");
    setIsPartyOpen(true);
  }

  function retryParty() {
    setPartyReloadId((value) => value + 1);
  }

  function changePartyPreference(companionId: string, tacticPreferenceId: string) {
    if (partyMutationCompanionId !== null || pacing.isMutationInFlight() || !partyOptions?.canChangeTacticPreference
      || partyOptions.revision !== gameState.state.revision
      || !partyOptions.companions.some((member) => member.id === companionId)
      || !partyOptions.tacticPreferences.some((option) => option.id === tacticPreferenceId)) return;
    setPartyMutationCompanionId(companionId);
    setPartyError(null);
    setPartyStatus("正在保存戰術偏好……");
    void setCombatCompanionTacticPreference(gameState.state.revision, companionId, tacticPreferenceId)
      .then((response) => {
        onStateUpdate({ sandbox: response.sandbox, storage: response.storage, state: response.state });
        setPartyOptions((current) => current ? {
          ...current,
          revision: response.state.revision,
          companions: current.companions.map((member) => member.id === companionId
            ? { ...member, tacticPreferenceId } : member),
        } : current);
        setPartyStatus(response.effect.type === "tactic-preference-updated"
          ? "已更新戰術偏好；不消耗回合，也不會讓隊友自動行動。"
          : "目前已是這項偏好；遊戲狀態沒有改變。");
      }).catch(async (error: unknown) => {
        setPartyStatus(error instanceof Error ? error.message : "偏好未能更新，請重新讀取隊伍資料。");
        try {
          const latest = await retryStateRef.current();
          stateUpdateRef.current(latest);
          setPartyReloadId((value) => value + 1);
        } catch {
          setPartyError("目前無法確認最新狀態，請重新讀取隊伍資料。");
        }
      }).finally(() => setPartyMutationCompanionId(null));
  }
  useEffect(() => {
    let active = true;
    setRowMoveOptions(null);
    if (!combat || !hasPlayerActionActor) {
      setIsLoadingRowMoveOptions(false);
      return () => { active = false; };
    }
    setIsLoadingRowMoveOptions(true);
    void loadRowMoveOptions().then(async (options) => {
      if (!active) return;
      if (options.revision !== gameState.state.revision
        || options.currentActorId !== currentActorId
        || options.currentRow !== currentActor?.row
        || !options.canPlayerAct) {
        setFeedback("戰鬥狀態已更新，正在重新讀取。");
        try {
          const latest = await retryStateRef.current();
          if (active) stateUpdateRef.current(latest);
        } catch {
          if (active) setFeedback("目前無法確認最新戰鬥狀態，請稍後重新讀取。");
        }
        return;
      }
      setRowMoveOptions(options);
    }).catch((error: unknown) => {
      if (active) {
        setFeedback(error instanceof Error ? error.message : "目前無法讀取合法換排選項，請重新讀取戰鬥狀態。");
      }
    }).finally(() => {
      if (active) setIsLoadingRowMoveOptions(false);
    });
    return () => { active = false; };
  }, [gameState.state.revision, currentActorId, currentActor?.row, hasPlayerActionActor, rowMoveOptionsReloadId]);

  useEffect(() => {
    let active = true;
    if (!isBagOpen || !combat) {
      setIsLoadingBagOptions(false);
      return () => { active = false; };
    }
    setBagOptions(null);
    setBagOptionsError(null);
    setIsLoadingBagOptions(true);
    void loadCombatItemOptions().then(async (options) => {
      if (!active) return;
      if (options.revision !== gameState.state.revision || options.currentActorId !== currentActorId) {
        setBagOptionsError("戰鬥狀態已更新，請重新讀取背包。");
        try {
          const latest = await retryStateRef.current();
          if (active) stateUpdateRef.current(latest);
        } catch {
          if (active) setBagOptionsError("目前無法確認最新背包狀態，請稍後重新讀取。");
        }
        return;
      }
      setBagOptions(options);
    }).catch((error: unknown) => {
      if (active) setBagOptionsError(error instanceof Error ? error.message : "目前無法讀取戰鬥背包，請稍後再試。");
    }).finally(() => {
      if (active) setIsLoadingBagOptions(false);
    });
    return () => { active = false; };
  }, [isBagOpen, gameState.state.revision, currentActorId, bagOptionsReloadId, combat]);

  if (!combat) {
    return (
      <main id="main-content" className="combat-shell" tabIndex={-1}>
        <Panel className="combat-message" role="alert"><p>目前無法讀取戰鬥狀態。</p></Panel>
      </main>
    );
  }

  if (combat.status === "ended") {
    return (
      <main id="main-content" className="combat-shell" tabIndex={-1}>
        <div className="combat-shell__inner">
          <header className="combat-header">
            <div className="combat-header__identity">
              <p className="combat-eyebrow">權威戰鬥狀態</p>
              <h1>戰鬥已結束</h1>
              <p>第 {combat.round} 回合・工程版本 {gameState.state.revision}</p>
            </div>
          </header>
          <div className="combat-layout">
            <Panel className="combat-rail__panel" aria-labelledby="combat-ended-heading">
              <p className="combat-eyebrow">{combat.endReason === "escaped" ? "逃跑成功" : combat.endReason === "victory" ? "戰鬥勝利" : "隊伍戰敗"}</p>
              <h2 id="combat-ended-heading">{combat.endReason === "escaped" ? "你已成功逃離戰鬥。" : combat.endReason === "victory" ? "敵人已全部死亡。" : "隊伍失去戰鬥能力。"}</h2>
              <ul>{combat.participants.map((participant) => <li key={participant.id}>{participant.displayName}：HP {participant.health.currentHp} / {participant.health.maxHp}・{participant.health.lifeState === "active"
                ? "可行動" : participant.health.lifeState === "dying" ? `瀕死・剩餘 ${participant.health.dyingTurnsRemaining} 回合` : "死亡"}</li>)}</ul>
              <p>戰鬥結算與返回探索尚未接入。</p>
              <p>目前沒有可行動的角色。</p>
            </Panel>
            <aside className="combat-rail" aria-label="戰鬥結束資訊">
              <LastActionPanel combat={combat} />
              <Panel className="combat-rail__panel" aria-labelledby="combat-ended-narration-heading">
                <p className="combat-eyebrow">AI 戰鬥敘事</p>
                <h2 id="combat-ended-narration-heading">最近敘事</h2>
                <div className="combat-narration" aria-live="polite" aria-atomic="true">
                  {narrationEntry?.revision === gameState.state.revision
                    ? <><p>{narrationEntry.narration.text}</p>
                      {narrationEntry.narration.source === "fallback" ? <small>系統敘述</small> : null}</>
                    : <p>目前沒有戰鬥敘事。</p>}
                </div>
              </Panel>
              <Panel className="combat-rail__panel" aria-labelledby="combat-ended-breath-heading">
                <h2 id="combat-ended-breath-heading">天生能力</h2>
                <Button variant="secondary" disabled>龍息</Button>
                <p>戰鬥已結束，無法使用。</p>
              </Panel>
              <Panel className="combat-rail__panel" aria-labelledby="combat-ended-skills-heading">
                <h2 id="combat-ended-skills-heading">已裝備技能</h2>
                <ul className="combat-skill-list">{gameState.state.character.equippedSkillIds.map((skillId) => {
                  return <li key={skillId}><Button variant="secondary" disabled>{skillId === "TEST-skill-1" ? "TEST 物理技能" : skillId === "TEST-skill-2" ? "TEST 多回合法術" : skillId}</Button><p>戰鬥已結束，無法使用。</p></li>;
                })}</ul>
              </Panel>
              <Panel className="combat-rail__panel" aria-labelledby="combat-ended-commands-heading">
                <h2 id="combat-ended-commands-heading">基本指令</h2>
                <div className="combat-commands">
                  <Button variant="secondary" data-command="attack" disabled>普通攻擊</Button>
                  <Button variant="secondary" data-command="defend" disabled>防禦</Button>
                  <Button variant="secondary" data-command="rescue" disabled>救助</Button>
                  <Button variant="secondary" data-command="inventory" disabled>背包</Button>
                  <Button ref={partyButton} variant="secondary" data-command="party"
                    aria-expanded={isPartyOpen} aria-controls="combat-party-dialog" onClick={toggleParty}>隊伍</Button>
                  <Button variant="secondary" data-command="move" disabled>站位</Button>
                  <Button variant="secondary" data-command="flee" disabled>逃走</Button>
                </div>
              </Panel>
            </aside>
          </div>
        </div>
        <CombatPartyDialog open={isPartyOpen} party={partyOptions} loading={isLoadingParty}
          error={partyError} busy={partyMutationCompanionId !== null || pacing.inFlight} status={partyStatus}
          onClose={closeParty} onClosed={restoreFocusToPartyButton}
          onRetry={retryParty} onPreferenceChange={changePartyPreference} />
      </main>
    );
  }

  const lanes = getCombatPresentationLanes(combat.participants);
  const targetOptionsById = new Map((targetOptions?.targets ?? []).map((target) => [target.targetId, target]));
  const selectedSkill = skillOptions?.skills.find((skill) => skill.skillId === selectedSkillId);
  const skillTargetsById = new Map((selectedSkill?.targets ?? []).map((target) => [target.targetId, target]));
  const selectionModeActive = isTargeting || isRowMoveMode || isBagOpen || isPartyOpen || isDefendConfirmationOpen || isRunConfirmationOpen || selectedSkillId !== null || isStartCastingConfirmationOpen || isBreathRowSelectionOpen || isRescueOpen;
  const canPlayerAttack = canPlayerUseNormalAttack(combat, requestInFlight);
  const canDefend = canPlayerDefend(combat, controlMutationBusy);
  const canRun = canPlayerUseNormalAttack(combat, controlMutationBusy);
  const rescueTargets = combat.participants.filter((entry) => entry.side === "party"
    && entry.id !== currentActorId && entry.health.lifeState === "dying");
  const canPlayerMoveRow = canPlayerUseRowMove(
    combat, rowMoveOptions, gameState.state.revision, requestInFlight,
  );

  function submitRescue(targetId: string) {
    if (!isRescueOpen || !hasPlayerActionActor || controlMutationBusy || rescueInFlight.current
      || !rescueTargets.some((entry) => entry.id === targetId)) return;
    rescueInFlight.current = true;
    setIsRescuing(true);
    void executeRescue(gameState.state.revision, targetId).then((response) => {
      onStateUpdate({ sandbox: response.sandbox, storage: response.storage, state: response.state });
      showNarration(response);
      setIsRescueOpen(false);
      setFeedback("救助完成；目標恢復至 1 HP，本回合已結束。");
    }).catch(async (error: unknown) => {
      setFeedback(error instanceof Error ? error.message : "救助暫時無法完成。");
      try { onStateUpdate(await onRetryState()); } catch { /* 保留錯誤提示。 */ }
      setIsRescueOpen(false);
    }).finally(() => { rescueInFlight.current = false; setIsRescuing(false); });
  }

  function beginBreathRowSelection() {
    if (!breathOptions?.available || breathOptions.revision !== gameState.state.revision
      || breathOptions.currentActorId !== currentActorId || controlMutationBusy || selectionModeActive) return;
    setIsBreathRowSelectionOpen(true);
    setFeedback("");
  }

  function cancelBreathRowSelection() {
    if (isUsingBreath) return;
    restoreBreathFocus.current = true;
    setIsBreathRowSelectionOpen(false);
    setFeedback("已取消選擇攻擊區域；戰鬥狀態沒有改變。");
  }

  function selectBreathRow(row: CombatRow) {
    if (!isBreathRowSelectionOpen || !breathOptions?.available
      || breathOptions.revision !== gameState.state.revision
      || !breathOptions.rows.some((entry) => entry.row === row && entry.available)
      || controlMutationBusy) return;
    setIsUsingBreath(true);
    focusStatusAfterBreath.current = true;
    setFeedback("正在逐一裁定龍息目標……");
    void executeDragonBreath(gameState.state.revision, row).then((response) => {
      onStateUpdate({ sandbox: response.sandbox, storage: response.storage, state: response.state });
      showNarration(response);
      setIsBreathRowSelectionOpen(false);
      setFeedback("龍息裁定完成；目前回合已結束。");
    }).catch(async (error: unknown) => {
      focusStatusAfterBreath.current = false;
      setIsBreathRowSelectionOpen(false);
      setFeedback(error instanceof Error ? error.message : "龍息暫時無法使用，請重新讀取戰鬥狀態。");
      try { onStateUpdate(await onRetryState()); } catch { /* 保留最後確認的狀態與安全錯誤。 */ }
    }).finally(() => setIsUsingBreath(false));
  }

  function beginCastingConfirmation() {
    if (!hasPlayerActionActor || currentCasting || gameState.state.character.currentMp < 18 || controlMutationBusy) return;
    setIsTargeting(false); setTargetOptions(null); setSelectedSkillId(null); setIsRowMoveMode(false);
    setIsBagOpen(false); setPendingItemId(null); setIsDefendConfirmationOpen(false);
    setIsRunConfirmationOpen(false); setCastingError(null); setIsStartCastingConfirmationOpen(true);
  }

  function cancelCastingConfirmation() {
    if (isCastingMutation) return;
    restoreCastingFocus.current = true;
    setIsStartCastingConfirmationOpen(false);
    setFeedback("已取消開始施法；戰鬥狀態沒有改變。");
  }

  function submitCasting(kind: "start" | "continue" | "cancel") {
    if (controlMutationBusy || !hasPlayerActionActor || (kind !== "start" && !currentCasting)
      || (kind === "start" && !isStartCastingConfirmationOpen)) return;
    setIsCastingMutation(true);
    focusStatusAfterCasting.current = true;
    setIsStartCastingConfirmationOpen(false);
    setCastingError(null);
    void executeCasting(kind, gameState.state.revision, kind === "start" ? "TEST-skill-2" : undefined)
      .then((response) => {
        onStateUpdate({ sandbox: response.sandbox, storage: response.storage, state: response.state });
        showNarration(response);
        setFeedback(response.effect.type === "casting-started" ? "已開始詠唱，本回合投入 6 MP。"
          : response.effect.type === "casting-continued" ? "已繼續詠唱，本回合投入 6 MP。"
            : response.effect.type === "casting-completed" ? "詠唱完成，總投入 18 MP；法術效果尚未裁定。"
              : "已取消詠唱；已投入的 MP 不會返還，現在可選擇主要行動。");
      }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : "詠唱操作未能完成，請重新讀取狀態。";
        setCastingError(message); setFeedback(message);
        try { onStateUpdate(await onRetryState()); } catch { /* 保留安全錯誤。 */ }
      }).finally(() => setIsCastingMutation(false));
  }

  function toggleBag() {
    if (mutationInFlight) return;
    if (isBagOpen) {
      restoreBagFocus.current = true;
      setIsBagOpen(false);
      setPendingItemId(null);
      setFeedback("已關閉戰鬥背包；戰鬥狀態沒有改變。");
      return;
    }
    setIsTargeting(false);
    setSelectedSkillId(null);
    setIsLoadingTargets(false);
    setTargetOptions(null);
    setIsRowMoveMode(false);
    setIsLoadingRowMoveOptions(false);
    setPendingItemId(null);
    setIsDefendConfirmationOpen(false);
    setIsRunConfirmationOpen(false);
    setIsBagOpen(true);
    setFeedback("");
  }

  function beginDefendConfirmation() {
    if (!canDefend || controlMutationBusy) return;
    setIsTargeting(false);
    setSelectedSkillId(null);
    setTargetOptions(null);
    setIsRowMoveMode(false);
    setPendingItemId(null);
    setIsBagOpen(false);
    setIsRunConfirmationOpen(false);
    setIsDefendConfirmationOpen(true);
    setFeedback("");
  }

  function beginRunConfirmation() {
    if (!canRun || controlMutationBusy) return;
    setIsTargeting(false);
    setSelectedSkillId(null);
    setTargetOptions(null);
    setIsRowMoveMode(false);
    setPendingItemId(null);
    setIsBagOpen(false);
    setIsDefendConfirmationOpen(false);
    setIsRunConfirmationOpen(true);
    setFeedback("");
  }

  function cancelRunConfirmation() {
    if (isSubmittingRun) return;
    restoreRunFocus.current = true;
    setIsRunConfirmationOpen(false);
    setFeedback("已取消逃跑；戰鬥狀態沒有改變。");
  }

  function confirmRun() {
    if (!isRunConfirmationOpen || !canRun || controlMutationBusy || runRequestInFlight.current) return;
    runRequestInFlight.current = true;
    setIsSubmittingRun(true);
    setFeedback("正在裁定逃跑……");
    void executeRun(gameState.state.revision).then((response) => {
      onStateUpdate({ sandbox: response.sandbox, storage: response.storage, state: response.state });
      showNarration(response);
      setIsRunConfirmationOpen(false);
      setFeedback(response.effect.outcome === "success" ? "逃跑成功；戰鬥已結束。" : "逃跑失敗；目前回合已結束。");
    }).catch(async (error: unknown) => {
      setIsRunConfirmationOpen(false);
      setFeedback(error instanceof Error ? error.message : "逃跑暫時無法使用，請重新讀取戰鬥狀態。");
      try {
        const latest = await onRetryState();
        onStateUpdate(latest);
      } catch {
        // Keep the last confirmed state and safe error.
      }
    }).finally(() => {
      runRequestInFlight.current = false;
      setIsSubmittingRun(false);
    });
  }

  function cancelDefendConfirmation() {
    if (isSubmittingDefend) return;
    restoreDefendFocus.current = true;
    setIsDefendConfirmationOpen(false);
    setFeedback("已取消防禦；戰鬥狀態沒有改變。");
  }

  function confirmDefend() {
    if (!isDefendConfirmationOpen || !canDefend || controlMutationBusy || defendRequestInFlight.current) return;
    defendRequestInFlight.current = true;
    setIsSubmittingDefend(true);
    setFeedback("正在提交防禦並結束目前回合……");
    void executeDefend(gameState.state.revision).then((response) => {
      onStateUpdate({ sandbox: response.sandbox, storage: response.storage, state: response.state });
      showNarration(response);
      setIsDefendConfirmationOpen(false);
      setFeedback("防禦行動已完成；目前回合已結束。實際減傷效果尚未接入。");
    }).catch(async (error: unknown) => {
      setIsDefendConfirmationOpen(false);
      setFeedback(error instanceof Error ? error.message : "防禦暫時無法使用，請重新讀取戰鬥狀態。");
      try {
        const latest = await onRetryState();
        onStateUpdate(latest);
      } catch {
        // Keep the last server-confirmed state and the safe action error.
      }
    }).finally(() => {
      defendRequestInFlight.current = false;
      setIsSubmittingDefend(false);
    });
  }

  function cancelItemConfirmation() {
    restoreBagUseFocus.current = true;
    setPendingItemId(null);
    setFeedback("已取消使用物品；戰鬥狀態沒有改變。");
  }

  function confirmItemUse(itemId: string) {
    if (!isBagOpen || pendingItemId !== itemId || requestInFlight
      || !isServerListedUsableCombatItem(bagOptions, itemId, gameState.state.revision, currentActorId)) return;
    setIsUsingItem(true);
    setBagOptionsError(null);
    setFeedback("正在提交物品使用並結束目前回合……");
    void executeCombatItemUse(gameState.state.revision, itemId).then((response) => {
      onStateUpdate({ sandbox: response.sandbox, storage: response.storage, state: response.state });
      showNarration(response);
      setBagOptions(response.options);
      setPendingItemId(null);
      bagHeading.current?.focus();
      setFeedback("物品已使用；目前回合已結束。");
    }).catch(async (error: unknown) => {
      setPendingItemId(null);
      setFeedback(error instanceof Error ? error.message : "物品暫時無法使用，請重新讀取戰鬥狀態。");
      try {
        const latest = await onRetryState();
        onStateUpdate(latest);
      } catch {
        // Keep the safe action error and the last server-confirmed quantity.
      }
      setBagOptionsReloadId((value) => value + 1);
    }).finally(() => setIsUsingItem(false));
  }

  function cancelTargeting() {
    restoreAttackFocus.current = true;
    setIsTargeting(false);
    setIsLoadingTargets(false);
    setTargetOptions(null);
    setFeedback("已取消選擇目標；戰鬥狀態沒有改變。");
  }

  function beginTargetSelection() {
    if (!canPlayerAttack || requestInFlight || isRowMoveMode) return;
    setIsTargeting(true);
    setSelectedSkillId(null);
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
      || requestInFlight || isRowMoveMode) return;
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
      showNarration(response);
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

  function beginSkillTargetSelection(skillId: string) {
    const option = skillOptions?.skills.find((entry) => entry.skillId === skillId);
    if (!option?.usable || skillOptions?.revision !== gameState.state.revision
      || skillOptions.currentActorId !== currentActorId || controlMutationBusy) return;
    setIsTargeting(false);
    setTargetOptions(null);
    setIsRowMoveMode(false);
    setIsBagOpen(false);
    setPendingItemId(null);
    setIsDefendConfirmationOpen(false);
    setIsRunConfirmationOpen(false);
    setSelectedSkillId(skillId);
    setSkillUseError(null);
    setFeedback("");
  }

  function cancelSkillTargetSelection() {
    if (isUsingSkill) return;
    restoreSkillFocus.current = true;
    setSelectedSkillId(null);
    setFeedback("已取消選擇技能目標；戰鬥狀態沒有改變。");
  }

  function selectSkillTarget(targetId: string) {
    if (!selectedSkillId || !selectedSkill?.usable || !skillTargetsById.get(targetId)?.legal
      || skillOptions?.revision !== gameState.state.revision
      || skillOptions.currentActorId !== currentActorId || controlMutationBusy) return;
    setIsUsingSkill(true);
    setSelectedSkillId(null);
    setSkillUseError(null);
    setFeedback("正在由戰鬥系統裁定物理技能……");
    void executePhysicalSkill(gameState.state.revision, selectedSkillId, targetId).then((response) => {
      onStateUpdate({ sandbox: response.sandbox, storage: response.storage, state: response.state });
      showNarration(response);
      setFeedback(response.effect.outcome === "hit" ? "物理技能裁定完成：命中。" : "物理技能裁定完成：未命中。");
    }).catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : "物理技能暫時無法使用，請重新讀取戰鬥狀態。";
      setSkillUseError(message);
      setFeedback(message);
      try {
        const latest = await onRetryState();
        onStateUpdate(latest);
      } catch { /* 保留最後確認的狀態與安全訊息。 */ }
      setSkillOptionsReloadId((value) => value + 1);
    }).finally(() => setIsUsingSkill(false));
  }

  function beginRowMoveSelection() {
    if (!canPlayerMoveRow || requestInFlight || isTargeting) return;
    setIsRowMoveMode(true);
    setSelectedSkillId(null);
    setFeedback("");
  }

  function cancelRowMove() {
    restoreRowMoveFocus.current = true;
    setIsRowMoveMode(false);
    setFeedback("已取消換排；戰鬥狀態沒有改變。");
  }

  function confirmRowMove(targetRow: CombatRow) {
    if (!isRowMoveMode || !currentActor || requestInFlight || rowMoveRequestInFlight.current
      || !isServerListedLegalTargetRow(
        rowMoveOptions,
        targetRow,
        gameState.state.revision,
        currentActorId,
        currentActor.row,
      )) return;
    rowMoveRequestInFlight.current = true;
    setIsMovingRow(true);
    setFeedback("正在提交換排並結束目前回合……");
    void executeRowMove(gameState.state.revision, targetRow).then((response) => {
      onStateUpdate({ sandbox: response.sandbox, storage: response.storage, state: response.state });
      showNarration(response);
      setIsRowMoveMode(false);
      setIsDefendConfirmationOpen(false);
      setRowMoveOptions(null);
      setFeedback("換排完成；目前回合已結束。");
    }).catch(async (error: unknown) => {
      setIsRowMoveMode(false);
      setIsDefendConfirmationOpen(false);
      setRowMoveOptions(null);
      setFeedback(error instanceof Error ? error.message : "移動暫時無法使用，請重新讀取戰鬥狀態。");
      try {
        const latest = await onRetryState();
        onStateUpdate(latest);
      } catch {
        // Keep the safe action error; the refresh control remains available.
      }
      setRowMoveOptionsReloadId((value) => value + 1);
    }).finally(() => {
      rowMoveRequestInFlight.current = false;
      setIsMovingRow(false);
    });
  }

  function advanceTestTurn() {
    if (!gameState.sandbox || debugDisabled || pacing.phase !== "error" || debugRequestInFlight.current
      || currentActor?.side !== "enemy") return;
    debugRequestInFlight.current = true;
    setIsAdvancing(true);
    setFeedback("正在請裁判推進 TEST 回合……");
    void advanceTestCombatTurn(gameState.state.revision).then((response) => {
      setIsTargeting(false);
      setSelectedSkillId(null);
      setTargetOptions(null);
      setIsRowMoveMode(false);
      setIsDefendConfirmationOpen(false);
      onStateUpdate({ sandbox: response.sandbox, storage: response.storage, state: response.state });
      setFeedback("TEST 回合已由權威戰鬥引擎推進。");
    }).catch(() => {
      setFeedback("目前無法推進 TEST 戰鬥回合。請重新讀取狀態後再試。");
    }).finally(() => { debugRequestInFlight.current = false; setIsAdvancing(false); });
  }

  function actCompanionTurn() {
    if (!gameState.sandbox || debugDisabled || pacing.phase !== "error" || debugRequestInFlight.current
      || currentActor?.controlledBy !== "companion") return;
    debugRequestInFlight.current = true;
    setIsAdvancing(true);
    setFeedback("正在請伺服器執行 TEST 隊友回合並整理戰鬥敘事……");
    void executeCompanionTurn(gameState.state.revision).then((response) => {
      onStateUpdate({ sandbox: response.sandbox, storage: response.storage, state: response.state });
      showNarration(response);
      setFeedback(response.effect.selectedAction === "normal-attack"
        ? "TEST 隊友自主選擇：普通攻擊。" : "TEST 隊友自主選擇：防禦。");
    }).catch((error: unknown) => {
      setFeedback(error instanceof Error ? error.message : "隊友回合暫時無法執行。");
    }).finally(() => { debugRequestInFlight.current = false; setIsAdvancing(false); });
  }

  function retryState() {
    if (requestInFlight) return;
    setIsRetrying(true);
    setFeedback("正在重新讀取戰鬥狀態……");
    void onRetryState().then((next) => {
      setIsTargeting(false);
      setSelectedSkillId(null);
      setTargetOptions(null);
      setIsRowMoveMode(false);
      setIsDefendConfirmationOpen(false);
      setRowMoveOptionsReloadId((value) => value + 1);
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
              <p>目前行動：<strong>{visualActor?.displayName ?? combat.currentActorId}</strong></p>
            </div>
            <CombatTurnOrder state={combat} visualActorId={visualActorId} />
          </section>
        </header>

        <div className="combat-layout">
          <section className="combat-battlefield" aria-labelledby="battlefield-heading">
            <div className="combat-section-heading">
              <div><p className="combat-eyebrow">戰場</p><h2 id="battlefield-heading">參戰者位置</h2></div>
              <p>排位來自權威狀態；完成換排會消耗整個回合。</p>
            </div>
            {selectedSkillId ? (
              <section className="combat-target-mode" aria-labelledby="combat-skill-target-heading" aria-live="polite">
                <h3 id="combat-skill-target-heading" ref={skillTargetHeading} tabIndex={-1}>請選擇技能目標</h3>
                <p>{selectedSkill?.displayName ?? selectedSkillId}・只可指定合法敵方目標。</p>
                <Button variant="secondary" onClick={cancelSkillTargetSelection} disabled={isUsingSkill}>取消</Button>
              </section>
            ) : null}
            {isBagOpen ? (
              <section id="combat-bag-panel" className="combat-bag-mode" aria-labelledby="combat-bag-heading" aria-live="polite">
                <div className="combat-bag-mode__heading">
                  <div>
                    <p className="combat-eyebrow">只讀查看</p>
                    <h3 id="combat-bag-heading" ref={bagHeading} tabIndex={-1}>戰鬥背包</h3>
                  </div>
                </div>
                {isLoadingBagOptions ? <p className="combat-bag-mode__notice">正在讀取背包狀態……</p> : null}
                {bagOptionsError ? (
                  <div className="combat-bag-mode__error" role="alert">
                    <p>{bagOptionsError}</p>
                    <Button
                      variant="secondary"
                      disabled={isUsingItem || isLoadingBagOptions}
                      onClick={() => setBagOptionsReloadId((value) => value + 1)}
                    >
                      重新讀取背包
                    </Button>
                  </div>
                ) : null}
                {gameState.state.inventory.length > 0 ? (
                  <ul className="combat-bag-list">
                    {gameState.state.inventory.map((stack) => {
                      const item = bagOptions?.items.find((entry) => entry.itemId === stack.itemId);
                      const optionsMatch = bagOptions?.revision === gameState.state.revision
                        && bagOptions.currentActorId === currentActorId;
                      const canUse = optionsMatch && item?.usable === true
                        && isServerListedUsableCombatItem(
                          bagOptions, stack.itemId, gameState.state.revision, currentActorId,
                        );
                      const disabledReason = item?.unavailableReason === "not-player-turn"
                        ? "目前不是可操作角色的回合。"
                        : item?.unavailableReason === "casting-active" ? "請先繼續或取消詠唱。"
                        : item?.unavailableReason === "quantity-depleted"
                          ? "數量為 0，無法使用。"
                          : bagOptionsError ? "目前無法確認物品是否可使用。"
                            : isLoadingBagOptions ? "正在確認物品是否可使用。"
                                : !optionsMatch ? "戰鬥狀態已更新，正在確認物品。"
                                  : !item ? "目前無法確認這件物品是否可使用。" : "";
                      const itemName = item?.displayName ?? getCombatItemDisplayName(stack.itemId) ?? stack.itemId;
                      const disabledReasonId = "combat-item-disabled-reason-" + stack.itemId;
                      return (
                        <li key={stack.itemId} className="combat-bag-item">
                          <div className="combat-bag-item__summary">
                            <h4>{itemName}</h4>
                            <p>數量：{stack.quantity}</p>
                          </div>
                          {pendingItemId === stack.itemId ? (
                            <div className="combat-item-confirm" role="group" aria-label="確認使用物品">
                              <p>確定使用 {itemName}？</p>
                              <div className="combat-item-confirm__buttons">
                                <Button
                                  ref={itemConfirmButton}
                                  variant="primary"
                                  disabled={!canUse || requestInFlight}
                                  loading={isUsingItem}
                                  loadingLabel="正在使用……"
                                  onClick={() => confirmItemUse(stack.itemId)}
                                >
                                  確認使用
                                </Button>
                                <Button variant="secondary" disabled={isUsingItem} onClick={cancelItemConfirmation}>
                                  取消
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="combat-bag-item__action">
                              <Button
                                ref={bagUseButton}
                                variant="secondary"
                                data-item-use={stack.itemId}
                                disabled={!canUse || requestInFlight}
                                aria-describedby={disabledReason ? disabledReasonId : undefined}
                                onClick={() => setPendingItemId(stack.itemId)}
                              >
                                使用
                              </Button>
                              {disabledReason ? <p id={disabledReasonId}>{disabledReason}</p> : null}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : <p className="combat-bag-mode__notice">目前沒有物品。</p>}
                <div className="combat-bag-mode__footer">
                  <Button variant="secondary" disabled={isUsingItem} onClick={toggleBag}>關閉</Button>
                </div>
              </section>
            ) : null}
            {isTargeting ? (
              <section className="combat-target-mode" aria-labelledby="combat-target-heading" aria-live="polite">
                <div>
                  <h3 id="combat-target-heading">請選擇攻擊目標</h3>
                  <p>{isLoadingTargets ? "正在讀取合法目標……" : "只有伺服器列出的合法敵人可以選擇。"}</p>
                </div>
                <Button variant="secondary" disabled={isResolving} onClick={cancelTargeting}>取消</Button>
              </section>
            ) : null}
            {isRowMoveMode && rowMoveOptions ? (
              <section className="combat-row-move-mode" aria-labelledby="combat-row-move-heading" aria-live="polite">
                <div className="combat-row-move-mode__intro">
                  <h3 id="combat-row-move-heading" ref={rowMoveHeading} tabIndex={-1}>
                    目前位置：我方{rowMoveOptions.currentRow === "front" ? "前排" : "後排"}
                  </h3>
                  <p>確認後會移動排位並結束目前回合。</p>
                </div>
                <div className="combat-row-move-mode__choices">
                  {rowMoveOptions.legalTargetRows.map((targetRow) => (
                    <Button
                      key={targetRow}
                      variant="primary"
                      data-target-row={targetRow}
                      disabled={requestInFlight}
                      loading={isMovingRow}
                      loadingLabel="正在移動……"
                      onClick={() => confirmRowMove(targetRow)}
                    >
                      移至{targetRow === "front" ? "前排" : "後排"}
                    </Button>
                  ))}
                  <Button variant="secondary" disabled={isMovingRow} onClick={cancelRowMove}>取消</Button>
                </div>
              </section>
            ) : null}
            {isDefendConfirmationOpen ? (
              <section id="combat-defend-panel" className="combat-row-move-mode" aria-labelledby="combat-defend-heading" aria-live="polite">
                <div className="combat-row-move-mode__intro">
                  <h3 id="combat-defend-heading" ref={defendHeading} tabIndex={-1}>確定要選擇防禦嗎？</h3>
                  <p>防禦會消耗目前行動。實際減傷效果尚未接入。</p>
                </div>
                <div className="combat-row-move-mode__choices">
                  <Button
                    variant="primary"
                    data-action="confirm-defend"
                    disabled={controlMutationBusy}
                    loading={isSubmittingDefend}
                    loadingLabel="正在防禦……"
                    onClick={confirmDefend}
                  >
                    確認防禦
                  </Button>
                  <Button variant="secondary" disabled={isSubmittingDefend} onClick={cancelDefendConfirmation}>取消</Button>
                </div>
              </section>
            ) : null}
            {isRunConfirmationOpen ? (
              <section id="combat-run-panel" className="combat-row-move-mode" aria-labelledby="combat-run-heading" aria-live="polite">
                <div className="combat-row-move-mode__intro">
                  <h3 id="combat-run-heading" ref={runHeading} tabIndex={-1}>確定要嘗試逃跑嗎？</h3>
                  <p>逃跑會消耗目前行動。</p>
                  <p>一般逃跑判定：D20 + 敏捷修正，DC 8。</p>
                </div>
                <div className="combat-row-move-mode__choices">
                  <Button variant="primary" data-action="confirm-run" disabled={controlMutationBusy}
                    loading={isSubmittingRun} loadingLabel="正在逃跑……" onClick={confirmRun}>確認逃跑</Button>
                  <Button variant="secondary" disabled={isSubmittingRun} onClick={cancelRunConfirmation}>取消</Button>
                </div>
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
                          current={participant.id === visualActorId}
                          targeting={(isTargeting && !isLoadingTargets) || selectedSkillId !== null}
                          targetOption={selectedSkillId ? skillTargetsById.get(participant.id) : targetOptionsById.get(participant.id)}
                          canSubmitTarget={!requestInFlight}
                          onSelectTarget={selectedSkillId ? selectSkillTarget : selectTarget}
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
              <h2 id="combat-status-heading" ref={statusHeading} tabIndex={-1}>目前狀態</h2>
              <dl className="combat-status-list">
                <div><dt>回合</dt><dd>第 {combat.round} 回合</dd></div>
                <div><dt>目前行動</dt><dd>{visualActor?.displayName ?? combat.currentActorId}</dd></div>
                <div><dt>參戰者</dt><dd>{combat.participants.length} 名</dd></div>
                <div><dt>活動</dt><dd>戰鬥中</dd></div>
                <div><dt>MP</dt><dd>{gameState.state.character.currentMp} <small>（TEST 數值）</small></dd></div>
                <div><dt>工程版本</dt><dd>{gameState.state.revision}</dd></div>
              </dl>
            </Panel>

            <LastActionPanel combat={combat} />

            {combat.activeCastings.map((casting) => <Panel key={casting.actorId} className="combat-rail__panel" aria-live="polite" aria-labelledby={`casting-${casting.actorId}`}>
              <p className="combat-eyebrow">權威詠唱進度</p>
              <h2 id={`casting-${casting.actorId}`}>正在詠唱：TEST 多回合法術</h2>
              <p>進度：{casting.completedCastingTurns} / {casting.totalCastingTurns}</p>
              <p>已投入：{casting.mpSpent} / {casting.totalMpCost} MP</p>
              <p>下一次繼續：6 MP</p>
              {casting.actorId === currentActorId && hasPlayerActionActor ? <div className="combat-row-move-mode__choices">
                <Button variant="primary" disabled={controlMutationBusy} onClick={() => submitCasting("continue")}>繼續詠唱</Button>
                <Button variant="secondary" disabled={controlMutationBusy} onClick={() => submitCasting("cancel")}>取消詠唱</Button>
              </div> : <p>等待施法者的下一個回合。</p>}
              <p>取消後，已投入的 MP 不會返還。</p>
            </Panel>)}

            <Panel className="combat-rail__panel" aria-labelledby="combat-narration-heading">
              <p className="combat-eyebrow">AI 戰鬥敘事</p>
              <h2 id="combat-narration-heading">最近敘事</h2>
              <div className="combat-narration" aria-live="polite" aria-atomic="true">
                {narrationEntry?.revision === gameState.state.revision
                  ? <><p>{narrationEntry.narration.text}</p>
                    {narrationEntry.narration.source === "fallback"
                      ? <small>系統敘述</small> : null}</>
                  : isResolving || isMovingRow || isUsingItem || isSubmittingDefend || isSubmittingRun
                    || isUsingSkill || isCastingMutation || isUsingBreath
                    || (isAdvancing && currentActor?.controlledBy === "companion")
                    ? <p>正在整理戰鬥敘事……</p> : <p>目前沒有戰鬥敘事。</p>}
              </div>
            </Panel>

            <Panel className="combat-rail__panel" aria-labelledby="combat-skills-heading">
              <p className="combat-eyebrow">技能</p>
              <h2 id="combat-skills-heading">已裝備技能</h2>
              <section className="combat-innate-ability" aria-labelledby="combat-innate-heading">
                <h3 id="combat-innate-heading">天生能力</h3>
                <Button ref={breathButton} variant="secondary" aria-expanded={isBreathRowSelectionOpen}
                  aria-controls="combat-breath-rows"
                  disabled={!breathOptions?.available || controlMutationBusy || selectionModeActive}
                  onClick={beginBreathRowSelection}>
                  龍息{breathOptions?.element === "fire" ? "・火" : breathOptions?.element === "ice" ? "・冰"
                    : breathOptions?.element === "lightning" ? "・雷" : ""}
                </Button>
                <p>敵方前／後排 AoE・{breathOptions?.available ? "可使用"
                  : breathOptions?.unavailableReason === "ability-on-cooldown" ? `冷卻中・第 ${breathOptions.readyRound} 回合可再次使用`
                    : breathOptions?.unavailableReason === "casting-active" ? "請先繼續或取消詠唱"
                      : breathOptions?.unavailableReason === "not-player-turn" ? "等待玩家回合"
                        : breathOptions?.unavailableReason === "not-dragonborn" ? "只有龍裔可使用"
                          : breathOptions?.unavailableReason === "element-unresolved" ? "龍息元素尚未確定"
                            : breathOptions?.unavailableReason === "no-target-row" ? "目前沒有可攻擊目標"
                              : breathOptionsError ?? "正在讀取狀態"}</p>
                {breathOptionsError ? <Button variant="secondary" onClick={() => setBreathReloadId((value) => value + 1)}>
                  重新讀取龍息狀態
                </Button> : null}
                {isBreathRowSelectionOpen ? <div id="combat-breath-rows" className="combat-row-move-mode" aria-live="polite">
                  <h3 ref={breathHeading} tabIndex={-1}>選擇攻擊區域</h3>
                  <div className="combat-row-move-mode__choices">
                    {breathOptions?.rows.map((row) => <div key={row.row}>
                      <Button variant="secondary" disabled={!row.available || controlMutationBusy}
                        onClick={() => selectBreathRow(row.row)}>
                        敵方{row.row === "front" ? "前排" : "後排"}（{row.targetCount}）
                      </Button>
                      {!row.available ? <p>該排目前沒有可攻擊目標。</p> : null}
                    </div>)}
                    <Button variant="secondary" disabled={controlMutationBusy} onClick={cancelBreathRowSelection}>取消</Button>
                  </div>
                </div> : null}
              </section>
              {gameState.state.character.equippedSkillIds.length > 0 ? (
                <ul className="combat-skill-list">{gameState.state.character.equippedSkillIds.map((skillId) => {
                  const option = skillOptions?.revision === gameState.state.revision
                    && skillOptions.currentActorId === currentActorId
                    ? skillOptions.skills.find((entry) => entry.skillId === skillId) : undefined;
                  const reason = option?.unavailableReason === "skill-on-cooldown"
                    ? `冷卻中・第 ${option.readyRound} 回合可再次使用`
                    : option?.unavailableReason === "casting-active" ? "請先繼續或取消詠唱"
                    : option?.unavailableReason === "not-player-turn" ? "目前不是可操作角色的回合"
                      : option?.unavailableReason === "no-legal-target" ? "目前沒有合法目標"
                        : skillOptionsError ? skillOptionsError : isLoadingSkillOptions || (skillId === "TEST-skill-1" && !option)
                          ? "正在確認技能狀態" : !option ? "此技能尚未支援戰鬥使用" : "可使用";
                  if (skillId === "TEST-skill-2") {
                    const available = hasPlayerActionActor && !currentCasting && gameState.state.character.currentMp >= 18;
                    const reason = currentCasting ? "請先繼續或取消詠唱"
                      : !hasPlayerActionActor ? "目前不是可操作角色的回合"
                        : gameState.state.character.currentMp < 18 ? "MP 不足" : "可開始詠唱";
                    return <li key={skillId} className="combat-skill-item">
                      <Button ref={castingButton} variant="secondary" data-skill={skillId}
                        disabled={!available || requestInFlight || selectionModeActive}
                        onClick={beginCastingConfirmation}>TEST 多回合法術</Button>
                      <p>魔法主動・18 MP・3 回合詠唱・{reason}</p><small>{skillId}</small>
                    </li>;
                  }
                  return <li key={skillId} className="combat-skill-item">
                    {option ? <Button ref={skillId === "TEST-skill-1" ? skillButton : undefined} variant="secondary"
                      data-skill={skillId} disabled={!option.usable || requestInFlight || selectionModeActive}
                      onClick={() => beginSkillTargetSelection(skillId)}>{option.displayName}</Button>
                      : <span>{skillId === "TEST-skill-1" ? "TEST 物理技能" : skillId}</span>}
                    <p>{option || skillId === "TEST-skill-1" ? "物理主動" : "未接入"}・{reason}</p>
                    <small>{skillId}</small>
                  </li>;
                })}</ul>
              ) : <p>目前沒有已裝備的測試技能。</p>}
              {skillUseError ? <p className="combat-feedback__error" role="alert">{skillUseError}</p> : null}
              {castingError ? <p className="combat-feedback__error" role="alert">{castingError}</p> : null}
              {isStartCastingConfirmationOpen ? <section className="combat-row-move-mode" aria-labelledby="casting-start-heading" aria-live="polite">
                <h3 id="casting-start-heading" ref={castingHeading} tabIndex={-1}>開始詠唱？</h3>
                <p>總消耗：18 MP・詠唱：3 回合・本回合消耗：6 MP。</p>
                <p>開始後本回合主要行動將結束。</p>
                <div className="combat-row-move-mode__choices">
                  <Button variant="primary" disabled={controlMutationBusy} onClick={() => submitCasting("start")}>確認開始</Button>
                  <Button variant="secondary" disabled={controlMutationBusy} onClick={cancelCastingConfirmation}>取消</Button>
                </div>
              </section> : null}
              {skillOptionsError ? <Button variant="secondary" disabled={isLoadingSkillOptions}
                onClick={() => setSkillOptionsReloadId((value) => value + 1)}>重新讀取技能</Button> : null}
            </Panel>

            <Panel className="combat-rail__panel" aria-labelledby="combat-commands-heading">
              <p className="combat-eyebrow">指令</p>
              <h2 id="combat-commands-heading">基本指令</h2>
              <p className="combat-rail__notice">主要行動依目前回合開放；隊伍資訊與偏好設定不消耗回合。</p>
              <div className="combat-commands">
                <Button
                  ref={attackButton}
                  variant="primary"
                  data-command="attack"
                  disabled={!canPlayerAttack || requestInFlight || selectionModeActive}
                  loading={isResolving}
                  loadingLabel="正在裁定……"
                  onClick={beginTargetSelection}
                >
                  普通攻擊
                </Button>
                <Button
                  ref={defendButton}
                  variant="secondary"
                  data-command="defend"
                  disabled={!canDefend || controlMutationBusy || isDefendConfirmationOpen || isStartCastingConfirmationOpen || selectionModeActive}
                  aria-expanded={isDefendConfirmationOpen}
                  aria-controls="combat-defend-panel"
                  onClick={beginDefendConfirmation}
                >
                  防禦
                </Button>
                <Button variant="secondary" data-command="rescue" aria-expanded={isRescueOpen}
                  aria-controls="combat-rescue-panel"
                  disabled={!hasPlayerActionActor || rescueTargets.length === 0 || controlMutationBusy || selectionModeActive}
                  onClick={() => setIsRescueOpen(true)}>救助</Button>
                <Button
                  ref={bagButton}
                  variant="primary"
                  data-command="inventory"
                  disabled={mutationInFlight || Boolean(currentCasting) || isStartCastingConfirmationOpen}
                  aria-expanded={isBagOpen}
                  aria-controls="combat-bag-panel"
                  onClick={toggleBag}
                >
                  {isBagOpen ? "關閉背包" : "背包"}
                </Button>
                <Button
                  ref={partyButton}
                  variant="primary"
                  data-command="party"
                  disabled={mutationInFlight}
                  aria-expanded={isPartyOpen}
                  aria-controls="combat-party-dialog"
                  onClick={toggleParty}
                >
                  隊伍
                </Button>
                <Button
                  ref={rowMoveButton}
                  variant="primary"
                  data-command="move"
                  disabled={!canPlayerMoveRow || requestInFlight || selectionModeActive}
                  loading={isLoadingRowMoveOptions}
                  loadingLabel="讀取移動選項……"
                  onClick={beginRowMoveSelection}
                >
                  站位
                </Button>
                <Button
                  ref={runButton}
                  variant="secondary"
                  data-command="flee"
                  disabled={!canRun || controlMutationBusy || selectionModeActive}
                  aria-expanded={isRunConfirmationOpen}
                  aria-controls="combat-run-panel"
                  onClick={beginRunConfirmation}
                >
                  逃跑
                </Button>
              </div>
              {isRescueOpen ? <section id="combat-rescue-panel" className="combat-row-move-mode" aria-label="選擇救助目標" aria-live="polite">
                <h3>選擇瀕死隊員</h3>
                <p>救助會恢復至 1 HP，並消耗目前主要行動。</p>
                <div className="combat-row-move-mode__choices">
                  {rescueTargets.map((target) => <Button key={target.id} variant="primary"
                    data-rescue-target={target.id} disabled={controlMutationBusy}
                    loading={isRescuing} loadingLabel="正在救助……"
                    onClick={() => submitRescue(target.id)}>
                    救助{target.displayName}・剩餘 {target.health.dyingTurnsRemaining} 回合
                  </Button>)}
                  <Button variant="secondary" disabled={isRescuing} onClick={() => setIsRescueOpen(false)}>取消</Button>
                </div>
              </section> : null}
              {hasPlayerActionActor && !rowMoveOptions && !isLoadingRowMoveOptions ? (
                <Button
                  variant="secondary"
                  data-command="move-options-retry"
                  disabled={requestInFlight || selectionModeActive}
                  onClick={() => {
                    setFeedback("正在重新取得伺服器提供的換排選項……");
                    setRowMoveOptionsReloadId((value) => value + 1);
                  }}
                >
                  重新載入移動選項
                </Button>
              ) : null}
                  {currentActor?.side === "enemy" ? <p className="combat-rail__notice">{gameState.sandbox ? "TEST 敵方回合；只推進權威順序，不產生敵方攻擊或敘事。" : "目前是敵方回合，玩家不能執行攻擊、移動或防禦。"}</p> : null}
              {currentActor?.controlledBy === "companion" ? <p className="combat-rail__notice">目前是 TEST 隊友回合；伺服器會自行選擇行動與目標。</p> : null}
            </Panel>

            {gameState.sandbox ? (
              <Panel className="combat-rail__panel combat-test-controls" aria-labelledby="combat-test-heading">
                <p className="combat-eyebrow">工程測試</p>
                <h2 id="combat-test-heading">TEST 控制</h2>
                <p>此控制只在 COMBAT_SANDBOX 開啟時出現，並由後端決定下一回合。</p>
                {currentActor?.controlledBy === "companion" ? (
                  <Button loading={isAdvancing} loadingLabel="正在執行……" disabled={debugDisabled || pacing.phase !== "error" || selectionModeActive}
                    onClick={actCompanionTurn}>TEST：執行隊友回合</Button>
                ) : (
                  <Button loading={isAdvancing} loadingLabel="正在推進……" disabled={debugDisabled || pacing.phase !== "error" || selectionModeActive || Boolean(currentCasting)} onClick={advanceTestTurn}>TEST：推進下一回合</Button>
                )}
              </Panel>
            ) : null}
          </aside>
        </div>

        <section className="combat-feedback" aria-label="戰鬥狀態回饋">
          {pacing.phase !== "idle" && pacing.phase !== "error" ? <p>{pacing.phase === "pre-action" ? "目前角色準備行動……" : pacing.phase === "resolving" ? "伺服器正在裁定……" : pacing.phase === "transitioning" ? "行動順序輪轉中……" : "正在顯示最近結果……"}</p> : null}
          {pacing.error ? <p className="combat-feedback__error" role="alert">{pacing.error}</p> : null}
          {pacing.error ? <Button variant="secondary" disabled={pacing.inFlight} onClick={() => void pacing.retry()}>重新讀取並恢復回合</Button> : null}
          {feedback ? <p role="status" aria-live="polite">{feedback}</p> : null}
          {stateError ? <p className="combat-feedback__error" role="alert">目前無法讀取戰鬥狀態。</p> : null}
          <Button variant="secondary" loading={isRetrying} loadingLabel="正在讀取……" disabled={requestInFlight && !isRetrying} onClick={retryState}>重新讀取戰鬥狀態</Button>
        </section>
      </div>
      <CombatPartyDialog open={isPartyOpen} party={partyOptions} loading={isLoadingParty}
        error={partyError} busy={partyMutationCompanionId !== null || pacing.inFlight} status={partyStatus}
        onClose={closeParty} onClosed={restoreFocusToPartyButton}
        onRetry={retryParty} onPreferenceChange={changePartyPreference} />
    </main>
  );
}
