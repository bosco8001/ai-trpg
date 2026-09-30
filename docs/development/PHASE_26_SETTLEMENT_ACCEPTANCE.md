# Phase 26：戰鬥結算與返回探索 — 手動驗收

工程狀態見 [實際驗證紀錄](PHASE_26_VERIFICATION.md)。本文件的項目仍等待使用者驗收；工程檢查不代表玩法、介面、節奏或手機可用性已接受。

這一階段像把戰場記分板交回角色簿。結果頁先保留戰場最後的數字；按「繼續」才整包寫回長期資料，再返回原探索位置。

已接受設計：[完整規格](PHASE_26_FINAL_SPEC.md)、[Canon 索引](PHASE_26_CANON_INDEX.md)。程式與規格對照見 [實作對照](PHASE_26_IMPLEMENTATION_MAPPING.md)。

## 本次修正的第一個驗收步驟：詠唱中勝利與 MP 繼承

審查提出的 H1／M1／M2／L1 已完成工程修正，詳見 [修正與回歸證據](PHASE_26_REVIEW_FIXES.md)。本節先重測原本會回 HTTP 500 的流程。

先停止舊 API、關閉遊戲頁。終端機 A 啟動 Memory TEST API；本情境讓 sourceEncounterId=null，方便之後開始下一場：

```sh
cd '/Users/bosco0295/ai trpg'
NODE_ENV=development DOMAIN_STORAGE=memory DOMAIN_SANDBOX=1 COMBAT_SANDBOX=1 COMBAT_ROLL_FIXTURE_MODE=normal COMBAT_ENCOUNTER_FIXTURE=0 npm run dev:api
```

終端機 B 準備情境，再開前端：

```sh
cd '/Users/bosco0295/ai trpg'
node tests/helpers/phase26-manual-fixture.mjs casting-victory
npm run dev:web
```

產生器先裝備 `TEST-skill-2`、開始詠唱一次，再於詠唱仍存在時擊殺兩位敵人；不會先取消詠唱。它會停在結果頁，把「繼續」留給你操作。

- [ ] 開啟 <http://localhost:5173>，結果頁為勝利，玩家 HP 10/10、MP 18/24；隊友 HP 8/8，兩位敵人死亡。
- [ ] 刷新仍停在結果頁。API 中 `activeCastings=[]`，Persistent MP 此時仍為 24。
- [ ] 只按一次「繼續」，等待時不能再按；正常返回探索，Persistent MP 18/24。
- [ ] 全新 Memory 程序的 ended revision=7，繼續後=8；非全新程序以產生器輸出的 endedRevision 為準，只加 1。
- [ ] 關閉遊戲頁，以 GET 讀取目前 revision，把下列 `N` 換成該數字，再 Start；新 CombatId 不同，玩家起始 MP 仍為 18/24。

```sh
curl -s http://127.0.0.1:3001/api/game-state
curl -s -X POST http://127.0.0.1:3001/api/dev/combat/start -H 'Content-Type: application/json' -d '{"expectedRevision":N}'
```

這個情境會 Reset TEST 世界，保留存檔槽。工程已驗證 API 與資源數值；按鈕、刷新、返回探索與畫面仍由使用者驗收。

## 基本驗收：勝利、瀕死隊友與繼續

先關閉遊戲頁，避免既有 NPC 自動節奏在準備情境時推進回合。以下只建立 TEST fixture，不修改正式資料。情境產生器會明確 Reset 目前 TEST 世界；Reset 不刪存檔槽。

終端機 A：

```sh
cd '/Users/bosco0295/ai trpg'
NODE_ENV=development DOMAIN_STORAGE=memory DOMAIN_SANDBOX=1 COMBAT_SANDBOX=1 COMBAT_ROLL_FIXTURE_MODE=normal COMBAT_ESCAPE_ROLL_FIXTURE_MODE=success COMBAT_ENCOUNTER_FIXTURE=1 npm run dev:api
```

終端機 B：

```sh
cd '/Users/bosco0295/ai trpg'
node tests/helpers/phase26-manual-fixture.mjs victory
npm run dev:web
```

開啟 Vite 顯示的本機網址，通常為 <http://localhost:5173>。

全新 Memory 程序的預期版本：初始 0、Reset 1、Start 2、玩家受傷 3、隊友瀕死 4、兩位敵人死亡 5／6。若不是全新程序，以產生器輸出的 `resetRevision=R` 為準：結果頁 `R+5`，繼續後 `R+6`。

- [ ] 結果頁顯示勝利；玩家 HP 7/10、MP 24/24，隊友 HP 0/8、瀕死，兩位敵人死亡。
- [ ] 尚未按繼續時，刷新仍停在結果頁；沒有自行救助、倒數、補血或返回探索。
- [ ] 只按一次「繼續」。等待時按鈕不可重複操作。
- [ ] 返回 TEST 森林邊緣。玩家長期 HP 7/10、MP 24/24；隊友 HP 1/8、active、MP 0/0，仍在 Party。
- [ ] `combat=null`、revision 只加 1、`TEST-encounter-1.resolved=true`，generation 保留。
- [ ] 出現一篇戰後敘事；沒有 XP、金錢、掉落物或未確認傷勢。刷新後仍可讀取已保存敘事。

可用另一個終端機讀取資料：

```sh
curl -s http://127.0.0.1:3001/api/game-state
```

按繼續前，Persistent 玩家仍為 10/10，隊友仍為 8/8；這是尚未交接的長期資源，畫面必須顯示 Combat 的 7/10 與 0/8。戰鬥中不能把 Persistent 舊值當作目前資源。

## 其他結果與資源

每次準備情境前先關閉遊戲頁，或返回主選單停止該頁的節奏工作，再執行產生器，最後重新整理遊戲頁。

| 產生器指令 | 結果頁 revision | 繼續／結算預期 |
|---|---|---|
| `node tests/helpers/phase26-manual-fixture.mjs victory` | `R+5` | `R+6`；玩家 7/10、隊友 1/8；Encounter resolved |
| `node tests/helpers/phase26-manual-fixture.mjs escape` | `R+4` | `R+5`；玩家 6/10、隊友 8/8；Encounter unresolved |
| `node tests/helpers/phase26-manual-fixture.mjs defeat` | `R+3` | 全隊瀕死，Game Over；無繼續，不結算、不清 Combat |
| `node tests/helpers/phase26-manual-fixture.mjs dead-companion` | `R+13` | `R+14`；玩家 7/10；隊友長期 dead、HP 0，移出 Party；Character 與 Inventory 保留 |

`R` 是每次 Reset 成功後輸出的 revision。所有數值是已知 TEST fixture，沒有變成正式角色預設值。

- [ ] Escape 後不在同一次結算重開戰鬥，也不解決 Encounter。
- [ ] Game Over 保留 Combat HP／lifeState，Persistent current resources 不被敗北寫回。
- [ ] Game Over 的系統／存檔與主選單可操作；不顯示繼續。
- [ ] dead-companion 結果頁先顯示死亡；結算後 Party 不補員，存活順序不變，死者仍在 `phase26.characters`。
- [ ] Combat 存在時，普通探索、技能裝備修改與第二次 Start 安全拒絕，revision 不增加。

### 下場戰鬥不補資源

使用 Escape 情境。繼續後先關閉頁面，讀取目前 revision，將 `N` 換成該數字：

```sh
curl -s -X POST http://127.0.0.1:3001/api/dev/combat/start -H 'Content-Type: application/json' -d '{"expectedRevision":N}'
```

- [ ] 新 CombatId 與上一場不同；同一 Encounter 仍 unresolved。
- [ ] 玩家起始 HP 6/10、MP 24/24；不是 10/10。
- [ ] 已死亡且移出 Party 的隊友不會因 Start 回來。若要另測勝利後的普通 TEST 新戰鬥，啟動時省略 `COMBAT_ENCOUNTER_FIXTURE=1`，使 sourceEncounterId=null；resolved Encounter 不能拿來重開。

### MP 繼承

可直接使用本文件第一節的 `casting-victory` 情境；不要先取消詠唱。若想逐步操作，沿用 [Phase 19 施法操作](PHASE_19_MULTI_TURN_CASTING.md)：開始戰鬥前在探索裝備 `TEST-skill-2`，玩家回合開始詠唱一次，確認 Combat MP 18/24，Persistent MP 仍為 24。以 TEST 傷害入口讓敵人死亡後按繼續：Persistent MP 必須為 18/24；新場 Combat 也必須 18/24。結束詠唱與清除 casting 都不退款。

永久／temporary capacity 沒有新增玩家按鈕；本階段以 domain 測試驗證契約，不用 TEST capacity 數值推定正式 buff 或裝備規則。

## Save／Load 與結果頁

先準備 victory，保留結果頁，不按繼續。

- [ ] 開啟「系統／存檔」，保存至一個空槽；若已有內容，確認覆蓋的是 TEST 存檔。
- [ ] Save 不改 revision。保存的是完整 Combat、Persistent、Party、Inventory、Encounter、探索與已保存 History。
- [ ] 按繼續返回探索，再由系統面板載入剛才的結果頁存檔。
- [ ] Load 後 revision 是載入前 +1；CombatId 不變，generation 更換，History 恢復存檔當時內容。
- [ ] 結果頁仍顯示 Combat 最後資源，不暗中結算。再次按繼續是新的 settlementRevision，可以產生新篇敘事。
- [ ] active Combat 與 Game Over 也能 Save／Load。載入健康探索存檔會離開 Game Over；載入 Game Over 存檔仍為 Game Over。
- [ ] Load 確認前不切換世界；取消確認不送 mutation。

Memory 程序停止會失去 Memory state 與存檔；跨 API 程序重啟請用下節 PostgreSQL。

## PostgreSQL：獨立測試資料庫與重啟

本次工程使用 PostgreSQL 15 的專用 cluster `/private/tmp/ai-trpg-phase26-pg`，只監聽 `127.0.0.1:55426`，使用者 `phase26_test`。不使用 `.env` 的正式 DATABASE_URL，不刪 volume，不更換正式 Save。

以下初始化只在第一次建立手動驗收資料庫時執行。若 cluster 已停止，先以同一個 `-D` 啟動；若路徑不存在，需先建立獨立測試 cluster，不能改用正式資料庫。

```sh
/opt/homebrew/opt/postgresql@15/bin/pg_ctl -D /private/tmp/ai-trpg-phase26-pg status
# 僅在上述專用 cluster 已停止時執行：
/opt/homebrew/opt/postgresql@15/bin/pg_ctl -D /private/tmp/ai-trpg-phase26-pg -l /private/tmp/phase26-postgres.log -o '-p 55426 -h 127.0.0.1 -k /private/tmp' start
```

首次建立資料庫與套用 migration：

```sh
/opt/homebrew/opt/postgresql@15/bin/createdb -h 127.0.0.1 -p 55426 -U phase26_test ai_trpg_phase26_manual
cd '/Users/bosco0295/ai trpg'
DATABASE_URL=postgres://phase26_test@127.0.0.1:55426/ai_trpg_phase26_manual npm run db:migrate
DATABASE_URL=postgres://phase26_test@127.0.0.1:55426/ai_trpg_phase26_manual npm run db:migrate:dry-run
```

停止原 Memory API。終端機 A 改為：

```sh
NODE_ENV=development DOMAIN_STORAGE=postgres DATABASE_URL=postgres://phase26_test@127.0.0.1:55426/ai_trpg_phase26_manual DOMAIN_SANDBOX=1 COMBAT_SANDBOX=1 COMBAT_ROLL_FIXTURE_MODE=normal COMBAT_ESCAPE_ROLL_FIXTURE_MODE=success COMBAT_ENCOUNTER_FIXTURE=1 npm run dev:api
```

終端機 B 同樣準備情境並開啟前端。重做第一節與 Save／Load，額外測試：

- [ ] 結果頁 Save 後，以 Ctrl+C 停止 API，再用相同指令啟動。revision、CombatId、generation、Combat／Party／Inventory 保留。
- [ ] 結算後停止並重啟，Persistent HP／MP、Encounter、History／Entry ID 保留。
- [ ] Load 舊結果頁後，再重啟；generation 保留載入後的新值，allocator 不回退。
- [ ] 比較 `phase26.sequenceHighWater`：Load／Reset 不降低，新 Entry sequence 大於此前已保留的序號。

另有可重複執行的工程重啟檢查，只允許專用測試 URL：

```sh
TEST_DATABASE_URL=postgres://phase26_test@127.0.0.1:55426/ai_trpg_phase26_restart node tests/helpers/phase26-restart-check.mjs
```

此腳本會 Reset 該測試世界並使用該測試 DB 的 Slot 1。它使用 30426，與手動 API 3001 分開。此為工程檢查，不代替人工驗收。

## 健康存檔與受阻舊存檔同時存在

本節只建立隔離工程樣本；不使用正式存檔。先停止目前 API，首次建立另一個空的驗收 DB：

```sh
/opt/homebrew/opt/postgresql@15/bin/createdb -h 127.0.0.1 -p 55426 -U phase26_test ai_trpg_phase26_review_manual
cd '/Users/bosco0295/ai trpg'
DATABASE_URL=postgres://phase26_test@127.0.0.1:55426/ai_trpg_phase26_review_manual npm run db:migrate
TEST_DATABASE_URL=postgres://phase26_test@127.0.0.1:55426/ai_trpg_phase26_review_manual node --import tsx tests/helpers/phase26-mixed-slots-fixture.mjs
NODE_ENV=development DOMAIN_STORAGE=postgres DATABASE_URL=postgres://phase26_test@127.0.0.1:55426/ai_trpg_phase26_review_manual DOMAIN_SANDBOX=1 COMBAT_SANDBOX=1 npm run dev:api
```

產生器只接受指定隔離 URL；槽 1 或 3 已有資料時會拒絕，整筆 rollback，不覆蓋原資料。首次成功後不用再準備。前端沿用 `npm run dev:web`。

- [ ] 開啟系統／存檔：槽 1 顯示健康存檔，可「載入」；槽 3 顯示「無法載入」及舊存檔映射受阻原因；槽 2 為空。
- [ ] 槽 3 不顯示載入按鈕。原始資料保留，不會因讀清單而刪除或轉換。
- [ ] 載入槽 1 的確認與取消正常；確認後 live revision 只加 1。
- [ ] 讀取清單回 HTTP 200；直接要求載入槽 3 仍回 422 migration-blocked。
- [ ] 「覆蓋」仍須明確確認；本項不要覆蓋槽 3，以便保留工程樣本。

## 敘事失敗、延遲與錯誤恢復

### 模型故障

Memory 可以停止後重新啟動；PostgreSQL 保留資料，用同一 URL 啟動。依序加入下列其中一個旗標：

```sh
NARRATION_FIXTURE_MODE=unavailable
NARRATION_FIXTURE_MODE=timeout
NARRATION_FIXTURE_MODE=malformed
```

每次啟動後先建立 victory，再按繼續。

- [ ] Gameplay 仍成功；只增加一次 revision，返回探索。
- [ ] 保存一篇 conservative fallback，`source=fallback`；沒有自動重做 Settlement。
- [ ] timeout 後晚到 model 不替換 fallback，不多寫 Entry。
- [ ] normal 使用 TEST fake adapter，經既有 LanguageModel 介面，`source=model`。這不表示已選定正式供應商。

### 未保存文字（僅隔離 PostgreSQL）

本情境只在 `ai_trpg_phase26_manual` 執行。先建立 victory，再加入只拒絕 History append 的測試 trigger；不要在正式 DB 使用。將以下內容存成 `/private/tmp/phase26-unsaved.sql`：

```sql
DO $$ BEGIN
  IF current_database() <> 'ai_trpg_phase26_manual' THEN
    RAISE EXCEPTION 'not phase26 manual database';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION phase26_test_fail_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.character_id = 'TEST-character' AND NEW.revision = OLD.revision
    AND jsonb_array_length(NEW.snapshot #> '{phase26,history}') > jsonb_array_length(OLD.snapshot #> '{phase26,history}') THEN
    RAISE EXCEPTION 'test history failure';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER phase26_test_fail_history BEFORE UPDATE ON game_states
FOR EACH ROW EXECUTE FUNCTION phase26_test_fail_history();
```

```sh
/opt/homebrew/opt/postgresql@15/bin/psql postgres://phase26_test@127.0.0.1:55426/ai_trpg_phase26_manual -v ON_ERROR_STOP=1 -f /private/tmp/phase26-unsaved.sql
```

- [ ] 按繼續：玩法仍完成；當次文字可顯示，並提示「本次文字未保存」。
- [ ] History 不把該文字當作正式 Entry；Save／刷新／Load 不補出未保存文字。
- [ ] 不重叫 AI、不重送結算，也不無限 retry DB。

測完移除測試 trigger：

```sh
/opt/homebrew/opt/postgresql@15/bin/psql postgres://phase26_test@127.0.0.1:55426/ai_trpg_phase26_manual -v ON_ERROR_STOP=1 -c 'DROP TRIGGER phase26_test_fail_history ON game_states; DROP FUNCTION phase26_test_fail_history();'
```

### 網路與競爭

- [ ] 在結果頁讓請求網路逾時／中斷，畫面不能自動再送「繼續」。DevTools Network 檢查只有一次 mutation，恢復只 GET。
- [ ] GET 成功後依目前權威場景顯示；文案不憑空宣稱原請求成功。
- [ ] GET 失敗時停止 mutation，但仍可重新讀取、Load 或主選單。
- [ ] 兩個分頁對同一 revision 按繼續，最多一個成功，另一個 conflict；不自動拿新 revision 重送。
- [ ] 舊 revision response 不讓探索退回結果頁；Load／Reset 之後的舊工作不加入新世界。

受控的 pending AI／Load／Reset／append 競爭、first-write-wins、reservation 上限與原 request 仍等待的 timeout 情境，已有工程測試。人工檢查著重畫面與恢復文案；不用修改正式資料製造損壞。

## 375px、鍵盤與減少動態效果

- [ ] DevTools 375px：結果資訊、繼續、系統／存檔、確認框沒有水平溢出或被遮住。
- [ ] Tab／Shift+Tab／Enter：可操作繼續、重新讀取、存檔與確認／取消；焦點標記清楚。
- [ ] 結果頁焦點到繼續；Game Over 可從系統入口操作；返回探索後主內容可讀取。
- [ ] Load 後舊頁的 selection／timer／in-flight UI 清除；不自動發舊 mutation。
- [ ] 啟用 `prefers-reduced-motion: reduce`：回合動畫減少，結算與焦點流程仍可用。
- [ ] 已保存正式紀錄按來源 revision／sequence 排序；`legacy-unplaced` 在獨立「舊版紀錄」區段，沒有被重新分配時間或序號。

## 驗收回報

請先回報第一節「詠唱中勝利與 MP 繼承」是否通過，再按上述項目補充問題。可附情境名稱、storage、操作前／後 revision 與可見結果。Phase 26 等待使用者確認；Phase 27 未開始。
