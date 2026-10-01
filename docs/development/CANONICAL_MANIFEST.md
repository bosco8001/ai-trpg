# Canonical Source-of-Truth Manifest

## Purpose

這份 manifest 用來避免舊文件、Prototype、聊天記錄或重複檔案覆蓋最新設計。

## Current canonical gameplay documents

優先順序相同；若它們互相衝突，**不要自行調和，先回報衝突**。

- `docs/gameplay/character_system.md`
- `docs/gameplay/magic.md`
- `docs/gameplay/combat_system.md`
- `docs/gameplay/combat_ui.md`
- `docs/world/races.md`

## World / lore documents

專案中現有的神祇、宗教、歷史、世界憲法等 dedicated world documents 可繼續作為各自領域的 source-of-truth。

但是：
- 舊 bundle 裡的 `magic.md` 不得覆蓋本 manifest 指定的新版 `docs/gameplay/magic.md`。
- 若舊世界文件與較新的專門文件產生衝突，先回報，不要靜默改寫 lore。

## Legacy / reference only

以下類型不是 canon authority：

- `blade_trpg_chat_transcript.txt`
- 舊的 `ai_trpg_world_docs.zip`
- 舊的 `ai_trpg_design_docs_bundle.zip`
- 舊版本同名 `magic.md`
- `combat_ui_prototype*.html`
- Prototype 中的測試數值、假角色、假技能、假遊戲名稱

《刀鋒》相關資料只可用來理解產品／架構方向，不可當作本遊戲世界或規則來源。

## Prototype rule

Prototype 可以證明：
- 使用者喜歡的操作流程
- 使用者確認的 UI 排布
- 使用者確認的互動方向

Prototype 不可以自動決定：
- 正式數值
- 正式名稱
- 正式程式架構
- 正式視覺素材
- 尚未確認的遊戲規則

## Unresolved decisions

見：
- `docs/development/OPEN_QUESTIONS.md`

Agent 遇到 unresolved 項目時：
1. 不得自行宣布定案。
2. 可以用獨立、可設定的 placeholder 讓 UI／工程繼續。
3. placeholder 必須清楚標記，不能反寫成 source-of-truth。

## Phase 26 已接受規格

- [完整規格](PHASE_26_FINAL_SPEC.md)：Phase 26 行為的權威來源；明列修訂優先於早期草圖。
- [Canon #1–#116 追溯索引](PHASE_26_CANON_INDEX.md)：只供編號追溯，不能取代完整規格。

- [規格與實作對照](PHASE_26_IMPLEMENTATION_MAPPING.md)、[工程驗證紀錄](PHASE_26_VERIFICATION.md)、[手動驗收清單](PHASE_26_SETTLEMENT_ACCEPTANCE.md)：工程交付文件；不代替已接受設計或使用者驗收。

## Phase 27 工程交付文件

- [手機戰鬥介面交付與測試指南](PHASE_27_MOBILE_COMBAT.md)：工程交付文件，不是新增 Canon；手機戰鬥介面的權威要求仍為 `docs/gameplay/combat_ui.md`。
- 目前階段與驗收紀錄見 [Implementation Phase Plan](IMPLEMENTATION_PLAN.md)。工程檢查與外部 Bot 報告不代替使用者手動驗收，也不能替未定規則定案。

## 後續工程規劃

- [Phase 28 唯讀資料健康檢查](PHASE_28_DATA_DIAGNOSTICS.md)：工程交付與測試指南，不是新增 Canon；已由使用者於 2026-10-01 確認手動驗收通過。
- [Phase 28 外部審查後修正](PHASE_28_REVIEW_FIXES.md)：文件狀態、查詢逾時與無障礙提示的工程紀錄；不新增 Canon，不代替使用者驗收。
- [Phase 29 手動下載原始資料備份規格](PHASE_29_RAW_DATA_BACKUP_SPEC.md)：使用者逐項確認的工程範圍與行為；不新增玩法 Canon，不批准還原或修復功能。
- [Phase 29 原始備份交付與測試指南](PHASE_29_RAW_DATA_BACKUP.md)：工程交付紀錄，等待使用者手動驗收，不是新增玩法 Canon。
- [Phase 27 之後的工作清單與建議順序](POST_PHASE_27_ROADMAP.md)：工程盤點與排序提案，不是新增 Canon；R01 的診斷已作為 Phase 28 驗收，原始備份作為 Phase 29 已工程交付、待手動驗收。
- [未定事項與後續承諾](OPEN_QUESTIONS.md) 分別標記已定待實作、待定、後續承諾與範圍候選；其中的實作排序不覆蓋上述權威規則。
