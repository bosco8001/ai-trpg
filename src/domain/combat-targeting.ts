import type {
  CombatParticipant,
  CombatState,
  NormalAttackRange,
} from "./combat-state.js";
import { isPlayerActionParticipant } from "./combat-state.js";

export type IllegalTargetReason = "target-not-found" | "self" | "ally" | "front-row-blocked";

export type NormalAttackTargetCheck =
  | { readonly legal: true }
  | { readonly legal: false; readonly reason: IllegalTargetReason };

export interface NormalAttackTargetOption {
  readonly targetId: string;
  readonly displayName: string;
  readonly legal: boolean;
  readonly reason?: "front-row-blocked";
}

export interface NormalAttackTargetOptions {
  readonly currentActorId: string;
  readonly canPlayerAct: boolean;
  readonly legalTargetIds: readonly string[];
  readonly targets: readonly NormalAttackTargetOption[];
}

/** Pure domain rule. Row movement does not exist here; only the current positions are read. */
export function checkNormalAttackTarget(
  combat: CombatState,
  attacker: CombatParticipant,
  targetId: string,
  range: NormalAttackRange,
): NormalAttackTargetCheck {
  const target = combat.participants.find((participant) => participant.id === targetId);
  if (!target) return { legal: false, reason: "target-not-found" };
  if (target.id === attacker.id) return { legal: false, reason: "self" };
  if (target.side === attacker.side) return { legal: false, reason: "ally" };
  if (range === "melee" && target.row === "back"
    && combat.participants.some((participant) => participant.side === target.side && participant.row === "front")) {
    return { legal: false, reason: "front-row-blocked" };
  }
  return { legal: true };
}

export function getLegalNormalAttackTargets(
  combat: CombatState,
  attackerId: string,
  range: NormalAttackRange,
): readonly string[] {
  const attacker = combat.participants.find((participant) => participant.id === attackerId);
  if (!attacker) return [];
  return combat.participants
    .filter((target) => checkNormalAttackTarget(combat, attacker, target.id, range).legal)
    .map((target) => target.id);
}

/** Builds a derived list for the current actor; this list is never stored in CombatState. */
export function getNormalAttackTargetOptions(combat: CombatState): NormalAttackTargetOptions {
  if (combat.status === "ended") return Object.freeze({
    currentActorId: "", canPlayerAct: false, legalTargetIds: Object.freeze([]), targets: Object.freeze([]),
  });
  const attacker = combat.participants.find((participant) => participant.id === combat.currentActorId);
  if (!attacker || !isPlayerActionParticipant(attacker)
    || combat.activeCastings.some((casting) => casting.actorId === attacker.id)) {
    return Object.freeze({
      currentActorId: combat.currentActorId,
      canPlayerAct: false,
      legalTargetIds: Object.freeze([]),
      targets: Object.freeze([]),
    });
  }
  const targets = combat.participants
    .filter((participant) => participant.side !== attacker.side)
    .map((participant): NormalAttackTargetOption => {
      const check = checkNormalAttackTarget(combat, attacker, participant.id, attacker.normalAttack!.range);
      return check.legal
        ? Object.freeze({ targetId: participant.id, displayName: participant.displayName, legal: true })
        : Object.freeze({
          targetId: participant.id,
          displayName: participant.displayName,
          legal: false,
          ...(check.reason === "front-row-blocked" ? { reason: check.reason } : {}),
        });
    });
  return Object.freeze({
    currentActorId: attacker.id,
    canPlayerAct: true,
    legalTargetIds: Object.freeze(targets.filter((target) => target.legal).map((target) => target.targetId)),
    targets: Object.freeze(targets),
  });
}
