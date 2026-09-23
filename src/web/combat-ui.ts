import type {
  AuthoritativeGameStateResponse,
  CombatParticipantView,
  CombatRow,
  CombatStateView,
  NormalAttackOptionsResponse,
  RowMoveOptionsResponse,
} from "../shared/game-state.js";

export type CombatPresentationLaneId = "enemy-back" | "enemy-front" | "party-front" | "party-back";

export interface CombatPresentationLane {
  readonly id: CombatPresentationLaneId;
  readonly label: string;
  readonly participants: readonly CombatParticipantView[];
}

export interface TurnOrderEntry {
  readonly participant: CombatParticipantView;
  readonly current: boolean;
}

export const disabledCombatCommands = Object.freeze([
  { id: "defend", label: "防禦" },
  { id: "inventory", label: "背包" },
  { id: "party", label: "隊伍" },
  { id: "flee", label: "逃走" },
] as const);

const laneLabels: Readonly<Record<CombatPresentationLaneId, string>> = Object.freeze({
  "enemy-back": "敵方後排",
  "enemy-front": "敵方前排",
  "party-front": "我方前排",
  "party-back": "我方後排",
});

const laneOrder: readonly CombatPresentationLaneId[] = ["enemy-back", "enemy-front", "party-front", "party-back"];

/** Participant card placement comes only from authoritative side + row. */
export function getCombatPresentationLanes(
  participants: readonly CombatParticipantView[],
): readonly CombatPresentationLane[] {
  const grouped: Record<CombatPresentationLaneId, CombatParticipantView[]> = {
    "enemy-back": [], "enemy-front": [], "party-front": [], "party-back": [],
  };
  for (const participant of participants) {
    const lane: CombatPresentationLaneId = participant.side + "-" + participant.row as CombatPresentationLaneId;
    grouped[lane].push(participant);
  }
  return laneOrder.map((id) => ({ id, label: laneLabels[id], participants: grouped[id] }));
}

/** 完全保留 CombatState.turnOrder；不可由 React 重新依 total 排序。 */
export function getTurnOrderEntries(combat: CombatStateView): readonly TurnOrderEntry[] {
  const participants = new Map(combat.participants.map((participant) => [participant.id, participant]));
  return combat.turnOrder.map((id) => {
    const participant = participants.get(id);
    if (!participant) throw new Error("已驗證的 CombatState 缺少 turn order participant。");
    return { participant, current: id === combat.currentActorId };
  });
}

export function initiativeDetail(participant: CombatParticipantView): string {
  const modifier = participant.initiative.dexterityModifier >= 0
    ? `+ ${participant.initiative.dexterityModifier}`
    : `− ${Math.abs(participant.initiative.dexterityModifier)}`;
  return `${participant.initiative.baseD20} ${modifier} = ${participant.initiative.total}`;
}

export function canPlayerUseNormalAttack(combat: CombatStateView, requestInFlight: boolean): boolean {
  const actor = combat.participants.find((participant) => participant.id === combat.currentActorId);
  return !requestInFlight && actor?.side === "party" && actor.normalAttack !== null;
}

export function canPlayerUseRowMove(
  combat: CombatStateView,
  options: RowMoveOptionsResponse | null,
  revision: number,
  requestInFlight: boolean,
): boolean {
  const actor = combat.participants.find((participant) => participant.id === combat.currentActorId);
  return !requestInFlight && actor?.side === "party" && actor.normalAttack !== null
    && options !== null && options.revision === revision
    && options.currentActorId === actor.id && options.currentRow === actor.row
    && options.canPlayerAct && options.legalTargetRows.length > 0;
}

/** UI may submit only a target that the backend listed as legal for this exact revision. */
export function isServerListedLegalTarget(
  options: NormalAttackOptionsResponse | null,
  targetId: string,
  expectedRevision: number,
): boolean {
  return options !== null && options.revision === expectedRevision && options.canPlayerAct
    && options.legalTargetIds.includes(targetId)
    && options.targets.some((target) => target.targetId === targetId && target.legal);
}

export function isServerListedLegalTargetRow(
  options: RowMoveOptionsResponse | null,
  targetRow: CombatRow,
  expectedRevision: number,
  currentActorId: string,
  currentRow: CombatRow,
): boolean {
  return options !== null && options.revision === expectedRevision
    && options.currentActorId === currentActorId && options.currentRow === currentRow
    && options.canPlayerAct && options.legalTargetRows.includes(targetRow);
}

export function applicationMode(response: AuthoritativeGameStateResponse): "exploration" | "combat" {
  return response.state.activity === "in-combat" ? "combat" : "exploration";
}
