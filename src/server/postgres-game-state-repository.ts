import type { Pool } from "pg";
import { createGameState } from "../domain/game.js";
import type { GameState } from "../domain/game.js";
import type { GameStateRepository } from "../domain/game-state-repository.js";

export class PersistenceUnavailableError extends Error {
  constructor(cause: unknown) {
    super("PostgreSQL 暫時無法提供遊戲狀態。", { cause });
  }
}

export class InvalidPersistedStateError extends Error {
  constructor(cause?: unknown) {
    super("已保存的遊戲狀態不符合 domain 契約。", { cause });
  }
}

interface StateRow {
  character_id: unknown;
  revision: unknown;
  snapshot: unknown;
}

function snapshotOf(state: GameState) {
  return { activity: state.activity, character: state.character };
}

/** 僅接受經 domain 驗證的快照，資料庫列也必須重新驗證。 */
export function hydrateStateRow(row: StateRow): GameState {
  try {
    if (typeof row.character_id !== "string" || typeof row.revision !== "string"
      || !/^(0|[1-9]\d*)$/.test(row.revision)
      || typeof row.snapshot !== "object" || row.snapshot === null || Array.isArray(row.snapshot)) {
      throw new Error("資料列格式錯誤。");
    }
    const snapshotKeys = Object.keys(row.snapshot);
    if (snapshotKeys.length !== 2 || !snapshotKeys.includes("activity")
      || !snapshotKeys.includes("character")) {
      throw new Error("快照欄位格式錯誤。");
    }
    const revision = Number(row.revision);
    if (!Number.isSafeInteger(revision)) throw new Error("狀態版本超出安全範圍。");
    const state = createGameState({ ...row.snapshot, revision });
    if (state.character.id !== row.character_id) throw new Error("角色識別碼不一致。");
    return state;
  } catch (error) {
    throw new InvalidPersistedStateError(error);
  }
}

export class PostgresGameStateRepository implements GameStateRepository {
  constructor(private readonly pool: Pool) {}

  private async query<T extends object>(sql: string, params: readonly unknown[]) {
    try {
      return await this.pool.query<T>(sql, [...params]);
    } catch (error) {
      throw new PersistenceUnavailableError(error);
    }
  }

  async load(characterId: string): Promise<GameState | undefined> {
    const result = await this.query<StateRow>(
      "SELECT character_id, revision, snapshot FROM game_states WHERE character_id = $1",
      [characterId],
    );
    const row = result.rows[0];
    return row ? hydrateStateRow(row) : undefined;
  }

  async createIfAbsent(seed: GameState): Promise<GameState> {
    const state = createGameState(seed);
    await this.query(
      "INSERT INTO game_states (character_id, revision, snapshot) VALUES ($1, $2, $3::jsonb) ON CONFLICT (character_id) DO NOTHING",
      [state.character.id, state.revision, JSON.stringify(snapshotOf(state))],
    );
    const loaded = await this.load(state.character.id);
    if (!loaded) throw new InvalidPersistedStateError(new Error("建立後找不到狀態。"));
    return loaded;
  }

  async saveIfRevision(expectedRevision: number, next: GameState): Promise<boolean> {
    const state = createGameState(next);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0
      || state.revision !== expectedRevision + 1) {
      throw new Error("提交版本不符合 domain 更新契約。");
    }
    const result = await this.query(
      "UPDATE game_states SET revision = $3, snapshot = $4::jsonb WHERE character_id = $1 AND revision = $2",
      [state.character.id, expectedRevision, state.revision, JSON.stringify(snapshotOf(state))],
    );
    return result.rowCount === 1;
  }
}
