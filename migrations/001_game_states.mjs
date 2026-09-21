/** 保存經 domain 驗證的 GameState JSON snapshot；後續小切片可沿用，不預建額外資料表。 */
export const up = (pgm) => {
  pgm.createTable("game_states", {
    character_id: { type: "text", primaryKey: true },
    revision: { type: "bigint", notNull: true },
    snapshot: { type: "jsonb", notNull: true },
  });
  pgm.addConstraint("game_states", "game_states_revision_safe", {
    check: "revision >= 0 AND revision <= 9007199254740991",
  });
  pgm.addConstraint("game_states", "game_states_snapshot_object", {
    check: "jsonb_typeof(snapshot) = 'object'",
  });
};

// 已保存的遊戲資料不可由一般 rollback 指令意外移除。
export const down = false;
