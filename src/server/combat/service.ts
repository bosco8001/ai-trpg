import { createGameState, type GameState } from "../../domain/game.js";
import type {
  CombatParticipantSeed,
  CombatTransitionResult,
  DiceRoller,
  NormalAttackOptionsResult,
  NormalAttackResult,
  RowMoveOptionsResult,
  RowMoveResult,
} from "../../domain/combat.js";
import type { GameStateSession } from "../domain-session.js";

export interface CombatService {
  getState(): Promise<GameState>;
  start(input: unknown): Promise<CombatTransitionResult>;
  advance(input: unknown): Promise<CombatTransitionResult>;
  normalAttackOptions(): Promise<NormalAttackOptionsResult>;
  normalAttack(input: unknown): Promise<NormalAttackResult>;
  rowMoveOptions(): Promise<RowMoveOptionsResult>;
  moveRow(input: unknown): Promise<RowMoveResult>;
}

/** 只協調 session 與骰子；不依賴 LLM、narration 或前端。 */
export function createCombatService(
  session: GameStateSession,
  participants: readonly CombatParticipantSeed[],
  initiativeRoller: DiceRoller,
  actionRoller: DiceRoller = initiativeRoller,
): CombatService {
  return {
    async getState() {
      return createGameState(await session.getState());
    },
    async start(input: unknown) {
      return session.startCombat(input, participants, initiativeRoller);
    },
    async advance(input: unknown) {
      return session.advanceCombat(input);
    },
    async normalAttackOptions() {
      return session.normalAttackOptions();
    },
    async normalAttack(input: unknown) {
      return session.normalAttack(input, actionRoller);
    },
    async rowMoveOptions() {
      return session.rowMoveOptions();
    },
    async moveRow(input: unknown) {
      return session.moveRow(input);
    },
  };
}
