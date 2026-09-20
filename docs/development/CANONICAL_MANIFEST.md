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
