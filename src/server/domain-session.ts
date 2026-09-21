import { applyCommand, createGameState } from "../domain/game.js";
import type { GameState } from "../domain/game.js";
import type { GameStateRepository } from "../domain/game-state-repository.js";

export interface GameStateSession {
  getState(): GameState | Promise<GameState>;
  execute(input: unknown): ReturnType<typeof applyCommand> | Promise<ReturnType<typeof applyCommand>>;
}

/** 單程序記憶體邊界；Phase 4 才處理持久化與資料庫併發。 */
export function createDomainSession(initialState: GameState) {
  let state = createGameState(initialState);
  return {
    getState: () => state,
    execute(input: unknown) {
      const result = applyCommand(state, input);
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
  };
}
