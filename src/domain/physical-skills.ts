import type { NormalAttackRange } from "./combat-state.js";

/** 工程測試目錄；不是正式世界技能或內容製作流程。 */
interface SkillDefinitionBase {
  readonly skillId: string;
  readonly displayName: string;
}

export type ActiveSkillDefinition = SkillDefinitionBase & ({
  readonly category: "physical-active";
  readonly targetType: "single-enemy";
  readonly range: NormalAttackRange;
} | {
  readonly category: "magic-active";
  readonly targetType: "none";
  readonly castingType: "direct";
  readonly totalMpCost: number;
  readonly castingTurns: number;
  readonly perTurnMpCost: number;
});

const definitions: Readonly<Record<string, ActiveSkillDefinition>> = Object.freeze({
  "TEST-skill-1": Object.freeze({
    skillId: "TEST-skill-1", displayName: "TEST 物理技能",
    category: "physical-active", targetType: "single-enemy", range: "melee",
  }),
  "TEST-skill-2": Object.freeze({
    skillId: "TEST-skill-2", displayName: "TEST 多回合法術",
    category: "magic-active", targetType: "none", castingType: "direct",
    totalMpCost: 18, castingTurns: 3, perTurnMpCost: 6,
  }),
});

export function getActiveSkillDefinition(skillId: string): ActiveSkillDefinition | undefined {
  return definitions[skillId];
}
