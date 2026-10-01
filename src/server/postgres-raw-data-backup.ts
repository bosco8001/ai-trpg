import type { Pool } from "pg";
import type { RawBackupPayload } from "../shared/raw-data-backup.js";
import { RawBackupFailure, type RawBackupReader } from "./raw-data-backup.js";

/** One SELECT gives all four records a single MVCC snapshot, without explicit lock commands or initialization. */
export function createPostgresBackupReader(pool: Pick<Pool, "connect">, characterId: string): RawBackupReader {
  return {
    async capture(maxBytes, signal): Promise<RawBackupPayload> {
      signal.throwIfAborted();
      const client = await pool.connect();
      let released = false;
      const discard = () => { if (!released) { released = true; client.release(true); } };
      signal.addEventListener("abort", discard, { once: true });
      try {
        signal.throwIfAborted();
        const result = await client.query<{
          raw_bytes: string; captured_at: string;
          records: { position: number; raw: string }[] | null;
        }>(`
          WITH records AS MATERIALIZED (
            SELECT 0 AS position, row_to_json(r)::text AS raw
            FROM (SELECT character_id, revision, snapshot FROM game_states WHERE character_id = $1) r
            UNION ALL
            SELECT r.slot_id AS position, row_to_json(r)::text AS raw
            FROM (SELECT slot_id, format_version, source_revision, snapshot, saved_at
                  FROM save_slots WHERE slot_id IN (1,2,3)) r
          ), stats AS (SELECT COALESCE(sum(octet_length(raw)),0) AS total FROM records),
          bounded AS (SELECT records.* FROM records CROSS JOIN stats WHERE stats.total <= $2)
          SELECT stats.total::text AS raw_bytes,
            to_char(statement_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS captured_at,
            COALESCE((SELECT json_agg(json_build_object('position',position,'raw',raw) ORDER BY position)
              FROM bounded),'[]'::json) AS records
          FROM stats`, [characterId, maxBytes]);
        signal.throwIfAborted();
        const row = result.rows[0];
        if (!row) throw new RawBackupFailure("unavailable");
        if (BigInt(row.raw_bytes) > BigInt(maxBytes)) throw new RawBackupFailure("too-large");
        if (!row.records) throw new RawBackupFailure("unavailable");
        return { storage: "postgres", capturedAt: row.captured_at, characterId,
          current: row.records.find(record => record.position === 0)?.raw ?? null,
          slots: ([1, 2, 3] as const).map(slotId => ({ slotId,
            record: row.records!.find(record => record.position === slotId)?.raw ?? null })) };
      } finally {
        signal.removeEventListener("abort", discard);
        if (!released) { released = true; client.release(); }
      }
    },
  };
}
