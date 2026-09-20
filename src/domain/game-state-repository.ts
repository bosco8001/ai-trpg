import type { GameState } from "./game.js";

/** Domain 所需的保存契約；不指定資料庫、SQL 或網路格式。 */
export interface GameStateRepository {
  load(characterId: string): Promise<GameState | undefined>;
  createIfAbsent(seed: GameState): Promise<GameState>;
  /** 只在目前版本等於 expectedRevision 時提交；衝突時不寫入。 */
  saveIfRevision(expectedRevision: number, next: GameState): Promise<boolean>;
}
