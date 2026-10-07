# 角色屬性與資源推導：獨立手機原型

> 最新封存狀態（2026-10-07）：本原型與前置補修已隨 `bb93008` 提交／推送；下方未提交／待授權與 Git 指令是當時紀錄，請勿重複執行。原型舊算法未改；正式最新規則另在第四切片由 Grok t47u 回報工程 PASS（限 Chrome），使用者已於 2026-10-07 接受第四切片，詳見 [第四切片](../../docs/development/PHASE_33_CHARACTER_DERIVATION.md)。

> 後續規則修訂（2026-10-07）：使用者已撤回保留缺少量及 B 方案，確認穿上裝備提高最大 HP／MP 時目前值不變；使用者其後回覆「確定」：裝備與職業提高上限不恢復目前值，降低時只截掉超出部分。下方原型、核對步驟、接受與工程結果保留修訂前的歷史狀態，不代表新政策已在原型實作或驗證。第四切片已另交由 Grok t47u 回報工程 PASS（限 Chrome），使用者已於 2026-10-07 接受第四切片；原型舊結果不沿用。最新依 [下一切片提案](../../docs/development/PHASE_33_DERIVATION_IMPLEMENTATION_PROPOSAL.md)。

狀態：使用者於 2026-10-07 明確指示「這次交給你親自驗證」，本輪改由 Codex 執行，親測工程 PASS。原型 9／9、五族 × 四職業 20 組資料核對、補修後 60 組 Chrome 畫面檢查通過；build 成功，全套無 DB 測試 377 pass／0 fail／41 skipped。短螢幕 200% 文字的操作列超出畫面問題已修正，歷史失敗與未測限制保留。使用者已於同日明確回覆「接受這原形」，本獨立原型已接受；未 commit／push、未送達 Grok；本次例外不延伸後續階段，完整來源見 [第三切片文件](../../docs/development/PHASE_33_CHARACTER_DERIVATION_DISCUSSION.md#2026-10-07-使用者授權-codex-親測結果)。

## 開啟

在專案根目錄啟動只讀靜態服務：

```sh
python3 -m http.server 3046 --bind 127.0.0.1 --directory prototypes/phase33-character-derivation
```

開啟 `http://127.0.0.1:3046/`，可與正式 `http://127.0.0.1:3001/` 及舊原型比較。服務不連接遊戲 API、資料庫或 LLM；只綁本機，Ctrl+C 停止。原型只有記憶體樣本，重新整理回到起始樣本，不保存配置。

## 修訂前原型的使用者手動核對（歷史）

1. 起始人類／劍士：力量 15，HP 40／55，MP 48／60。計算明細應顯示人類力量先加 2，再 ×1.25。
2. 調整樣本 → 改為魔術師 → 先看預覽，再更新。智慧 12、MP 56／68，仍缺 12；改回劍士後 MP 48／60。
3. 將 3 點從其他項目移到體質，維持總共 12 點。體質從 10 到 13，HP 40／55 → 49／64；還原後應回到 40／55。
4. 修改後按取消／Esc，總覽維持原值，焦點回到入口。少分／多分／小數不得更新；人類兩點可分到同項或不同項。
5. 精靈／魔術師／高資質、各項分配 2：智慧 `(10+1)×1.25` 向下取整為 13，HP 上限 49、MP 上限 92。獸人／劍士／低資質同樣分配，智慧 7、修正 −2、MP 上限 28。
6. 計算明細 → 載入零 HP 樣本，再更改種族／職業／分配，HP 應維持 0。重設只重設獨立樣本，不代表遊戲恢復／復活。
7. 手機尺寸與放大文字核對按鈕、Sheet 內捲動、六屬性重排；主畫面只有兩個主要入口。真手機／讀屏仍待實測。

下降後 HP 低於 1 或 MP 小於 0 的政策待確認，原型整份變更受阻、保留舊樣本；不是正式規則。魔力資質選項只用於已知樣本核對，不是創角時可選／提前揭曉。

## 檔案與視覺來源

- `model.mjs`：已定名冊資料鏡像、純推導、資源差額與受阻邊界。
- `app.mjs`／`index.html`／`style.css`：單一樣本與草稿、手機總覽、原生 dialog Sheet、來源明細。
- `model.test.mjs`：9 項必要案例，本輪 Codex 已執行並通過。
- `GROK_REVIEW.md`：原先準備的完整外部審查要求，未送達；本輪改由 Codex 親測，不冒稱 Grok PASS。

沿用使用者接受的 Mobile Design System 02：冷黑／魔導青／餘燼橙、較亮按鈕底、Heiti TC 及數字備用字型。game-ui-ux 管理流程／焦點／單一狀態，ui-ux-pro-max 管理資訊／字體放大重排，apple-design 管理間距／字階／按壓與 180ms Sheet 動畫。技能一般建議不覆蓋使用者規則或接受的設計。

## 待授權的限定 Git 交付

先完成第二切片已接受但未提交的 7 檔補修／紀錄，再另立本原型 commit。以下僅是供核對的指令，Codex 尚未執行；需要使用者授權或自行執行。不包含其他既有 dirty 檔案／原型。

```sh
git add -- src/web/main.tsx src/web/ClassCatalogPanel.tsx src/web/class-catalog.css docs/development/PHASE_33_CLASS_CATALOG.md
git add -p -- docs/development/CANONICAL_MANIFEST.md docs/development/OPEN_QUESTIONS.md docs/development/IMPLEMENTATION_PLAN.md
```

**三份共用文件同時含本輪第三切片記錄**。使用 `git add -p --` 時只選取第二切片紀錄，第三切片新增段落留到第二個 commit；不能直接把第三切片紀錄全部提交在上一切片補修中。其餘四檔可完整加入。

```sh
git commit -m "fix: complete accepted phase 33 class catalog repairs"
git add -- prototypes/phase33-character-derivation/index.html prototypes/phase33-character-derivation/style.css prototypes/phase33-character-derivation/app.mjs prototypes/phase33-character-derivation/model.mjs prototypes/phase33-character-derivation/model.test.mjs prototypes/phase33-character-derivation/README.md prototypes/phase33-character-derivation/GROK_REVIEW.md docs/development/PHASE_33_CHARACTER_DERIVATION_DISCUSSION.md docs/gameplay/character_system.md docs/gameplay/classes.md docs/development/PHASE_26_FINAL_SPEC.md docs/development/CANONICAL_MANIFEST.md docs/development/OPEN_QUESTIONS.md docs/development/IMPLEMENTATION_PLAN.md
git commit -m "feat: prototype character attribute and resource derivation"
git push origin codex/phase27-mobile-ui
git rev-parse HEAD
```

上面共 18 個唯一檔案：前一切片 7 檔與本切片 14 檔共享 3 檔。核對實際 stage 範圍後才提交，不使用 `git add .`。本輪已依使用者授權改由 Codex 親測，不自動送 Grok；上述 Git 授權仍未取得。若使用者之後另要求 Grok 審查，先確認固定遠端 SHA 可讀取再送驗。
