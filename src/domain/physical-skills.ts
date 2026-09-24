import type { NormalAttackRange } from "./combat-state.js";

/** 工程測試目錄；不是正式世界技能或內容製作流程。 */
export interface ActiveSkillDefinition {
  readonly skillId: string;
  readonly displayName: string;
  readonly category: "physical-active" | "magic-active";
  readonly targetType: "single-enemy";
  readonly range: NormalAttackRange;
}

const definitions: Readonly<Record<string, ActiveSkillDefinition>> = Object.freeze({
  "TEST-skill-1": Object.freeze({
    skillId: "TEST-skill-1", displayName: "TEST 物理技能",
    category: "physical-active", targetType: "single-enemy", range: "melee",
  }),
  "TEST-skill-2": Object.freeze({
    skillId: "TEST-skill-2", displayName: "TEST 非物理技能",
    category: "magic-active", targetType: "single-enemy", range: "ranged",
  }),
});

export function getActiveSkillDefinition(skillId: string): ActiveSkillDefinition | undefined {
  return definitions[skillId];
}
