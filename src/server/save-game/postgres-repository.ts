import type { Pool } from "pg";
import type { SaveSlotId } from "../../shared/save-game.js";
import type { SaveGameRepository, SaveRevisionGuard, SaveSnapshotV2, StoredSaveSlot } from "./contracts.js";

export class SavePersistenceUnavailableError extends Error {
  constructor(cause: unknown) {
    super("PostgreSQL 暫時無法提供存檔資料。", { cause });
  }
}

export class InvalidStoredSaveRecordError extends Error {
  constructor(cause?: unknown) {
    super("資料庫中的存檔資料列格式不正確。", { cause });
  }
}

interface SaveSlotRow {
  slot_id: unknown;
  format_version: unknown;
  source_revision: unknown;
  snapshot: unknown;
  saved_at: unknown;
}

function isSafeIntegerText(value: unknown): value is string {
  return typeof value === "string" && /^(0|[1-9]\d*)$/.test(value)
    && Number.isSafeInteger(Number(value));
}

export function hydrateSaveSlotRow(row: SaveSlotRow): StoredSaveSlot {
  try {
    if ((row.slot_id !== 1 && row.slot_id !== 2 && row.slot_id !== 3)
      || typeof row.format_version !== "number" || !Number.isSafeInteger(row.format_version)
      || row.format_version < 1 || !isSafeIntegerText(row.source_revision)
      || !(row.saved_at instanceof Date) || Number.isNaN(row.saved_at.getTime())) {
      throw new Error("存檔資料列 metadata 格式錯誤。");
    }
    return {
      slotId: row.slot_id,
      formatVersion: row.format_version,
      sourceRevision: Number(row.source_revision),
      snapshot: row.snapshot,
      savedAt: row.saved_at.toISOString(),
    };
  } catch (error) {
    throw new InvalidStoredSaveRecordError(error);
  }
}

export class PostgresSaveGameRepository implements SaveGameRepository {
  constructor(private readonly pool: Pool) {}

  private async query<T extends object>(sql: string, params: readonly unknown[]) {
    try {
      return await this.pool.query<T>(sql, [...params]);
    } catch (error) {
      throw new SavePersistenceUnavailableError(error);
    }
  }

  async list(): Promise<readonly StoredSaveSlot[]> {
    const result = await this.query<SaveSlotRow>(
      "SELECT slot_id, format_version, source_revision, snapshot, saved_at FROM save_slots ORDER BY slot_id",
      [],
    );
    return result.rows.map(hydrateSaveSlotRow);
  }

  async read(slotId: SaveSlotId): Promise<StoredSaveSlot | undefined> {
    const result = await this.query<SaveSlotRow>(
      "SELECT slot_id, format_version, source_revision, snapshot, saved_at FROM save_slots WHERE slot_id = $1",
      [slotId],
    );
    const row = result.rows[0];
    return row ? hydrateSaveSlotRow(row) : undefined;
  }

  async writeIfLiveRevision(
    slotId: SaveSlotId,
    snapshot: SaveSnapshotV2,
    guard: SaveRevisionGuard,
  ): Promise<StoredSaveSlot | undefined> {
    const result = await this.query<SaveSlotRow>(
      `INSERT INTO save_slots (slot_id, format_version, source_revision, snapshot, saved_at)
       SELECT $1, $2, $3,
         jsonb_set(snapshot - 'revision', '{phase26}', (snapshot->'phase26') - 'runtimeGeneration' - 'sequenceHighWater' - 'narrativeLedger'), CURRENT_TIMESTAMP
       FROM game_states WHERE character_id = $4 AND revision = $5
       ON CONFLICT (slot_id) DO UPDATE SET
         format_version = EXCLUDED.format_version,
         source_revision = EXCLUDED.source_revision,
         snapshot = EXCLUDED.snapshot,
         saved_at = EXCLUDED.saved_at
       RETURNING slot_id, format_version, source_revision, snapshot, saved_at`,
      [slotId, snapshot.formatVersion, snapshot.sourceRevision,
        guard.characterId, guard.expectedRevision],
    );
    const row = result.rows[0];
    return row ? hydrateSaveSlotRow(row) : undefined;
  }
}
