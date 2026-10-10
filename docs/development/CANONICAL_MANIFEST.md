# Canonical Source-of-Truth Manifest

## Purpose

這份 manifest 用來避免舊文件、Prototype、聊天記錄或重複檔案覆蓋最新設計。

## Current canonical gameplay documents

優先順序相同；若它們互相衝突，**不要自行調和，先回報衝突**。

- `docs/gameplay/character_system.md`
- `docs/gameplay/classes.md`（2026-10-06 指定製作的四初階職業；收錄已確認規則，未定部分保留）
- `docs/gameplay/starter_kits.md`（2026-10-10 使用者選 A，批准四職業配套、八件物品與四項能力的首版門檻／加成／護甲值；名冊與唯讀核對，不含發放保存或戰鬥接入）
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

2026-10-07 使用者撤回保留缺少量與 B 方案，改採穿上裝備提高最大 HP／MP 時，目前值不變（40／40 → 40／54）。使用者其後回覆「確定」：卸下裝備或切換職業降低上限時，只有超出新上限的部分才截低；職業提高上限同樣不恢復目前值；不另存隱藏差額。第四切片 `bb93008` 已獲 Grok t47u 外部工程 PASS（限 Chrome），使用者已於 2026-10-07 接受第四切片；正式角色／存檔尚未接入，原型程式保留舊算法，舊驗證結果不涵蓋此修訂。 先種族後職業、HP／MP 採最終屬性及零 HP 不復活維持；最新政策以 Character 的「上限變化」為準。

- [完整規格](PHASE_26_FINAL_SPEC.md)：Phase 26 行為的權威來源；明列修訂優先於早期草圖。
- [Canon #1–#116 追溯索引](PHASE_26_CANON_INDEX.md)：只供編號追溯，不能取代完整規格。

- [規格與實作對照](PHASE_26_IMPLEMENTATION_MAPPING.md)、[工程驗證紀錄](PHASE_26_VERIFICATION.md)、[手動驗收清單](PHASE_26_SETTLEMENT_ACCEPTANCE.md)：工程交付文件；不代替已接受設計或使用者驗收。

## Phase 27 工程交付文件

- [手機戰鬥介面交付與測試指南](PHASE_27_MOBILE_COMBAT.md)：工程交付文件，不是新增 Canon；手機戰鬥介面的權威要求仍為 `docs/gameplay/combat_ui.md`。
- 目前階段與驗收紀錄見 [Implementation Phase Plan](IMPLEMENTATION_PLAN.md)。工程檢查與外部 Bot 報告不代替使用者手動驗收，也不能替未定規則定案。

## 後續工程規劃

- [Phase 33 第七切片：正式起始配套名冊](PHASE_33_STARTER_KIT_CATALOG.md)：使用者選 A，批准原型門檻／加成／護甲值作首版正式數值及名冊／唯讀核對範圍；首版 `49f23f9aa6e627012063b8d3cf5d754557d6886e` 已推送，指定 AI TRPG Architecture Critic 於 2026-10-10 22:07（Asia/Hong_Kong）回報外部工程 PASS；隔離 PG 全套 461／461、0 skip，保留沿用 Low L-1 與五項 Info。Codex 未親測。起始配套 Sheet 短畫面／大字、按鈕瞬間對比及三類測試缺口的同切片補修已準備，尚未提交或送達複驗，首版 PASS 不涵蓋補修。待使用者最終驗收。以下第六切片「正式數值未定／下一切片未開始」為其接受當時狀態。

- [Phase 33 第六切片：獨立起始配套與換裝原型](PHASE_33_STARTER_KIT_PROTOTYPE_PROPOSAL.md)：使用者於2026-10-10回覆「通過」，本原型已接受；Grok對 `72d804335d6f9aa32fbddddd9b93fe7c72228f27` 外部工程PASS、無新缺陷。人類單一14點／初始全零補修包含在接受範圍，Codex未親測。舊N1 Low、Info、DB略過與未測限制保留，不代表正式數值定案或正式角色／存檔接入，不宣告整個Phase 33完成，下一個主要切片未開始。詳見原型README。本項僅登記驗收，不新增Canon。以下第五切片的下一步狀態屬當時紀錄。

- [Phase 33 第五切片：角色建立與保存](PHASE_33_CHARACTER_CREATION.md)：**使用者已於 2026-10-10 接受。** 指定 AI TRPG Architecture Critic 於 2026-10-09 20:53 回報 `7dddce1a02c7171986666b6ea0b06c656a2a2873` 外部工程 PASS、無新缺陷：T1 原檔 helper 四組通過，efaa636 反向證明抓到 M1，獨立鍵盤四次切換 TARGET 16／16；本輪 build、隔離 PG 全套 453／453 通過。Codex 未親測。使用者於 2026-10-10（Asia/Hong_Kong）明確回覆「Phase 33 第五切片：角色建立與保存通過。」 本次接受僅限第五切片，不補寫手動驗收環境或逐項操作結果，也不代表整個 Phase 33 完成。先前未送達為即時讀回誤判，實際完整要求已送達並用於複驗，本輪不重送。新 Info 是案例首行「尚未執行」過時，N9／N10／I1／N8 與歷史 Info、引用／推斷、未測及 Safari／WebKit 受阻保留。正式多角色、起始行囊及冒險另分切片；未開始下一切片。

- [Phase 33 第四切片：正式推導與唯讀樣本核對](PHASE_33_CHARACTER_DERIVATION.md)：使用者於 2026-10-07 指示「進入下一切片」，批准正式推導模組、唯讀計算介面及手機核對畫面；採最新裝備／職業容量政策。已提交／推送並送達 `bb930080ac917a90fc2f6bdf0ecca888ebfcbe87`；Grok t47u 外部工程 PASS（限 Chrome），名冊核對等 6 項 Info 與未測限制保留，使用者已於 2026-10-07 接受第四切片。Codex 未執行本輪工程測試。不是正式創角／轉職／配裝或存檔整合，不沿用原型 PASS。

- [Phase 33 第三切片：角色推導原型](PHASE_33_CHARACTER_DERIVATION_DISCUSSION.md)：使用者於 2026-10-07 明確授權本輪改由 Codex 親測，工程 PASS；原型 9／9、五族 × 四職業 20 組核對與補修後 60 組 Chrome 畫面檢查通過，build 成功，全套無 DB 377 pass／0 fail／41 skipped。短螢幕大字操作列問題已補修，歷史失敗與略過／未測限制保留；原型接受當時沒有 Grok 結果、尚未 commit／push；其後於 `bb93008` 封存，原型舊算法未改；使用者於同日明確回覆「接受這原形」，本獨立原型已接受，不代表正式 R05 或整個 Phase 33 已完成。正式角色、存檔及戰鬥同步尚未接入，原型接受當時的未定下限與配裝規則保留；後續曾選 B，其後已撤回並改採裝備提高上限不補充資源；本次親測例外不延伸後續階段。

- [Phase 33 第二切片：正式職業名冊](PHASE_33_CLASS_CATALOG.md)：四個初階職業 metadata、獨立職業版本 1 及唯讀核對 Sheet；使用者於 2026-10-06 明確改由親自驗收本次補修並回覆第二切片通過，已接受；回報 build 成功、377 pass／0 fail／41 skipped。首版 `6dfa95e` 的 Grok t46u 外部工程 FAIL（Chrome）保留，沒有補修 Grok PASS；Info、41 項略過及未測限制保留。補修／紀錄其後已隨 `bb93008` 提交；t47u 只記錄前置回歸觀察，沒有另判第二切片工程 PASS。五族第一切片及獨立 UI 原型的接受不代替本切片驗收。

- [Phase 33 正式內容名冊第一步](PHASE_33_CONTENT_CATALOG.md)：R04 的五種族創角資料小切片；首版 `641b82f` 外部工程未通過，D1／D2 補修 `8792e15` 的內容版本 1 已獲外部工程 PASS。使用者核對時澄清所有角色資質均於創角後揭曉，並要求移除普通人／代行者畫面提示；相應 Canon、內容版本 2 與 UI 同切片修正 `940e1f3` 已獲外部工程 PASS；使用者回報新版文案及五族數值正常並選定緊湊資料卡，正式排版 `cd4cbb4` 外部工程 FAIL（Low D1：小螢幕大字數值溢格），同切片自適應欄數補修 `9a4471a` 已獲外部工程 PASS，D1 修正，使用者其後回報其他項目正常並要求縮小負號，負號微調 `8a59cfe` 已獲第一切片當輪外部工程 PASS，使用者於 2026-10-05 明確回覆「Phase 33 第一切片通過」，本切片已接受；新增無障礙文字分段及樣式測試缺口兩項 Info 保留；Chrome 以外與真手機／讀屏未測。不是完整創角／職業／物品／技能／種族能力系統，既有 Info 與未測限制保留。

- [Phase 32 修復套用交付](PHASE_32_REPAIR_APPLICATION.md)：R03 第二階段實作、故障狀態、維運 epoch、外部工程結果及使用者驗收；使用者於 2026-10-04 明確回覆「phase 32通過」。接受後 L-C 容量提示補修的 `efcdb4b` 首次複驗 FAIL 及修正後 `828d520` 外部工程 PASS 均有記錄；依使用者限定授權及完整結果，本次補修已判定通過，不延伸至其他階段。新兩項 Info、既有觀察與未測限制保留，不新增 Canon。

- [R03 原子套用討論紀錄](R03_REPAIR_APPLY_DISCUSSION.md)：十項選擇及第一階段完整範圍已確認；第二階段完整契約已於 2026-10-04 批准，文件工程審查已完成，Phase 32 已於 2026-10-04 由使用者驗收通過，不新增 Canon。
- [R03 第二階段完整批准範圍](R03_SECOND_STAGE_PROPOSAL.md)：八項選擇與原子套用、再次確認、持久結果及故障契約已批准；文件工程審查已完成；實作作為 Phase 32 交付，已於 2026-10-04 由使用者驗收通過。契約提交當時的七份文件 commit／push 另獲單次授權，不延伸至後續實作；Phase 32 實作及補修另獲授權。
- [Phase 31 已批准完整範圍](R03_FIRST_STAGE_PROPOSAL.md)：2026-10-02 批准的持久備份、準備識別碼、查詢與下載，不批准套用、不新增 Canon。
- [Phase 31 工程交付](PHASE_31_REPAIR_PREPARATION.md)：已由使用者於 2026-10-03 確認驗收通過；工程結果與文件核對保留各自來源及版本，不將未測限制改標通過，不代替玩法設計或批准套用。
- [Phase 30 修復候選預覽規格](PHASE_30_REPAIR_PREVIEW_SPEC.md)：使用者確認的有限工程規則，只產生唯讀候選，不新增玩法 Canon、不批准修復套用。
- [Phase 30 交付與測試指南](PHASE_30_REPAIR_PREVIEW.md)：工程交付與使用者驗收紀錄，已由使用者於 2026-10-01 確認 R02 通過；不代替已接受設計。R03 第一階段為 Phase 31，套用作為 Phase 32 已於 2026-10-04 由使用者驗收通過。

- [Phase 28 唯讀資料健康檢查](PHASE_28_DATA_DIAGNOSTICS.md)：工程交付與測試指南，不是新增 Canon；已由使用者於 2026-10-01 確認手動驗收通過。
- [Phase 28 外部審查後修正](PHASE_28_REVIEW_FIXES.md)：文件狀態、查詢逾時與無障礙提示的工程紀錄；不新增 Canon，不代替使用者驗收。
- [Phase 29 手動下載原始資料備份規格](PHASE_29_RAW_DATA_BACKUP_SPEC.md)：使用者逐項確認的工程範圍與行為；不新增玩法 Canon，不批准還原或修復功能。
- [Phase 29 原始備份交付與測試指南](PHASE_29_RAW_DATA_BACKUP.md)：工程交付與使用者驗收紀錄，Phase 29 已由使用者於 2026-10-01 確認手動驗收通過，不是新增玩法 Canon。
- [Phase 27 之後的工作清單與建議順序](POST_PHASE_27_ROADMAP.md)：工程盤點與排序提案，不是新增 Canon；R01 的診斷已作為 Phase 28 驗收，原始備份作為 Phase 29 已由使用者手動驗收通過。
- [未定事項與後續承諾](OPEN_QUESTIONS.md) 分別標記已定待實作、待定、後續承諾與範圍候選；其中的實作排序不覆蓋上述權威規則。
