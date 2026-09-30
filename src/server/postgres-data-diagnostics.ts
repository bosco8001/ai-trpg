import type { Pool } from "pg";
import type { SaveSlotId } from "../shared/save-game.js";
import type { DataDiagnosticsReader } from "./data-diagnostics.js";
import { hydrateSaveSlotRow } from "./save-game/postgres-repository.js";

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
