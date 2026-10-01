import pg, { type Pool } from "pg";
import type { SaveSlotId } from "../shared/save-game.js";
import type { DataDiagnosticsReader } from "./data-diagnostics.js";
import { hydrateSaveSlotRow } from "./save-game/postgres-repository.js";

/** Dedicated connections keep diagnostic deadlines separate from gameplay writes. */
export function createPostgresDiagnosticsPool(connectionString: string): Pool {
  const url = new URL(connectionString);
  // Match pg precedence: nonempty URL options override PGOPTIONS; otherwise inherit it.
  const options = url.searchParams.get("options") || process.env.PGOPTIONS || "";
  url.searchParams.set("options", `${options} -c default_transaction_read_only=on -c statement_timeout=2000`.trim());
  url.searchParams.set("statement_timeout", "2000");
  return new pg.Pool({ connectionString: url.href, max: 4, connectionTimeoutMillis: 1000 });
}

/** A separate SELECT-only path keeps diagnostics independent of session initialization. */
export function createPostgresDiagnosticsReader(pool: Pick<Pool, "query">,
  characterId: string): DataDiagnosticsReader {
  return {
    async readCurrent() {
      const result = await pool.query(
        "SELECT character_id, revision, snapshot FROM game_states WHERE character_id = $1", [characterId],
      );
      const row: unknown = result.rows[0];
      return row === undefined ? undefined : { kind: "row", value: row };
    },
    async readSlot(slotId: SaveSlotId) {
      const result = await pool.query(
        "SELECT slot_id, format_version, source_revision, snapshot, saved_at FROM save_slots WHERE slot_id = $1", [slotId],
      );
      return result.rows[0] === undefined ? undefined : hydrateSaveSlotRow(result.rows[0]);
    },
  };
}
