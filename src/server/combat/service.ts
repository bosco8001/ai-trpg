import { createGameState, type GameState } from "../../domain/game.js";
import type { CombatParticipantSeed, CombatTransitionResult, DiceRoller } from "../../domain/combat.js";
import type { GameStateSession } from "../domain-session.js";

export interface CombatService {
  getState(): Promise<GameState>;
  start(input: unknown): Promise<CombatTransitionResult>;
  advance(input: unknown): Promise<CombatTransitionResult>;
}

/** 只協調 session 與骰子；不依賴 LLM、narration 或前端。 */
export function createCombatService(
  session: GameStateSession,
  participants: readonly CombatParticipantSeed[],
  roller: DiceRoller,
): CombatService {
  return {
    async getState() {
      return createGameState(await session.getState());
    },
    async start(input: unknown) {
      return session.startCombat(input, participants, roller);
    },
    async advance(input: unknown) {
      return session.advanceCombat(input);
    },
  };
}
