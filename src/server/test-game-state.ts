import { createGameState, createInitialTestExplorationState, type GameState } from "../domain/game.js";
import { createTestCombatInventory } from "../domain/combat-items.js";

/** 所有識別碼與技能都是工程 fixture，不代表正式角色、地圖或世界內容。 */
export function createTestGameState(): GameState {
  return createGameState({
    revision: 0,
    activity: "outside-combat",
    character: {
      id: "TEST-character",
      learnedActiveSkillIds: Array.from({ length: 7 }, (_, i) => `TEST-skill-${i + 1}`),
      equippedSkillIds: [],
      currentMp: 24, // TEST fixture；不是正式起始 MP。
    },
    inventory: createTestCombatInventory(),
    exploration: createInitialTestExplorationState(),
    combat: null,
  });
}
