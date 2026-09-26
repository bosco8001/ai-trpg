import type { CombatParticipant, CombatRow, AoETargetResolution, ActiveCombatState } from "./combat-state.js";
import type { DiceRoller } from "./combat.js";

/** v1 只以敵方排為範圍；未來生命狀態加入後，合法目標過濾也在此集中處理。 */
export function getEnemyRowTargets(combat: ActiveCombatState, actor: CombatParticipant, row: CombatRow): readonly CombatParticipant[] {
  return combat.participants.filter((target) => target.side !== actor.side && target.row === row
    && target.health.lifeState === "active");
}

function d20(roller: DiceRoller): number {
  const value = roller.d20();
  if (!Number.isSafeInteger(value) || value < 1 || value > 20) throw new Error("D20 必須回傳 1 至 20 的整數。");
  return value;
}

/** 每個目標各取一顆攻擊骰與一顆閃避骰；呼叫端僅在整組完成後提交狀態。 */
export function resolveRowAoE(
  actor: CombatParticipant,
  targets: readonly CombatParticipant[],
  roller: DiceRoller,
  attackModifierFor: (actor: CombatParticipant, target: CombatParticipant) => number,
): readonly AoETargetResolution[] {
  if (targets.length === 0) throw new Error("AoE 目標排不可為空。");
  return Object.freeze(targets.map((target): AoETargetResolution => {
    const perceptionModifier = attackModifierFor(actor, target);
    if (!Number.isSafeInteger(perceptionModifier)) throw new Error("AoE 攻擊修正不正確。");
    const attackRaw = d20(roller);
    const evasionRaw = d20(roller);
    const attackTotal = attackRaw + perceptionModifier;
    const evasionTotal = evasionRaw + target.initiative.dexterityModifier;
    if (!Number.isSafeInteger(attackTotal) || !Number.isSafeInteger(evasionTotal)) throw new Error("AoE 判定超出安全範圍。");
    const outcome = attackTotal >= evasionTotal ? "hit" : "miss";
    return Object.freeze({
      targetId: target.id,
      attack: Object.freeze({ rawD20: attackRaw, perceptionModifier, total: attackTotal }),
      evasion: Object.freeze({ rawD20: evasionRaw, dexterityModifier: target.initiative.dexterityModifier, total: evasionTotal }),
      outcome,
      critical: outcome === "hit" && attackRaw >= 19,
    });
  }));
}
