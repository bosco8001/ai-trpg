import type { Pool } from "pg";
import type { RepairSource } from "../shared/repair-preview.js";
import { boundedJson, RawBackupFailure } from "./raw-data-backup.js";

export interface RepairRawRecord { readonly capturedAt: string; readonly raw: string | null }
export interface RepairPreviewReader {
  readonly storage: "memory" | "postgres";
  readonly characterId: string;
  read(source: RepairSource, maxBytes: number, signal: AbortSignal): RepairRawRecord | Promise<RepairRawRecord>;
}
export function createMemoryRepairReader(characterId: string,
  capture: () => { current: unknown | undefined; slots: readonly { slotId: 1 | 2 | 3 }[] },
  now: () => Date = () => new Date()): RepairPreviewReader {
  return { storage: "memory", characterId, read(source, maxBytes, signal) {
    signal.throwIfAborted();
    const data = capture();
    const value = source === "current" ? data.current : data.slots.find(s => s.slotId === source);
    return { capturedAt: now().toISOString(), raw: value === undefined ? null : boundedJson(value, maxBytes) };
  } };
}
/** 每項一條唯讀 SELECT：原始列、時間與大小判定使用同一 statement 快照。 */
export function createPostgresRepairReader(pool: Pick<Pool, "connect">, characterId: string): RepairPreviewReader {
  return { storage: "postgres", characterId, async read(source, maxBytes, signal) {
    signal.throwIfAborted();
    const client = await pool.connect();
    let released = false;
    const discard = () => { if (!released) { released = true; client.release(true); } };
    signal.addEventListener("abort", discard, { once: true });
    try {
      signal.throwIfAborted();
      const selection = source === "current"
        ? "SELECT character_id, revision, snapshot FROM game_states WHERE character_id = $1"
        : "SELECT slot_id, format_version, source_revision, snapshot, saved_at FROM save_slots WHERE slot_id = $1";
      const result = await client.query<{ captured_at: string; raw: string | null; too_large: boolean }>(`
        WITH original AS MATERIALIZED (SELECT row_to_json(r)::text AS raw FROM (${selection}) r)
        SELECT to_char(statement_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS captured_at,
          COALESCE((SELECT octet_length(raw) > $2 FROM original), false) AS too_large,
          (SELECT CASE WHEN octet_length(raw) <= $2 THEN raw ELSE NULL END FROM original) AS raw`,
      [source === "current" ? characterId : source, maxBytes]);
      signal.throwIfAborted();
      const row = result.rows[0];
      if (!row) throw new RawBackupFailure("unavailable");
      if (row.too_large) throw new RawBackupFailure("too-large");
      return { capturedAt: row.captured_at, raw: row.raw };
    } finally {
      signal.removeEventListener("abort", discard);
      if (!released) { released = true; client.release(); }
    }
  } };
}
