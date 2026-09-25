import type { CombatParticipantSeed } from "../../domain/combat.js";

/** Phase 11 工程 fixture；不是正式角色、敵人或世界內容。 */
export const TEST_COMBAT_PARTICIPANTS: readonly CombatParticipantSeed[] = Object.freeze([
  Object.freeze({
    id: "TEST-player",
    displayName: "TEST 玩家",
    side: "party" as const,
    row: "front" as const,
    dexterityModifier: 2,
    normalAttack: Object.freeze({
      range: "melee" as const,
      perceptionModifier: 1,
      weaponMainStatModifier: 2,
      proficiencyModifier: 1,
    }),
  }),
  Object.freeze({
    id: "TEST-enemy-1",
    displayName: "TEST 敵人 1",
    side: "enemy" as const,
    row: "front" as const,
    dexterityModifier: 1,
    normalAttack: null,
  }),
  Object.freeze({
    id: "TEST-enemy-2",
    displayName: "TEST 敵人 2",
    side: "enemy" as const,
    row: "back" as const,
    dexterityModifier: 0,
    normalAttack: null,
  }),
]);

/** Phase 22 shared TEST battle. Values are engineering fixtures, not companion balance. */
export const PHASE22_TEST_COMBAT_PARTICIPANTS: readonly CombatParticipantSeed[] = Object.freeze([
  ...TEST_COMBAT_PARTICIPANTS,
  Object.freeze({
    id: "TEST-companion-1", displayName: "TEST 隊友", side: "party" as const,
    row: "back" as const, dexterityModifier: 0, controlledBy: "companion" as const,
    normalAttack: Object.freeze({
      range: "melee" as const, perceptionModifier: 1,
      weaponMainStatModifier: 1, proficiencyModifier: 0,
    }),
  }),
]);
