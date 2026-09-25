import type { Pool, PoolClient } from "pg";
import { createGameState, createInitialTestExplorationState } from "../domain/game.js";
import type { GameState } from "../domain/game.js";
import type { GameStateRepository } from "../domain/game-state-repository.js";
import { createTestCombatInventory } from "../domain/combat-items.js";
import { createLegacyPartyMembers } from "../domain/party-tactics.js";

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
  return {
    activity: state.activity,
    character: state.character,
    inventory: state.inventory,
    partyMembers: state.partyMembers,
    exploration: state.exploration,
    combat: state.combat,
  };
}

/** 僅接受經 domain 驗證的快照，資料庫列也必須重新驗證。 */
export function hydrateStateRow(row: StateRow): GameState {
  try {
    if (typeof row.character_id !== "string" || typeof row.revision !== "string"
      || !/^(0|[1-9]\d*)$/.test(row.revision)
      || typeof row.snapshot !== "object" || row.snapshot === null || Array.isArray(row.snapshot)) {
      throw new Error("資料列格式錯誤。");
    }
    const snapshot = row.snapshot as Record<string, unknown>;
    const snapshotKeys = Object.keys(snapshot);
    const legacy = snapshotKeys.length === 2 && snapshotKeys.includes("activity")
      && snapshotKeys.includes("character");
    const explorationOnly = snapshotKeys.length === 3 && snapshotKeys.includes("activity")
      && snapshotKeys.includes("character") && snapshotKeys.includes("exploration");
    const currentWithoutInventory = snapshotKeys.length === 4 && snapshotKeys.includes("activity")
      && snapshotKeys.includes("character") && snapshotKeys.includes("exploration")
      && snapshotKeys.includes("combat");
    const current = snapshotKeys.length === 5 && snapshotKeys.includes("activity")
      && snapshotKeys.includes("character") && snapshotKeys.includes("exploration")
      && snapshotKeys.includes("combat") && snapshotKeys.includes("inventory");
    const currentWithParty = snapshotKeys.length === 6 && snapshotKeys.includes("activity")
      && snapshotKeys.includes("character") && snapshotKeys.includes("exploration")
      && snapshotKeys.includes("combat") && snapshotKeys.includes("inventory")
      && snapshotKeys.includes("partyMembers");
    if (!legacy && !explorationOnly && !currentWithoutInventory && !current && !currentWithParty) {
      throw new Error("快照欄位格式錯誤。");
    }
    const revision = Number(row.revision);
    if (!Number.isSafeInteger(revision)) throw new Error("狀態版本超出安全範圍。");
    const missingInventory = !current && !currentWithParty;
    if (missingInventory && row.character_id !== "TEST-character") {
      throw new Error("未知角色的舊快照缺少背包欄位。");
    }
    const state = createGameState({
      ...snapshot,
      exploration: legacy ? createInitialTestExplorationState() : snapshot.exploration,
      inventory: missingInventory ? createTestCombatInventory() : snapshot.inventory,
      combat: current || currentWithParty || currentWithoutInventory ? snapshot.combat : null,
      partyMembers: currentWithParty ? snapshot.partyMembers : createLegacyPartyMembers(row.character_id),
      revision,
    });
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

  private async queryClient<T extends object>(client: PoolClient, sql: string, params: readonly unknown[] = []) {
    try {
      return await client.query<T>(sql, [...params]);
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

  /** 讓權威戰鬥 action 在讀取、revision 驗證與提交期間持有同一筆 row lock。 */
  async withStateLocked<T>(
    seed: GameState,
    transition: (current: GameState) => { readonly result: T; readonly nextState?: GameState },
  ): Promise<T> {
    const initial = createGameState(seed);
    await this.createIfAbsent(initial);
    let client: PoolClient;
    try {
      client = await this.pool.connect();
    } catch (error) {
      throw new PersistenceUnavailableError(error);
    }

    let transactionOpen = false;
    try {
      await this.queryClient(client, "BEGIN");
      transactionOpen = true;
      const selected = await this.queryClient<StateRow>(client,
        "SELECT character_id, revision, snapshot FROM game_states WHERE character_id = $1 FOR UPDATE",
        [initial.character.id]);
      const row = selected.rows[0];
      if (!row) throw new InvalidPersistedStateError(new Error("鎖定後找不到遊戲狀態。"));
      const current = hydrateStateRow(row);
      const { result, nextState } = transition(current);
      if (nextState) {
        const next = createGameState(nextState);
        if (next.character.id !== current.character.id || next.revision !== current.revision + 1) {
          throw new Error("鎖定交易中的狀態版本不符合單次 transition 契約。");
        }
        const updated = await this.queryClient(client,
          "UPDATE game_states SET revision = $3, snapshot = $4::jsonb WHERE character_id = $1 AND revision = $2",
          [current.character.id, current.revision, next.revision, JSON.stringify(snapshotOf(next))]);
        if (updated.rowCount !== 1) throw new Error("鎖定交易未能提交遊戲狀態。");
      }
      await this.queryClient(client, "COMMIT");
      transactionOpen = false;
      return result;
    } catch (error) {
      if (transactionOpen) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // 保留原始錯誤；rollback failure 不會改變安全回應邊界。
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }
}
