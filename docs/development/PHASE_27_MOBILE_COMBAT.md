# Phase 27：完整手機戰鬥介面 polish

日期：2026-10-01。工程交付完成，使用者已確認 Phase 27 手動測試通過。Phase 1–26 的使用者驗收紀錄保留。

本文件是工程交付與測試指南，不是新增 Canon。權威 UI 要求見 `docs/gameplay/combat_ui.md`；目前階段狀態見 [Implementation Phase Plan](IMPLEMENTATION_PLAN.md)。

## 本階段改動

像整理小房間：讓既有資訊和按鈕各有位置，手機操作不必把桌面畫面硬縮小。

- 緊湊頂部 HUD，保留回合與目前行動者。行動順序在自己的容器內橫向捲動，鍵盤可聚焦。
- 增加「查看戰場／前往指令」頁內捷徑，只移動閱讀位置，不消耗回合。
- 戰場維持敵後、敵前、前線、我前、我後。375px 可容納同排兩張角色卡；320px 或文字較大時自然退為單欄。單張卡佔滿該排。
- 敵人增加 `#1`、`#2` 編號，依本場名冊順序顯示；換排、死亡不重新編號。HP 條只呈現伺服器的 current／max，仍有完整數字與生命狀態文字。
- 系統判定放在戰場下方；操作欄依序顯示敘事、主角／戰況、詠唱、技能、基本指令。主角資訊補上名稱、站位、HP／MP 上限。沒有資料的種族／等級不編造。
- 手機六個基本指令採三欄兩列；救助另佔一列。技能依可用寬度排欄，按鈕可換行。手機戰鬥按鈕至少 48 CSS px 高，間距沿用 8px token。
- 攻擊選目標時，焦點移到上方選目標提示；取消回到攻擊按鈕。其他確認、合法目標、禁止行動和回合推進沿用既有流程。
- 隊伍彈窗改為單一捲動區，標題／關閉按鈕留在上方；長內容及放大文字可繼續捲動。保留 native dialog、Escape、焦點回復與原有偏好 API。
- 結果頁按鈕在手機寬度佔滿一列；系統／存檔與主選單增加按鈕間距。
- 啟用瀏海安全區及瀏覽器主題色；保留縮放。共用按鈕的 hover 限於滑鼠能力，觸控保留按下回饋，按鈕文字不因長按被選取。

正式規格以 [Combat UI](../gameplay/combat_ui.md)、[Canonical manifest](CANONICAL_MANIFEST.md) 及 [Phase 26 已接受規格](PHASE_26_FINAL_SPEC.md) 為準。本階段沒有變更 domain、API、Save Format、資料庫、規則或數值；[未定事項](OPEN_QUESTIONS.md) 持續保留。

## 檔案範圍

- `index.html`：viewport 與 theme-color。
- `src/web/CombatPage.tsx`：敵人編號、HP 條、主角資訊、資訊順序、捷徑與選目標焦點。
- `src/web/RuntimeSystemPanel.tsx`：系統按鈕容器。
- `src/web/style.css`：手機排版、觸控、彈窗與放大文字收縮設定。
- 本文件、`README.md`、`IMPLEMENTATION_PLAN.md`、`OPEN_QUESTIONS.md`：交付狀態與測試指南。

## 啟動手動測試

先停止舊開發服務。使用 Memory 測試世界，重啟 API 會清空這個測試世界。

終端機 A：

```sh
cd "/Users/bosco0295/ai trpg"
PORT=3001 DOMAIN_STORAGE=memory DOMAIN_SANDBOX=1 COMBAT_SANDBOX=1 \
COMBAT_ROLL_FIXTURE_MODE=normal COMBAT_ACTION_ROLL_FIXTURE_MODE=hit \
COMBAT_ESCAPE_ROLL_FIXTURE_MODE=success NARRATION_FIXTURE_MODE=normal \
npm run dev:api
```

終端機 B：

```sh
cd "/Users/bosco0295/ai trpg"
npm run dev:web
```

終端機 C，先裝備物理技能和詠唱法術，再開戰；這兩個 revision 只適用於剛重啟的乾淨 Memory：

```sh
curl -i http://127.0.0.1:3001/api/dev/domain/commands \
  -H 'Content-Type: application/json' \
  -d '{"type":"set-equipped-skills","skillIds":["TEST-skill-1","TEST-skill-2"],"expectedRevision":0}'
curl -i http://127.0.0.1:3001/api/dev/combat/start \
  -H 'Content-Type: application/json' -d '{"expectedRevision":1}'
```

開啟 [本機遊戲](http://127.0.0.1:5173)；若停在主選單，按「返回目前遊戲」。等待 TEST 敵方自動推進至玩家回合。之後不要用猜測的 revision 送命令，先讀取 `/api/game-state`。

實機手機：手機和電腦使用同一個可信任的區域網路；在 B 停止前端，改為：

```sh
npm run dev:web -- --host 0.0.0.0
```

手機 Safari／Chrome 開啟 Vite 顯示的 Network 網址。手機的 `127.0.0.1` 不會指向電腦。API 仍綁在電腦的 localhost，前端以既有 proxy 接入。測完在 A／B 按 Ctrl+C 停止服務。

## 使用者手動驗收清單

1. **直向閱讀**：先用 375px，再試 320px／430px；整頁不應橫向移動。行動順序可在自身區域左右滑動，當前角色仍清楚。四排和前線順序正確，敵人編號、HP 文字與條形可讀。
2. **六個指令與技能**：基本指令三欄兩列，救助另列。按「前往指令」可到操作區；按攻擊後，選目標提示進入可見位置。取消回到攻擊按鈕。非法後排目標仍停用，不改狀態。物理技能、龍息排選擇、詠唱開始／繼續／取消的文字與按鈕可讀。
3. **換排與兩欄卡片**：玩家換到後排後，主角與 TEST 隊友應在同一排，可容納時顯示兩欄。卡片必須真的移排，HP 與敵人編號保持原值。
4. **背包與隊伍**：背包可開關；使用物品確認及取消都容易按到。隊伍可查看 HP／MP、調整 TEST 偏好；關閉和 Escape 正常。開關、查看與取消不消耗回合。
5. **橫向與大文字**：旋轉實機，開隊伍、背包與各種確認區。再放大網頁文字／縮放至 200%；內容能捲動，按鈕沒有被裁掉，隊伍關閉仍可到達。Safari 地址列展開／收合時，瀏海和底部手勢區不遮擋操作；戰術下拉選單不應引起非預期的自動放大。
6. **回合與無障礙**：操作一次後，NPC 仍逐位高亮與停頓；自動流程不搶焦點。開啟減少動態效果後重試。以 Tab／Enter 操作捷徑、行動順序、指令與隊伍，焦點可見且關閉後回到隊伍按鈕。
7. **結果與存檔**：先離開／關閉遊戲頁，避免自動回合和情境產生器競爭。用以下各情境產生器分別準備，再重新進入遊戲：

```sh
node tests/helpers/phase26-manual-fixture.mjs victory
```

把 `victory` 分別換成 `escape`、`defeat` 重測。勝利／逃跑的「繼續」容易按到，返回探索；Game Over 仍只有載入／主選單路徑。結果頁隊伍可查看，行動停用。系統存檔的儲存、覆蓋確認、載入確認和取消可讀、可按；此檢查只使用上面的 Memory 測試世界。

8. **桌面回歸**：恢復一般桌面寬度，確認戰場在左、操作欄在右；目標選擇、隊伍、存檔和結果頁仍能操作。

普通攻擊、技能與龍息的正式傷害仍未接入；沒有扣 HP 不是本階段新增問題。需要 HP／瀕死／救助情境時，沿用 [Phase 25](PHASE_25_DYING_RESCUE_DEATH.md) 的 TEST 傷害入口。若測六格技能，重啟乾淨 Memory，先裝備已學的 `TEST-skill-1` 至 `TEST-skill-6`；只有既有支援的技能可操作，其餘維持未接入提示。

## 實際工程檢查

- `npm run build`：通過，包含 TypeScript、Vite 和後端編譯。
- `npm test`：312 項，288 通過、0 失敗、24 PostgreSQL 項目因未提供隔離 `TEST_DATABASE_URL` 而跳過。本階段沒有宣稱重新驗證資料庫。
- `git diff --check`：通過。
- Codex 內建瀏覽器的靜態 DOM 尺寸量測：320×568、375×812、430×932、812×375、1280×800；各情境頁面 scrollWidth 等於 clientWidth。375px 同排兩張角色卡為兩欄、指令為三欄；手機可見戰鬥按鈕至少 48 CSS px 高。
- 200% root 字級的靜態戰鬥頁，以及四位長名稱隊友的直向／橫向／大文字彈窗：無頁面或彈窗橫向溢出；彈窗有垂直可捲動範圍。375px 靜態結果頁亦無橫向溢出。HP 5/10 的條形量測為容器寬度的 50%。

靜態頁只用臨時工程資料，不連接遊戲 API，不寫存檔，不代替 React 互動、Safari／Chrome 實機、觸控、節奏或使用者驗收。使用者其後自行回報手動測試通過，驗收紀錄見下節。

## 使用者提供的 Grok 外部檢查報告

2026-10-01，使用者轉交 Grok 對分支 `codex/phase27-mobile-ui`、commit `7e7428cb73e88f2074548ffe8ac2d9287caf06c2` 的測試報告。報告標示版本時間為 2026-10-01 00:56 HKT（Asia/Hong_Kong），比較基準為 `a52aee0`，分支尚未合併。

- Grok 表示以 headless Chromium／Playwright 驅動實際 Vite 與 API，使用隔離 PostgreSQL 17，並啟動基準版前端作比較。
- 報告結論為未發現阻擋手動驗收的缺陷，沒有發現 Phase 26 結算、恢復與 Save／Load 回歸；以上是外部報告結論，不是本代理重新執行測試所得。
- Grok 表示未收到額外測試 prompt，依本文件與權威文件檢查。使用者提供的節錄沒有第 2–6 節完整內容，因此不補寫未提供的測試數字或發現。
- 文件狀態矛盾已在本機確認：六份 Phase 26 驗收／歷史文件的更新未包含在 `7e7428c`，另有過期的「Phase 27 未開始」字句。本次只統一文件狀態與來源地位；修改須另行提交，才會出現在遠端。
- 實機觸感、iOS Safari、瀏海／safe-area 與地址列伸縮仍未由此報告驗證。Grok 沒有修改檔案或合併分支，報告轉交時，使用者尚未回報 Phase 27 手動驗收結果；其後確認記錄於下節。

## 使用者手動驗收紀錄

2026-10-01（Asia/Hong_Kong），使用者回報：「手動測試後phase 27通過」。Phase 27 已由使用者確認手動驗收通過；驗收版本為 `codex/phase27-mobile-ui` 的 `7e7428cb73e88f2074548ffe8ac2d9287caf06c2`，與前述外部檢查版本一致。

此處記錄使用者的整體驗收結論，不新增未提供的逐項測試結果。使用者驗收、Grok 外部報告與本機工程檢查分開保留；本文件仍是工程交付文件，不改變 Canon 或未定規則。

## 下一步

Phase 27 已完成使用者驗收。若之後回報本階段問題，先修正該問題。既定計畫到 Phase 27 為止，後續範圍由使用者決定，尚未開始下一階段。
