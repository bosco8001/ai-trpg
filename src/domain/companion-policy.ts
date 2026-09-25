import type { ActiveCombatState, CombatParticipant } from "./combat-state.js";
import { getLegalNormalAttackTargets } from "./combat-targeting.js";

export type CompanionActionIntent =
  | { readonly type: "normal-attack"; readonly targetId: string }
  | { readonly type: "defend" };

export type CompanionDecisionPolicy = (
  combat: ActiveCombatState,
  actor: CombatParticipant,
  tacticPreferenceId: string | null,
) => CompanionActionIntent | null;

/** Phase 22 engineering fixture semantics only; NOT canonical tactic behavior.
 * TEST-tactic-a = normal attack (defend if no legal target).
 * TEST-tactic-b = defend. Unknown and null preferences have no policy.
 */
export const decideCompanionAction: CompanionDecisionPolicy = (combat, actor, preference) => {
  if (preference === "TEST-tactic-b") return { type: "defend" };
  if (preference !== "TEST-tactic-a" || actor.normalAttack === null) return null;
  const targetId = getLegalNormalAttackTargets(combat, actor.id, actor.normalAttack.range)[0];
  return targetId === undefined ? { type: "defend" } : { type: "normal-attack", targetId };
};
