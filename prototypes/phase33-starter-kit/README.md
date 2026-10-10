# 出發之前：起始配套與換裝手機原型

2026-10-10（Asia/Hong_Kong）。**目前工作樹另有使用者新要求的配點補修，尚未提交／送驗：人類一組 14 點、其他種族 12 點，初始全零，不預先配點。下述 `80d5f32` PASS 不涵蓋本輪變更。** 八檔補修已依限定授權提交／推送為 `80d5f329473fbf1bdad97cc5f997811e9d116668`，17:17 讀回確認送達指定 Critic。Grok 於 17:34 回報外部 **工程 PASS**：D1／D2／D3 及四項測試缺口通過複驗，另有不阻擋通過的 N1 Low（切換字級／方向失去捲動位置），尚未修正。**Codex 未執行 build、測試或瀏覽器驗證，原型仍待使用者接受**。初版 FAIL 與補修前的待驗證文字保留為當時狀態，詳見末節。

## 開啟

在專案根目錄啟動獨立靜態服務：

```sh
python3 -m http.server 3047 --bind 127.0.0.1 --directory prototypes/phase33-starter-kit
```

開啟 <http://127.0.0.1:3047/>，Ctrl+C 停止。既有正式 UI 與其他原型保留；這份原型不呼叫正式 API、不使用資料庫、LLM 或瀏覽器儲存。重新整理會清除本頁樣本。HTTP 服務只供本機預覽，啟動服務不等於已驗證 UI。

## 本次範圍

- 五族／四初階職業的配點、即時紅字不足提醒、配套核對與建立本頁樣本。
- 手機總覽：目前職業、HP／MP、武器／身體防具、兩個空飾品欄位、六格主動技能。
- 職業、背包、單格技能、數值、預覽與樣本設定採原生 dialog Sheet；同一任務可返回上一層，取消不套用。
- 先種族後職業取整；裝備資格排除所有裝備／技能加成；技能資格只加入生效裝備；技能加成只進最終屬性與資源上限。
- 既有配置失效保留位置，重新符合條件自動生效；新的不合格配置受阻。
- 魔法書按技能格綁定持有的對應書本。書本資格與法術資格分別核對；火焰箭無木杖需求，持有書本不等於永久學會。
- 上限提高不回復目前值；降低只截超出部分，恢復上限不補回，HP0不復活。技能容量同步亦採此政策。

來源為 [已確認的完整範圍](../../docs/development/PHASE_33_STARTER_KIT_PROTOTYPE_PROPOSAL.md) 及 [討論與數值](../../docs/development/PHASE_33_STARTER_KIT_DISCUSSION.md)。其中八件物品／四能力的門檻、加成與護甲只供原型，不寫入正式名冊或 Canon。職業被動僅作說明，沒有戰鬥、傷害、詠唱、冷卻或箭矢消耗。

## 樣本界線

起始樣本只持有所選初始職業的固定配套。一項物理技能保存為已學，魔術師則持有書本來源，不永久學會火焰箭。符合條件才自動配置；不符合的物品留在背包、物理技能留在技能庫，合法分配可以繼續。

配點不生成亂數或揭曉個別資質／資格／龍息。完成後採固定、清楚標示的測試資質：人類普通、精靈高、矮人普通、獸人低、龍裔普通；直接施法資格固定為無；龍裔的火龍息只顯示固定樣本文字。這些不是正式抽取或可選資質。純規則模型保留已學＋獨立資格的直接施法判斷，UI 不授予該資格或永久法術。

原型轉職明確暫開放四職業，方便測試；正式創角仍只開放所選職業。轉職不重發物品／技能、不改初始職業或初始熟練。

「樣本設定 → 載入換裝測試物品與已學技能」會另載入全部八件樣本裝備及三項物理技能；數量去重，不自動配置，不恢復資源。這是獨立的測試庫，不能當成各職業的起始贈送。只有一個已確認書本樣本，不能重複占用同一書本或同一技能；不自行新增其他法術或飾品。

樣本先依無裝備／技能的出生推導初始化一次滿 HP／MP，再按完整合法配套計算新上限，套用不補血／補魔政策。這只是本原型已確認的樣本初始化；正式配套發放與出生資料交接仍須另訂。受傷／耗魔、零資源及上限值按鈕是載入測試情境，不是治療、傷害或復活命令。

## 使用者手動核對路線（預期；Grok 執行結果另列）

1. 重新整理應顯示人類／劍士、剩餘 14 點，六項已分配皆為 0，沒有自由／人類兩組切換。未分完應阻擋下一步。依力量／敏捷／體質／智慧／感知／魅力手動分為 `4／2／2／2／2／2`，剩餘變 0；核對紅字、目前值及差額。合法分配即使配套不足仍可繼續。其他種族初始可分配 12 點；人類單項最多 +8，其他 +6（保持原有自由／種族加成的合計上限）。
2. 核對配套 → 返回配點，分配應保留；再建立樣本。上述手動配點的 HP 應為 55／58，MP 60／60，重斬生效。最大 HP 增加 3 不補滿。
3. 點武器 → 卸下 → 先看預覽 → 取消：武器、技能、屬性與資源應維持。真正套用卸下，重斬保留第 1 格並停用；穿回劍後恢復。
4. 樣本設定 → 載入換裝測試庫 → 確認。從武器改成木杖，重斬仍保留且停用；熟練仍為劍類，不重發其他職業的配套。
5. 樣本設定 → 載入目前上限值樣本，然後卸下鎖甲：HP 58／58 應降到 55／55；再穿回為 55／58。取消預覽不應截低任何資源。
6. 回到配點，選人類／魔術師；合併點數依力量／敏捷／體質／智慧／感知／魅力分為 `4／2／1／3／2／2`。智慧裝備判定應為 13、技能資格 15、最終 16；出生 MP 72，配套後上限 84，目前仍 72。卸下木杖不影響火焰箭。
7. 此魔術師切成劍士：書本需求智慧 12，而裝備判定只有 11，書本與火焰箭停用但仍保留第 1 格；布袍 +2 不能支撐書本門檻。技能資格及最終智慧為 13，普通資質仍加 20，所以 MP 是 72／72，轉回魔術師為 72／84；這條路線沒有截低目前值。另從魔術師載入「目前上限值」樣本（84／84），再轉劍士應為 72／72，轉回魔術師應為 72／84，才是截低且不補回的案例。火焰箭停用／恢復時都保留原格。
8. 載入零 HP／MP 樣本，再換裝／轉職；HP 與 MP 應維持 0。重新整理才回到原型初始畫面，不影響正式角色。
9. 用手機、鍵盤與放大文字核對：主操作能到達。一般大小保留主內容／Sheet 清單內部捲動；大字或低矮畫面空間不足時，標題、內容及操作改在同一容器捲動，不縮字或裁字。Sheet 捲到底後 Esc／遮罩／完成關閉，再打開數值或設定都應回頂；返回／取消焦點回到入口，快速關閉再開啟不被舊 close 事件清空。真手機與讀屏須另回報實際測試環境。

上述數字是使用者核對時的預期。Grok 的外部 UI 結果見末節；Codex 沒有親測，使用者尚未回報本原型接受。

## 檔案與待執行案例

| 檔案 | 用途 |
|---|---|
| `model.mjs` | 名冊鏡像、樣本內容、資格／來源、起始配套、容量與不可變樣本操作 |
| `app.mjs` | 畫面／Sheet 堆疊、返回焦點、草稿預覽與單一已套用樣本 |
| `index.html`／`style.css` | 獨立入口、接受的 Design System 02、響應式／安全區與 reduced-motion |
| `model.test.mjs` | 資格、配套、20 組名冊組合、停用／恢復、容量及保存邊界；`80d5f32` 的 18 項由 Grok 外部回報通過；本輪更新完成樣本來源並新增四項配點案例，共 22 項尚未執行 |
| `catalog.test.ts` | 對照正式五族 v2／四職業 v1 原檔；`80d5f32` 的 2 項由 Grok 外部回報通過 |
| `GROK_REVIEW.md` | 當時的補修複驗模板；實際送驗 TARGET 與送達紀錄見本文件末節，模板不作送達證明 |
| `favicon.svg` | 本機靜態圖示；避免瀏覽器請求缺少的 favicon.ico |

三個 UI skill 共同沿用 [Design System 02](../phase33-mobile-redesign/DESIGN_SYSTEM.md)；使用者配點紅字要求優先於舊系統的一般黃色警告建議。功能層有即時按壓與狀態文字；沒有新增手勢拖曳、外部字型、音效或震動。補修後 Chrome 的外部對比、焦點及桌面模擬排版結果見末節；真手機仍未測。

## 初版 Grok 外部工程回報

來源：指定 **AI TRPG Architecture Critic**，2026-10-10 16:37–16:38（本機介面時間）；Codex 讀回回報，沒有親自重跑。BASE `7dddce1a02c7171986666b6ea0b06c656a2a2873`；TARGET `342edfbe2341408c47804663b1e7be3ce65ad112`。工程 **FAIL**，不重新判定已接受的第五切片，也不代表使用者原型驗收。

- **D2 Medium**：CSSOM 將 root 字級設為 200% 時，固定頂／底欄擠壓主內容。390×844 配點區只剩 121px，角色總覽只剩 80px；320×568、844×390 也無法完整顯示任何技能格。真 zoom 的直向正常；極低高度橫向 zoom 歸 Info。這是字級模擬，不能當成系統 Dynamic Type 實測。
- **D3 Low**：Sheet 未顯示時重設 scrollTop 無效；數值捲到底後重開仍在 441px（320 寬時 761px），換到設定仍可停在 293px。Grok 以隔離請求注入試過先 showModal 再 renderSheet，兩例回到 0；不是正式補修的測試結果。
- **D1 Low**：本文件及審查要求把轉職 MP 寫成 52／52、52／84，漏算普通資質 +20；正確為 72／72、72／84。實作符合正式公式。

Grok 回報 Node 24.21.0、Chrome 154、Playwright 1.59.1，桌面 headless 模擬。npm ci／build、13 項 model、2 項 catalog、38 項指定前置案例及 diff --check 全部 exit 0；另跑全套 451 項，403 pass、48 個需 DB 的 skip、0 fail。skip 不當 PASS。正式推導與五族／四職業獨立對照 65,226 個斷言零失敗，規則 1–8 及 12 類非法配點邊界符合；README 九步除 D1 預期值外符合。

初版 Chrome 鍵盤、來源失效／恢復、取消、零資源及快速關開正常；32 組文字對比最低 4.8、7 組未達 AAA，焦點框至少 6.8；按鈕至少 44×44 CSS px。指定尺寸沒有橫向溢出，焦點 AA 未完全遮住通過；D2 情境焦點完整可見 AAA 不過。靜態網路未呼叫 API／DB／LLM，也未用 localStorage／sessionStorage。

Info：favicon 404、四項測試缺口（其他技能加成支撐資格／停用裝備仍給屬性／停用裝備仍給護甲／高資質自動有直接施法資格）、錯誤摘要行內小連結、紅字「目前值」未區分裝備判定與技能資格。八件裝備／四能力只供樣本，未評平衡。Safari 按鈕點擊焦點差異是 Grok 推斷；真手機、讀屏、Safari／WebKit、系統字級及真瀏海 safe-area 未測，受阻無。

外部證據位於 Grok 環境 `/workspace/p33o-evidence/`（SUMMARY、logs、json、scripts、73 張截圖）；此路徑不是本機下載或已核對的證據副本。Grok 回報其新增服務及工作資料夾已清理，未開 PG、未碰 5432／舊證據、未 commit／push。

## 八檔補修準備紀錄（當時狀態；其後外部工程 PASS）

- `app.mjs`／`style.css`：依實際字體及剩餘空間切換容器捲動；大字的欄位改直排，不降低文字大小。Sheet 先顯示才更新內容／回頂；返回焦點及 aria-expanded 用實際觸發按鈕，不依賴瀏覽器點擊焦點。
- `model.test.mjs`：新增停用防具屬性／護甲、高與極高資質資格、其他技能跨屬性加成及 MP 預期回歸案例。跨屬性案例只在測試的記憶體模組給火焰箭敏捷 +2，讓資格 13、最終 15 仍不能裝需求 15 的迅刺；不改正式／原型內容或 UI。本檔現在準備 18 項案例，補修輪尚未執行。
- `index.html`／`favicon.svg`：本機 SVG 圖示；沒有新增外部資源或放寬 CSP。
- 本 README／`GROK_REVIEW.md`／`../../docs/development/PHASE_33_STARTER_KIT_PROTOTYPE_PROPOSAL.md`：保存外部回報、改正 MP 路線與複驗範圍。原型接受與工程結果維持分開。

以上為待驗證的實作，不宣告 D1–D3 或 Info 已通過。正式程式、規則名冊與既有出生紀錄未改。

使用者已明確回覆「授權限定 8 檔 commit／push 並複驗」。以下僅限本輪八檔，不包含其他既有修改；新增 favicon.svg 已納入這次授權。指令備存如下，不作已提交／送達證明：

```sh
git add -- prototypes/phase33-starter-kit/app.mjs prototypes/phase33-starter-kit/style.css prototypes/phase33-starter-kit/model.test.mjs prototypes/phase33-starter-kit/index.html prototypes/phase33-starter-kit/favicon.svg prototypes/phase33-starter-kit/README.md prototypes/phase33-starter-kit/GROK_REVIEW.md docs/development/PHASE_33_STARTER_KIT_PROTOTYPE_PROPOSAL.md
git diff --cached --name-only
git commit -m "fix: reflow starter prototype and restore sheet scroll"
git push origin codex/phase27-mobile-ui
git rev-parse HEAD
```

取得補修的完整遠端 SHA 後，以 GROK_REVIEW 模板填入 TARGET，主動送交指定 Critic 並讀回確認。未提交時不得把初版 TARGET 當成補修版本送驗。其他 dirty 檔案保留，不能整包 add 或 commit。

## 2026-10-10 補修複驗：外部工程 PASS，原型待使用者接受

來源：指定 **AI TRPG Architecture Critic**，本機介面 17:34:45–17:34:58 回覆；Codex 經 Grok Bot Control 讀回，未自行重跑。BASE `342edfbe2341408c47804663b1e7be3ce65ad112`，TARGET `80d5f329473fbf1bdad97cc5f997811e9d116668`。Grok 確認 BASE 為祖先、TARGET 為當次分支頂、只有指定八檔改動，規則模型／正式程式／名冊未改。工程 **PASS**，無 Medium／High；保留 N1 Low，不代表使用者原型接受、正式接入或 Phase 33 結案。

- **命令與規則（Grok 本輪實做）**：Node 24.21.0、Chrome 154、Playwright 1.59.1，headless 桌面模擬。npm ci／build／diff --check exit 0；model 18/18、catalog 2/2、四個指定測試檔 38/38 通過。另跑全套 451 項：403 pass、48 個需 DB 的 skip、0 fail，skip 不當 PASS。規則 1–8 再跑 65,226 個斷言，零失敗。
- **D1 PASS**：兩條 MP 路線分別 72/84→72/72→72/84、84/84→72/72→72/84。錯誤預期與資質／補滿邏輯變異均被新增測試攔下。
- **D2 主畫面 PASS**：CSSOM root 200% 字、真 profile zoom 200%、模擬 zoom，在 320×568／390×844／844×390 覆蓋三個主畫面及 14 個 Sheet 層級。放大主畫面能完整捲到六格，沒有逐字細柱、橫向溢出、裁字、雙重捲動或 ResizeObserver 錯誤。一般尺寸仍保留緊湊版面。
- **D3 PASS**：以真正補修版本驗證，沒有沿用初版注入結果。正常與 200%、390／320 寬下，Esc／完成／遮罩／X 關閉再開、數值後開設定、快速關開及巢狀返回均由頂開始；dialog／body scrollTop 為 0，返回焦點正確。
- **四項測試缺口 PASS**：跨技能加成撐資格、停用裝備仍給屬性／護甲、高／極高資質自動有直接施法資格，逐條隔離反轉規則都被對應測試攔下。跨技能只在測試記憶體給火焰箭敏捷 +2，未改產品模型。全部變異共 28 個，攔下 25 個；其餘三個為等價變異或被其他檢查擋住，隔離副本已還原。
- **UI 回歸與已改善 Info**：README 流程 26 項、選擇／導航 19 項通過；紅字區分裝備判定與技能資格、摘要連結 236–338×44px、favicon 200 且 CSP 無錯／無 404、根層與巢狀返回焦點及 aria-expanded 正確。文字對比最低 4.8，全部 AA、七組未到 AAA；按鈕至少 44×44；reduced-motion／transparency 生效。靜態請求只含入口、CSS、app／model 及 favicon，無 API／DB／LLM 或 localStorage／sessionStorage。
- **N1 Low（未修正）**：`app.mjs` L40–47 切換 reflow 搭配 `style.css` L124–128，390×844 聚焦第 4 技能格再把文字 100%→200% 或直向→橫向時，新捲動容器歸零，焦點跌出畫面；開啟的 Sheet 也會從 441 歸零。Tab 可補救，Grok 判為不阻擋工程 PASS。使用者仍可要求同切片補修；不把此問題寫成已解決。
- **保留 Info／限制**：200% 時部分技能候選略高於 Sheet body；320×568 zoom 有候選高於整個畫面，不能一次完整顯示。焦點 AA 通過，這些候選的完整可見 AAA 未通過。樣本平衡未評。真手機、讀屏、Safari／WebKit、系統字級、真瀏海 safe-area、同一 session 切換真 zoom 未測；Safari 焦點改善僅為代碼推斷。引用初版只作 BASE 背景，受阻無。

外部證據 `/workspace/p33p-evidence/`（SUMMARY 及 238 張截圖）在 Grok 環境，尚未下載／逐檔核對。Grok 回報其新增 3047／3048 服務已停、未開 PG、工作資料夾已刪，未碰 5432／舊證據、未改 repo 或 commit／push。本輪 Codex 只整理文字紀錄，不重判第五切片，也不開始正式接入。


## 2026-10-10 使用者配點補修（本輪待驗證）

使用者要求只有兩項改動：人類不分開操作自由 12 點與額外 2 點，直接分配 14 點；開始時不自動平均分配，所有已分配點數為 0。重新整理及清除本頁樣本都回到空白起點。初始種族／職業仍是人類／劍士，不提前揭曉資質。

畫面只有一組額度、六組加減、已分／剩餘文字與原有紅字提醒。人類合計單項最多 +8，其他種族 +6，保留原 Canon 的自由單項 +6 及人類可另加 +2 的可達範圍。模型內部仍保留 allocation／human 來源，按每次合計分配重新映射：單項超過 +6 的部分先列種族點，餘下若自由總額超過 12 再依屬性順序列種族點；合計值不變。未完成可預覽，完整額度分完才可建立。

同族重選、職業切換及返回配點保留分配；換族沿用原流程，保留自由分配並移除舊種族點，切回人類新增 2 點待玩家自己分配，不預先加到力量。畫面回饋提示重新核對。原型計算、配套、容量與正式保存邊界維持；`80d5f32` 的 N1 Low 未修正，本輪不宣稱解決。

本輪模型測試用明確完成樣本保留原 18 項規則案例，再加四項：全零初始、14 點加減／不可超額、原單項上限（含 7+7）、換族與未分配點。尚未執行 build、測試或 UI 驗證，未提交／未送驗；`80d5f32` 外部 PASS 不涵蓋本輪。正式創角 API／UI 未改，不改已接受的第五切片。

### 本輪限定七檔提交範圍（已取得本次授權）

`model.mjs`、`app.mjs`、`model.test.mjs`、`README.md`、`GROK_REVIEW.md`（都在本原型目錄），以及 `docs/development/PHASE_33_STARTER_KIT_DISCUSSION.md`／`PHASE_33_STARTER_KIT_PROTOTYPE_PROPOSAL.md`。包含前次尚未提交的 README／PROPOSAL 外部工程紀錄。新增模型與討論檔不在已完成的八檔提交範圍，不納入其他 dirty 檔案。

```sh
git add -- prototypes/phase33-starter-kit/model.mjs prototypes/phase33-starter-kit/app.mjs prototypes/phase33-starter-kit/model.test.mjs prototypes/phase33-starter-kit/README.md prototypes/phase33-starter-kit/GROK_REVIEW.md docs/development/PHASE_33_STARTER_KIT_DISCUSSION.md docs/development/PHASE_33_STARTER_KIT_PROTOTYPE_PROPOSAL.md
git diff --cached --name-only
git commit -m "fix: start allocation empty with one human point budget"
git push origin codex/phase27-mobile-ui
git rev-parse HEAD
```

取得可讀取遠端 TARGET 後，依 GROK_REVIEW 主動送指定 Critic 並確認讀回；本節不是 Git 或送達證明。

使用者其後明確回覆「授權限定 7 檔 commit／push 並複驗」。本次只依上述七檔提交／推送；完整 SHA 與送達依實際讀回，不把授權當成工程通過。
