/** 修復前原稿與準備紀錄；不變更 game_states 或 save_slots。 */
export const up = pgm => {
  pgm.createTable("repair_preparations", {
    repair_id: { type: "uuid", primaryKey: true },
    character_id: { type: "text", notNull: true },
    backup_text: { type: "text", notNull: true },
  });
  pgm.addConstraint("repair_preparations", "repair_preparations_size", {
    check: "octet_length(backup_text) > 0 AND octet_length(backup_text) <= 33554432",
  });
  pgm.createIndex("repair_preparations", ["character_id", "repair_id"]);
};
// 修復前備份不可由一般 rollback 意外刪除。
export const down = false;
