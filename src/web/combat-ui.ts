import type { AuthoritativeGameStateResponse, CombatParticipantView, CombatStateView } from "../shared/game-state.js";

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
  { id: "attack", label: "普通攻擊" },
  { id: "defend", label: "防禦" },
  { id: "inventory", label: "背包" },
  { id: "party", label: "隊伍" },
  { id: "move", label: "站位／移動" },
  { id: "flee", label: "逃走" },
] as const);

const presentationFixture: Readonly<Record<string, CombatPresentationLaneId>> = Object.freeze({
  "TEST-player": "party-front",
  "TEST-enemy-1": "enemy-front",
  "TEST-enemy-2": "enemy-back",
});

const laneLabels: Readonly<Record<CombatPresentationLaneId, string>> = Object.freeze({
  "enemy-back": "敵方後排",
  "enemy-front": "敵方前排",
  "party-front": "我方前排",
  "party-back": "我方後排",
});

const laneOrder: readonly CombatPresentationLaneId[] = ["enemy-back", "enemy-front", "party-front", "party-back"];

/** Phase 12 畫面 fixture；不讀寫 GameState，也不代表正式前後排規則。 */
export function getTestPresentationLanes(
  participants: readonly CombatParticipantView[],
): readonly CombatPresentationLane[] {
  const grouped: Record<CombatPresentationLaneId, CombatParticipantView[]> = {
    "enemy-back": [], "enemy-front": [], "party-front": [], "party-back": [],
  };
  for (const participant of participants) {
    const lane = presentationFixture[participant.id]
      ?? (participant.side === "enemy" ? "enemy-front" : "party-front");
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

export function applicationMode(response: AuthoritativeGameStateResponse): "exploration" | "combat" {
  return response.state.activity === "in-combat" ? "combat" : "exploration";
}
