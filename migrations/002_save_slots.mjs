/** 三個手動存檔槽；snapshot 只保存權威 GameState 內容，不保存 live revision。 */
export const up = (pgm) => {
  pgm.createTable("save_slots", {
    slot_id: { type: "smallint", primaryKey: true },
    format_version: { type: "integer", notNull: true },
    source_revision: { type: "bigint", notNull: true },
    snapshot: { type: "jsonb", notNull: true },
    saved_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
  });
  pgm.addConstraint("save_slots", "save_slots_id_range", { check: "slot_id BETWEEN 1 AND 3" });
  pgm.addConstraint("save_slots", "save_slots_format_positive", { check: "format_version > 0" });
  pgm.addConstraint("save_slots", "save_slots_source_revision_safe", {
    check: "source_revision >= 0 AND source_revision <= 9007199254740991",
  });
  pgm.addConstraint("save_slots", "save_slots_snapshot_object", {
    check: "jsonb_typeof(snapshot) = 'object'",
  });
};

// 手動存檔不可由一般 rollback 指令意外移除。
export const down = false;
