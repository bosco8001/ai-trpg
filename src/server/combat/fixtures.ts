import type { CombatParticipantSeed } from "../../domain/combat.js";

/** Phase 11 工程 fixture；不是正式角色、敵人或世界內容。 */
export const TEST_COMBAT_PARTICIPANTS: readonly CombatParticipantSeed[] = Object.freeze([
  Object.freeze({ id: "TEST-player", displayName: "TEST 玩家", side: "party" as const, dexterityModifier: 2 }),
  Object.freeze({ id: "TEST-enemy-1", displayName: "TEST 敵人 1", side: "enemy" as const, dexterityModifier: 1 }),
  Object.freeze({ id: "TEST-enemy-2", displayName: "TEST 敵人 2", side: "enemy" as const, dexterityModifier: 0 }),
]);
