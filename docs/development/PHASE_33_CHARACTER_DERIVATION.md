# Phase 33 第四切片：正式推導模組與唯讀樣本核對

日期：2026-10-07（Asia/Hong_Kong）。使用者確認最新容量規則後，指示「進入下一切片」，批准正式計算模組與唯讀樣本畫面。實作已準備，工程驗證待 Grok、階段驗收待使用者；尚未 commit／push／送達。

## 單一目標與界線

把原型的計算機接上正式五族 v2／四初階職業 v1。系統面板新增「角色屬性核對」，調整的是記憶體樣本，不建立或改寫正式角色、存檔、Run 或戰鬥；本切片不提供正式轉職／配裝／創角命令。

只支援 Lv.1、六項從 8 開始、創角分配 12 點（每項 0～6）、人類另分配 2 點。裝備與技能加成均為 0，不建立正式道具／技能；樣本資質是已知值，不是玩家可選或提前揭曉的正式創角結果。職業清單不代表角色已開放全部職業。

## 規則與資料來源

- 伺服器使用既有正式名冊 loader／resolver，嚴格限定種族版本 2、職業版本 1；不複製獨立原型名冊，不回退 TEST 內容。
- 固有屬性先合併基礎、創角分配及種族固定／自由點，再乘目前職業倍率並向下取整。無裝備／技能樣本的資格與最終數值相同。修正為 floor（(最終屬性 − 10)／2）。
- HP = 20 ＋ Lv.1 × 5 ＋最終體質 × 3；MP = 最終智慧 × 4 ＋資質加成（0／20／40／70）。資質須是該種族機率大於 0 的已知樣本。
- 使用者最新容量規則：提高上限不改目前值，降低時只截掉超過新上限的部分；零 HP 維持 0。合法資源下，新目前值 = min（原目前值，新上限）。不保留隱藏差額；已撤回的 B 不是本切片依據。
- 範例 40／40 → 40／54 → 40／40；50／54 → 40／40 → 40／54，截掉的 10 點不因換回上限自動恢復。低資源 5／55 → 5／49、2／60 → 2／52，不產生負值。
- 以上樣本容量預覽供核對；種族、分配、資質的樣本修改不是正式角色可執行的變更命令。正式升級、技能、暫時效果等上限政策不由此擴大裁定。

## 介面與同步

`POST /api/character-derivation/preview` 是不寫入資料的計算操作。請求必須恰含 schemaVersion 1、raceCatalogVersion 2、classCatalogVersion 1、sample、resources；sample 恰含 level、raceId、classId、aptitude、allocation、raceAllocation；resources 恰含 currentHp、maxHp、currentMp、maxMp。

resources 是明確提供的核對基準，不是讀取遊戲角色。原目前值必須是合法整數且介於 0 與原上限；HP 上限至少 1，MP 上限可為 0。非法原值整份拒絕，不能藉 clamp 修復原本非法資料。Body limit 4096 bytes、回應 no-store，解析及規則錯誤回固定訊息，不回傳原請求、stack 或內部路徑。

回應包含版本與 sample scope、輸入快照、正式種族／職業名稱、六項推導明細、資質加成及 before／after 資源。前端只接受完整、有界且吻合本次樣本／基準／版本的回應；計算失敗保留原樣本。核對服務沒有 session、repository、PG 或 LLM 依賴。

## 手機流程與視覺

共同沿用已接受的 Mobile Design System 02：冷黑／魔導青／餘燼橙、明亮按鈕底、Heiti TC 與系統字型備援、緊湊六屬性格、數字等寬。沒有替換其他正式遊戲畫面。

- game-ui-ux：總覽／編輯／明細共用一個原生 modal dialog；入口焦點、返回焦點與 Escape 層級隔離；樣本與草稿分離，狀態由事件更新。
- ui-ux-pro-max：主總覽只留 HP／MP、六屬性、來源摘要與兩個入口；表單／長明細放 Sheet 內捲動。可重排格線、原生 label／number／select、48 CSS px 最小觸控目標、明確錯誤與狀態語意。
- apple-design：統一字階、4／8 間距節奏、短按壓回饋與 180ms 非手勢進場，不鎖動畫期間的操作； reduced-motion 停用位移與 transition。新技能／裝備介面不在本切片重做。

編輯先按「預覽數值」，成功後按「更新核對樣本」才更新總覽；修改任何草稿欄位都撤銷舊預覽並取消舊請求。取消／關閉不套用草稿，逾時或遲到回應不能覆蓋新草稿。樣本可在 Sheet 內設定目前 HP／MP，用來核對零 HP 或下降截低；重新整理／卸載系統面板會清除記憶體樣本。初始 HP 40／55、MP 48／60 是明確工程 fixture，不決定正式角色初始資源。

## 本切片檔案

| 範圍 | 檔案 |
|---|---|
| 共用契約／純規則 | src/shared/character-derivation.ts、src/domain/character-derivation.ts |
| 唯讀伺服器介面 | src/server/character-derivation.ts、src/server/app.ts |
| 畫面／讀取／草稿 | src/web/CharacterDerivationPanel.tsx、src/web/character-derivation-client.ts、src/web/character-derivation-ui.ts、src/web/character-derivation.css |
| 正式入口／樣式載入 | src/web/ExplorationPage.tsx、src/web/main.tsx |
| 必要測試 | tests/character-derivation.test.ts |
| 文件 | 本文件、完整 Grok prompt、提案、Character／Classes、Phase 26 後續修訂、Manifest／Open Questions／Implementation Plan |

獨立原型程式不改，保留修訂前比較；其 README 與歷史討論的最新狀態說明另同步。前一切片未提交的 ClassCatalogPanel／class-catalog.css／main.tsx 補修依舊存在，不冒稱本切片的新成果。

## 手動核對清單（先等工程驗證）

1. 重建／重啟後，探索 → 系統 → 角色屬性核對。起始人類／劍士，力量 15、HP 40／55、MP 48／60；明細顯示先加人類 2 點再乘 1.25。
2. 調整樣本 → 魔術師 → 預覽：智慧 12、MP 48／68。目前 MP 不增加；確認後才更新。改回劍士仍為 MP 48／60。
3. 在人類樣本設定目前 HP 為 50，改成精靈／劍士／高資質，保留六項各 2 點：HP 預覽 49／49；確認後改回人類／劍士／普通，HP 為 49／55，沒有補回截掉的 1 點。
4. 在樣本設定 HP 為 0，再改體質分配，維持 12 點：更新後仍為 0。這只是零 HP 核對，不是遊戲救援。
5. 少分／多分／小數／超過原上限的目前資源顯示錯誤，不能套用；取消保留原樣本。預覽成功後再改一個欄位，必須重新預覽。
6. 關閉／Esc 返回核對入口，不能同時關掉外層系統面板。取消編輯回到「調整樣本」焦點；明細返回其入口。
7. 手機寬度、橫向、大字與 reduced-motion：主要操作可見、內容只在 Sheet 內捲動、無橫向溢出、觸控與焦點可用；實際結果由使用者／Grok 回報。

## 工程狀態與下一步

Codex 僅實作、閱讀程式／Git／文件及撰寫 8 項測試，沒有執行 build、typecheck、格式檢查、單元／整合／資料庫或 UI 測試。Grok 未送達、沒有本切片 PASS；舊原型的 9／9、60 組畫面與其他 build 結果不沿用。

交接 prompt 見 [工程驗證要求](PHASE_33_CHARACTER_DERIVATION_GROK_REVIEW.md)。目前本地 HEAD 是 6dfa95e1d84cb1c7ef0a1aa64be13919f3cf8316，本切片仍在工作樹，未有 bot 可讀 TARGET。先依限定 Git 範圍取得授權／固定版本，送達後再等外部回報；最後是否通過仍由使用者決定。

本切片接受後才討論正式角色／創角與持久狀態接入；初始資源、引用升版、不合格配裝等未定契約須另行確認。本文件不宣告 R05 或整個 Phase 33 完成。
