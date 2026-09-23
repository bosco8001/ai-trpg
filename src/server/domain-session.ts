import { applyCommand, createGameState, replaceGameStateContents } from "../domain/game.js";
import type { GameState } from "../domain/game.js";
import type { GameStateRepository } from "../domain/game-state-repository.js";
import {
  advanceCombatTurn,
  getCurrentCombatItemOptions,
  getCurrentRowMoveOptions,
  getCurrentNormalAttackOptions,
  moveCombatRow,
  resolveNormalAttack,
  useCombatItem as useCombatItemTransition,
  startCombat as startCombatTransition,
  type CombatParticipantSeed,
  type DiceRoller,
  type CombatItemOptionsResult,
  type CombatItemUseResult,
} from "../domain/combat.js";

export interface GameStateSession {
  getState(): GameState | Promise<GameState>;
  execute(input: unknown): ReturnType<typeof applyCommand> | Promise<ReturnType<typeof applyCommand>>;
  replaceContents(expectedRevision: unknown, contents: unknown): ReturnType<typeof replaceGameStateContents>
    | Promise<ReturnType<typeof replaceGameStateContents>>;
  startCombat(input: unknown, participants: readonly CombatParticipantSeed[], roller: DiceRoller):
    ReturnType<typeof startCombatTransition> | Promise<ReturnType<typeof startCombatTransition>>;
  advanceCombat(input: unknown): ReturnType<typeof advanceCombatTurn>
    | Promise<ReturnType<typeof advanceCombatTurn>>;
  normalAttackOptions(): ReturnType<typeof getCurrentNormalAttackOptions>
    | Promise<ReturnType<typeof getCurrentNormalAttackOptions>>;
  normalAttack(input: unknown, roller: DiceRoller): ReturnType<typeof resolveNormalAttack>
    | Promise<ReturnType<typeof resolveNormalAttack>>;
  rowMoveOptions(): ReturnType<typeof getCurrentRowMoveOptions>
    | Promise<ReturnType<typeof getCurrentRowMoveOptions>>;
  moveRow(input: unknown): ReturnType<typeof moveCombatRow>
    | Promise<ReturnType<typeof moveCombatRow>>;
  combatItemOptions(): CombatItemOptionsResult | Promise<CombatItemOptionsResult>;
  useCombatItem(input: unknown): CombatItemUseResult | Promise<CombatItemUseResult>;
}

/** 單程序記憶體邊界；程序重啟後狀態會重設。 */
export function createDomainSession(initialState: GameState) {
  let state = createGameState(initialState);
  return {
    getState: () => state,
    execute(input: unknown) {
      const result = applyCommand(state, input);
      if (result.ok) state = result.state;
      return result;
    },
    replaceContents(expectedRevision: unknown, contents: unknown) {
      const result = replaceGameStateContents(state, expectedRevision, contents);
      if (result.ok) state = result.state;
      return result;
    },
    startCombat(input: unknown, participants: readonly CombatParticipantSeed[], roller: DiceRoller) {
      const result = startCombatTransition(state, input, participants, roller);
      if (result.ok) state = result.state;
      return result;
    },
    advanceCombat(input: unknown) {
      const result = advanceCombatTurn(state, input);
      if (result.ok) state = result.state;
      return result;
    },
    normalAttackOptions: () => getCurrentNormalAttackOptions(state),
    normalAttack(input: unknown, roller: DiceRoller) {
      const result = resolveNormalAttack(state, input, roller);
      if (result.ok) state = result.state;
      return result;
    },
    rowMoveOptions: () => getCurrentRowMoveOptions(state),
    moveRow(input: unknown) {
      const result = moveCombatRow(state, input);
      if (result.ok) state = result.state;
      return result;
    },
    combatItemOptions: () => getCurrentCombatItemOptions(state),
    useCombatItem(input: unknown) {
      const result = useCombatItemTransition(state, input);
      if (result.ok) state = result.state;
      return result;
    },
  };
}

/** 每次從 repository 取得最新快照；跨程序寫入由 repository 的 revision 條件守護。 */
export function createPersistedDomainSession(repository: GameStateRepository, initialState: GameState) {
  const seed = createGameState(initialState);
  return {
    getState: () => repository.createIfAbsent(seed),
    async execute(input: unknown) {
      const state = await repository.createIfAbsent(seed);
      const result = applyCommand(state, input);
      if (!result.ok) return result;
      const saved = await repository.saveIfRevision(state.revision, result.state);
      return saved ? result : {
        ok: false as const,
        code: "stale-revision" as const,
        message: "狀態已更新，請重新讀取後再送出命令。",
      };
    },
    async replaceContents(expectedRevision: unknown, contents: unknown) {
      const state = await repository.createIfAbsent(seed);
      const result = replaceGameStateContents(state, expectedRevision, contents);
      if (!result.ok) return result;
      const saved = await repository.saveIfRevision(state.revision, result.state);
      return saved ? result : {
        ok: false as const,
        code: "stale-revision" as const,
        message: "狀態已更新，請重新讀取後再載入存檔。",
      };
    },
    async startCombat(input: unknown, participants: readonly CombatParticipantSeed[], roller: DiceRoller) {
      const state = await repository.createIfAbsent(seed);
      const result = startCombatTransition(state, input, participants, roller);
      if (!result.ok) return result;
      const saved = await repository.saveIfRevision(state.revision, result.state);
      return saved ? result : {
        ok: false as const,
        code: "stale-revision" as const,
        message: "狀態已更新，請重新讀取後再開始戰鬥。",
      };
    },
    async advanceCombat(input: unknown) {
      const state = await repository.createIfAbsent(seed);
      const result = advanceCombatTurn(state, input);
      if (!result.ok) return result;
      const saved = await repository.saveIfRevision(state.revision, result.state);
      return saved ? result : {
        ok: false as const,
        code: "stale-revision" as const,
        message: "狀態已更新，請重新讀取後再推進回合。",
      };
    },
    async normalAttackOptions() {
      return getCurrentNormalAttackOptions(await repository.createIfAbsent(seed));
    },
    async normalAttack(input: unknown, roller: DiceRoller) {
      if (repository.withStateLocked) {
        return repository.withStateLocked(seed, (state) => {
          const result = resolveNormalAttack(state, input, roller);
          return { result, ...(result.ok ? { nextState: result.state } : {}) };
        });
      }
      const state = await repository.createIfAbsent(seed);
      const result = resolveNormalAttack(state, input, roller);
      if (!result.ok) return result;
      const saved = await repository.saveIfRevision(state.revision, result.state);
      return saved ? result : {
        ok: false as const,
        code: "stale-revision" as const,
        message: "戰鬥狀態已更新，請重新讀取後再攻擊。",
      };
    },
    async rowMoveOptions() {
      return getCurrentRowMoveOptions(await repository.createIfAbsent(seed));
    },
    async moveRow(input: unknown) {
      if (repository.withStateLocked) {
        return repository.withStateLocked(seed, (state) => {
          const result = moveCombatRow(state, input);
          return { result, ...(result.ok ? { nextState: result.state } : {}) };
        });
      }
      const state = await repository.createIfAbsent(seed);
      const result = moveCombatRow(state, input);
      if (!result.ok) return result;
      const saved = await repository.saveIfRevision(state.revision, result.state);
      return saved ? result : {
        ok: false as const,
        code: "stale-revision" as const,
        message: "戰鬥狀態已更新，請重新讀取後再移動。",
      };
    },
    async combatItemOptions() {
      return getCurrentCombatItemOptions(await repository.createIfAbsent(seed));
    },
    async useCombatItem(input: unknown) {
      if (repository.withStateLocked) {
        return repository.withStateLocked(seed, (state) => {
          const result = useCombatItemTransition(state, input);
          return { result, ...(result.ok ? { nextState: result.state } : {}) };
        });
      }
      const state = await repository.createIfAbsent(seed);
      const result = useCombatItemTransition(state, input);
      if (!result.ok) return result;
      const saved = await repository.saveIfRevision(state.revision, result.state);
      return saved ? result : {
        ok: false as const,
        code: "stale-revision" as const,
        message: "戰鬥狀態已更新，請重新讀取後再使用物品。",
      };
    },
  };
}
