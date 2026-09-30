# Phase 24：回合順序動畫與 NPC 節奏

> Phase 1–26 已由使用者手動確認；目前階段狀態見 [Implementation Phase Plan](IMPLEMENTATION_PLAN.md)。本文件保留 Phase 24 的實作與驗收紀錄。

## 權威與呈現

CombatState 是正式劇本，Server 是裁判。`src/web/combat-pacing.ts` 只決定何時送出既有請求，以及何時顯示下一位角色。`combat.turnOrder`、`currentTurnIndex`、Round、`lastAction`、骰值、結果與 revision 全由伺服器提供。視覺順序只把權威固定順序從目前角色旋轉顯示；不 splice、保存或修改權威順序。結果先提交權威狀態，動畫再用舊的顯示角色暫存來完成輪轉。

控制器的呈現 phase 為 `idle → pre-action → resolving → showing-result → post-action → transitioning`，失敗則進 `error`。玩家回合回到 `idle`；ended combat 立即清理 timer。phase、timer、舊 chip 位置、敘事停留進度都只在瀏覽器記憶體，**不在 GameState 或 PostgreSQL**，不加 revision。`COMBAT_PACING` 的 action 前 650ms、TEST 敵方推進後 400ms、隊友結果／敘事後 1800ms、輪轉 320ms 是 **provisional presentation timing，NOT gameplay rule**。隊友敘事比沒有敘事的 TEST 敵方推進停留更久；改值只應改集中常數，不應新增資料庫欄位。減少動態效果會取消 chip 移動與卡片 transition，保留可讀停頓與相同權威 action。

## 自動行動與安全邊界

- 玩家：停下，等待玩家指令。成功玩家 action 的 server response 若轉至 NPC，控制器從新權威狀態自然接手；所有玩家 action 共用同一條路徑。
- 隊友：只送 `POST /api/combat/companion/act`，body 僅有 `expectedRevision`。Phase 22 伺服器 policy 選行動、目標與骰值；Phase 23 回應中的 model 或 fallback 敘事會顯示並停留，再處理下一位。
- TEST 敵人：只在 `COMBAT_SANDBOX=1` 的 `TEST-enemy-*` 使用 `POST /api/dev/combat/advance`。沒有敵方攻擊、傷害、技能或敘事。正式敵人沒有此開發捷徑；不支援角色會暫停並顯示安全訊息。
- 每個 `revision:currentActorId` 有一個本頁面的操作鍵；請求送出前即記錄。effect 重跑、rerender 與 StrictMode 清理／重掛不會讓同一鍵再次 POST。任一時刻只容許一個自動 mutation in flight；TEST debug mutation 在正常自動流程中停用，僅錯誤狀態作工程備援，並有同步重複點擊鎖。
- 每次自動請求仍帶目前觀察到的 `expectedRevision`。409 `stale-revision` 先重新讀取權威 GameState，再按新 actor 與 revision 重新評估，**不重送舊命令**。網路錯誤或格式錯誤停止；按「重新讀取並恢復回合」會先 GET，再判斷是否可繼續。伺服器端的 revision 檢查也保護 refresh 與未完成舊請求的跨頁競爭，最多一個 mutation 能提交。
- 舊 timer 在卸載、更新 revision、ended combat 時清理。舊回應不能蓋過瀏覽器較新的 revision。API restart 後只從 PostgreSQL hydrate 的 current actor 推導新節奏，不還原舊動畫。敘事仍只來自當次 action response，不因 refresh 補產。

## 介面與無障礙

行動順序 chip 以權威 base order 與呈現中的 actor 做循環排序；前一位移往尾端，下一位到隊首。使用短的 FLIP 位移動畫，戰場卡片同步以舊銅金色邊線和淡底色標示。目前 chip 有 `aria-current="step"` 及文字「目前行動」。自動回合不搬移鍵盤焦點；敘事仍只有原有的 `aria-live="polite"`。375px 時 chip 在自身容器橫向捲動，不應讓整頁橫向溢出；目前 chip 會在容器內移入可見範圍。`prefers-reduced-motion: reduce` 停用 chip 位移與卡片 transition，保留目前角色文字及邊線。Party 的開關與 Escape 焦點回復仍沿用既有行為；Party 資訊不消耗 Turn。

## 手動測試：Memory 與預期 revision

先停止舊 API／前端。終端機 A 啟動乾淨 Memory（每次重新啟動會回到 revision 0）：

```sh
cd "/Users/bosco0295/ai trpg"
DOMAIN_STORAGE=memory DOMAIN_SANDBOX=1 COMBAT_SANDBOX=1 \
COMBAT_ROLL_FIXTURE_MODE=normal COMBAT_ACTION_ROLL_FIXTURE_MODE=hit \
NARRATION_FIXTURE_MODE=normal npm run dev
```

終端機 B 在開啟瀏覽器前先開戰，避免開戰前頁面停在探索畫面：

```sh
cd "/Users/bosco0295/ai trpg"
curl -s http://127.0.0.1:3001/api/game-state
curl -i http://127.0.0.1:3001/api/dev/combat/start \
  -H 'Content-Type: application/json' -d '{"expectedRevision":0}'
curl -s http://127.0.0.1:3001/api/game-state
```

然後開啟 <http://127.0.0.1:5173>。若本來已開頁，重新整理。預設 `turnOrder` 為敵人 1 → 玩家 → 敵人 2 → 隊友。

### 1. 初始敵人 → 玩家

開戰回應 `revision=1`、Round 1、`currentActorId=TEST-enemy-1`。瀏覽器先標出敵人 1，短暫停頓後自動呼叫 TEST advance；chip 輪轉到玩家並停下。讀取：

```sh
curl -s http://127.0.0.1:3001/api/game-state
```

預期 `revision=2`、`currentActorId=TEST-player`；沒有敵方敘事，不需按「TEST：推進下一回合」。請勿同時用 curl 手動 advance。

### 2. 玩家 action → 完整 NPC 鏈

在玩家 Turn 按「普通攻擊」並選前排敵人 1。伺服器先回 `revision=3`、敵人 2。之後不要點 TEST 控制：敵人 2 自動 advance → 隊友依 A 普通攻擊並顯示敘事 → Round 2 敵人 1 自動 advance → 玩家。用下列指令檢查最終權威狀態：

```sh
curl -s http://127.0.0.1:3001/api/game-state
curl -s http://127.0.0.1:3001/api/combat/party
```

預期 `revision=6`、Round 2、`currentActorId=TEST-player`、最近隊友 `lastAction` 是普通攻擊。應逐位看到高亮、結果停留與 chip 位置移動。Phase 23 隊友敘事顯示後才進入下個敵方回合；敵人 2 和敵人 1 均沒有假敘事。攻擊／防禦／換排／物品／逃跑失敗／物理技能／詠唱開始及繼續／龍息若成功回到 NPC，同樣由權威 current actor 啟動控制器；逃跑成功的 ended combat 不再啟動。

### 3. 隊友戰術 A 與 B

A 是預設工程偏好；上面第 2 項已涵蓋。B 請重啟終端機 A，重做 revision 0 開戰，等待敵人 1 自動前進至玩家 `revision=2`。在玩家回合用 Party 改為「TEST：戰術偏好 B」，或使用：

```sh
curl -i http://127.0.0.1:3001/api/combat/party/tactic \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":2,"companionId":"TEST-companion-1","tacticPreferenceId":"TEST-tactic-b"}'
curl -s http://127.0.0.1:3001/api/game-state
```

偏好修改後 `revision=3`，仍是玩家 Turn。若用 curl 改偏好，請重新整理瀏覽器以讀回版本。再在畫面選普通攻擊；玩家 action 後 `revision=4`，完整自動 NPC 鏈最後 `revision=7`、Round 2 玩家。隊友 `lastAction` 在其行動當刻為 `defend`，敘事描述防禦，不說明未實作減傷；下一個 TEST enemy advance 後 `lastAction` 仍保持隊友防禦。以上 A／B 是 Phase 22 工程 policy，不是正式戰術規則。

### 4. Provider fallback

停止 A，將啟動命令最後的 `NARRATION_FIXTURE_MODE=normal` 改成 `NARRATION_FIXTURE_MODE=unavailable`，其餘相同；重做開戰與玩家普通攻擊。隊友機械行動照常提交，顯示「系統敘述」備援文字後仍正常輪轉到玩家。預期 A 的最終 revision 6。TEST advance 不呼叫敘事模型；Phase 24 控制器本身也不呼叫 LLM。

### 5. Refresh、API 故障與恢復

在玩家 Turn、NPC action 前停頓、隊友結果停留時分別刷新，建議每種情況從乾淨 Memory 另做一次。刷新只 GET 權威狀態；玩家 Turn 停下，NPC Turn 從該 actor 重新安排停頓。正在送出的舊 request 與新頁若競爭同一 revision，伺服器只允許一個提交；檢查沒有跳 actor、雙倍 revision 或無限循環。記下實際 revision，而非用猜測版本送 curl。

故障測試：讓 NPC sequence 開始前／期間在 A 按 Ctrl+C 停止 API。介面應顯示繁體中文錯誤，停在最近確認的權威結果，不假裝敵人已攻擊或回合已推進。在 A 用同一啟動命令重啟。**Memory 重啟會清空資料，請刷新整個瀏覽器頁面**，讓新 App 從 revision 0 重新載入；舊頁面會拒絕把較低 revision 的回應覆蓋較新的已觀察狀態。若要在**同一場**戰鬥按「重新讀取並恢復回合」接續，改用下方 PostgreSQL 流程。若結果回應無效，也應停下而非無限重試。

### 6. 375px、減少動態效果、鍵盤

- 375px：chip 可讀、目前 chip 可見，橫向捲動限制在 carousel 內；整頁無橫向溢出。戰場目前卡片、裁定／敘事及六個指令可讀。
- 在 macOS 或瀏覽器啟用 Reduce Motion，刷新後重做第 1、2 項：chip 移動取消，文字／邊線仍標示目前角色，回合與 revision 不變。
- Tab／Enter：NPC 自動流程不搶焦點；回到玩家 Turn 後可操作指令且焦點輪廓可見。以鍵盤開 Party，Escape 關閉時焦點回 Party；chip 動畫不改焦點。

## 手動測試：獨立 PostgreSQL 與 API 重啟

先依 README Phase 4 設好 `.env` 中一致的本機帳密，啟動 Docker Desktop。使用空的 `ai_trpg_phase24_manual`；若 `createdb` 顯示已存在，確認內容後另選全新的空測試資料庫，**不要刪除重要資料**。終端機 A：

```sh
cd "/Users/bosco0295/ai trpg"
docker compose up -d db
docker compose ps
docker compose exec -T db sh -c 'createdb -U "$POSTGRES_USER" ai_trpg_phase24_manual'
set -a
. ./.env
set +a
export DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/ai_trpg_phase24_manual"
npm run db:migrate:dry-run
npm run db:migrate
PORT=3001 DOMAIN_STORAGE=postgres DOMAIN_SANDBOX=1 COMBAT_SANDBOX=1 \
COMBAT_ROLL_FIXTURE_MODE=normal COMBAT_ACTION_ROLL_FIXTURE_MODE=hit \
NARRATION_FIXTURE_MODE=normal npm run dev:api
```

終端機 B 啟動前端；終端機 C 開戰並讀初始狀態：

```sh
cd "/Users/bosco0295/ai trpg"
npm run dev:web
```

```sh
cd "/Users/bosco0295/ai trpg"
curl -s http://127.0.0.1:3001/api/game-state
curl -i http://127.0.0.1:3001/api/dev/combat/start \
  -H 'Content-Type: application/json' -d '{"expectedRevision":0}'
curl -s http://127.0.0.1:3001/api/game-state
curl -s http://127.0.0.1:3001/api/combat/party
```

現在於 <http://127.0.0.1:5173> 測第 1、2 項。到 Round 2 玩家後在 C 記錄 `revision=6`、Round 2、current actor、原始 `turnOrder`、`lastAction`、Party tactic。**只在 A 按 Ctrl+C 停止 API，不停止 DB 與前端**。A 已 export 的 `DATABASE_URL` 保留於同一 shell，重啟：

```sh
cd "/Users/bosco0295/ai trpg"
PORT=3001 DOMAIN_STORAGE=postgres DOMAIN_SANDBOX=1 COMBAT_SANDBOX=1 \
COMBAT_ROLL_FIXTURE_MODE=normal COMBAT_ACTION_ROLL_FIXTURE_MODE=hit \
NARRATION_FIXTURE_MODE=normal npm run dev:api
```

C 再讀，瀏覽器刷新：

```sh
curl -s http://127.0.0.1:3001/api/game-state
curl -s http://127.0.0.1:3001/api/combat/party
```

權威 revision、Round、current actor、turnOrder、lastAction、tactic 應與停止前相同；玩家 Turn 只等待。若故意在 NPC Turn 停 API 再重啟，刷新後應從保存的 actor 安全接續；不還原舊動畫時間或舊敘事。PostgreSQL 僅有既有權威 snapshot，Phase 24 無 migration。停止資料庫時可用 `docker compose down`，具名 volume 會保留。

## 工程檢查

`tests/combat-pacing.test.ts` 使用假時鐘，不需真實等待數秒，覆蓋前置／後置停頓、完整 NPC 鏈、玩家停止、StrictMode cleanup／remount、重複 observe、單一 in-flight、舊 timer／舊回應、stale hydrate、錯誤停止與明確恢復、production 不支援角色、model／fallback 敘事、視覺順序與高亮。後端既有測試覆蓋 endpoint 的 expectedRevision、validation、敘事只在提交後產生與 PostgreSQL 保存。使用者仍需完成上方瀏覽器、手機、鍵盤與重啟的手動驗收。

本次工程執行：隔離 `ai_trpg_phase24_test` 的 `npm test` 254 項通過，`npm run typecheck`、`npm run build`、`npm run db:migrate:dry-run`、`git diff --check` 通過；dry run 沒有待執行 migration。隔離 `ai_trpg_phase24_restart` 的實際 API 停止／重啟，讀回 revision 6、Round 2、玩家 actor、四人原始 turnOrder、最近隊友行動及偏好 A。這些工程結果不代替使用者對動畫節奏、手機與鍵盤的手動驗收。

正式 enemy AI、production 不支援角色長期流程、最終 timing／速度選項／快轉、動畫細節及 Phase 25 的傷害／瀕死／死亡節奏仍列於 [未解問題](OPEN_QUESTIONS.md)，此階段沒有替它們定案。
