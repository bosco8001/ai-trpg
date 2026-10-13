# Phase 33 第七切片：t78u 未完成項目的 Codex 補驗

本輪由使用者明確指定 Codex 完成未完成驗證，適用 AGENTS 第 4 節的另行授權例外。只補驗及整理證據，沒有修復產品程式、commit／push，亦沒有宣告使用者驗收。

**整體仍 FAIL。** 舊短屏閱讀高度問題未解；補驗另找到兩個放大後的職業列裁切退化。不能用「至少部分可見」代替完整可見、可讀高度、操作尺寸及完整焦點框。

## 版本、環境與證據來源

- Repository：`bosco8001/ai-trpg`，分支 `codex/phase27-mobile-ui`。
- TARGET：`b79fc7a6ab6b8043468fc05cfbed91557a440b3f`。
- BASE：`a061fe25f534f239daf514843df2f127c510ce12`。
- Git HEAD 與 TARGET 相同；其他既有未提交修改保留。測試用 `git archive` 的精確版本，未使用主工作目錄的未提交產品修改。
- Codex 本機：macOS 26.6.2／arm64、Node 24.21.0、npm 11.19.0、PostgreSQL 15.19、Playwright Core 1.62.1、Chrome 155.0.8059.40、Safari 26.6.2。
- 新隔離 PG：`127.0.0.1:55438`；新 production 服務 TARGET 3141、BASE 3142。沒有操作 5432、Grok Linux 的 55426／3131–3133 或舊證據。
- 本機沿用既有 `node_modules`，沒有另跑 npm ci。兩版本機 build、migrate exit 0；只是建立補驗環境，不冒充重跑 Grok 全套測試。沙箱最初阻止 PG 共享記憶體與本機連線；隔離操作取得工具允許後成功。
- 外部原始交接經 Grok Bot Control 取得。下載包 1,874,464 bytes，SHA-256 `8d39248e8f64e7643b88d2c11a869ab3ca09e6d6f48cce46ab13899508672458`；先核對雜湊及安全路徑才解壓。原包不含密碼、profile、cookie 或 storageState。
- 原件：`/private/tmp/p33-t78-codex/original/p33t78-evidence/`。本輪證據：`/private/tmp/p33-t78-codex/evidence/`，可重跑副本：同層 `drivers/`。`adaptation-manifest.json` 記錄原始與副本雜湊、路徑／連接埠／Chrome 執行檔替換。
- 外部 Linux／PG 17 報告保留為外部結果。本機結果不能當成 Linux 原環境的精確重現。

## 本輪實做

### 1. rail-aware 882 矩陣：兩版均完整跑到，並非全綠

使用交接 `l2-matrix-fresh.mjs`／`l2lib.mjs`，只適配本機路徑、連接埠及瀏覽器執行檔。六尺寸 × 三模式 × 七停點 × 七步，每版 882 格；分 18 小批保存 JSON／命令／exit，兩版 36 批全部 exit 0。driver exit 0 不等於產品通過。

原來單一數值的縮放偏好在 Chrome 155 不生效，初次 smoke 844 仍是 844，**不計 realzoom 驗證**。用原生 Chrome 設定的實際偏好結構後，844×390 變為 422×195 CSS px、DPR 4；對照 normal 的 DPR 2。有效矩陣才用此設定。realzoom 的 font-alt 步另加 root 200%，屬雙重放大，沒有混寫成單純 200% 字級。

| 穩定量測項目 | TARGET | BASE |
|---|---:|---:|
| 至少部分可見 AA | 882／882 | 882／882 |
| 完整可見 AAA | 878／882 | 878／882 |
| 超大控制項 AAA false | 1 | 2 |
| 非超大控制項 AAA false | 3 | 2 |
| 126 個停點準備成功 | 126／126 | 126／126 |
| 20 幀樣本發生捲動振盪 | 0 | 0 |
| 焦點離開 dialog 的 END 樣本 | 0 | 0 |
| 返回列／Escape 入口／重開歸零 | 各18／18 | 各18／18 |

限制與旗標另列：

- 第二個 rAF 的早期量測仍有 TARGET 31、BASE 29 格 AA false，其後穩定量測恢復。原始時序保留於 `matrix-early-*.json`；未歸因，不宣稱轉換全程無瞬間消失。
- `heading` 是程式可焦點但非 Tab 停點，driver 的 Tab→ShiftTab 要求回到 H2 在每版 18 組都不成立；其餘六個操作停點均回到原控制項。這個 BAD 旗標不當成產品失焦，也不刪掉原輸出。
- TARGET 14、BASE 17 個 context 記到既有 `ResizeObserver loop completed with undelivered notifications.`；`pageerror` 0。不把 RO 通知改寫成「完全沒有錯誤」。
- AAA 檢查控制項外框及 hit-test，不足以單獨證明所有文字、44px 目標或完整 6px 焦點框都通過。

### 2. 原版 t74u H-1／H-2 與量法補充

- 原版 `h1t74.mjs`：17 類 × N3 × 兩版 × 有頭／無頭，共 204 次，起始準備有效 204；pulledBack 0、jumped 0、產品 SIV 0。原版保留；不是以重建版冒充。
- 原版 `h2.mjs`：15 類 × N3 × 兩版 × 有頭／無頭，共 180 次，全部實際跑過。它只對 frame／body 量測，將留在 rail 的控制項誤記為 lost；`:popover-open` 也無法辨識目前 class dock。原數字不能當作產品 H-2 FAIL／PASS。
- 原版 M 的 `row` 沒有停點映射，亦沒有真正延遲 reload，12 次起始焦點其實是「跳至故事紀錄」；此案例**作廢**，沒有算入有效 H-2 分母。
- 另做明列差異的 `t72lib-rail.mjs`／`h2-rail.mjs`：只補量測 viewport 與 dock 識別，保留原有效操作序列。14 類 × N3 × 兩版 × 有頭／無頭，共 168 次；validStart 168、lost 0、notFull 0。首批選擇條件漏 C2，已以獨立四組 N3 補齊，沒有 skip。

### 3. M-1 reload 568×320→320×568

原 `m1-repro.mjs` 在魔術師詳細頁尋找僅存在於列表的「重新讀取名冊」，nopark 是準備錯頁。

- 正確列表頁、鍵盤停泊 reload 後轉向：兩版各 N5，10／10 保持原焦點及完整可見。
- 真正按 reload、暫停兩個 production catalog GET、busy 期間轉向、放行原回應後再核對：兩版各 N3，6／6 通過；busy 與完成後均保持 reload 焦點及完整可見。沒有改回應內容或發出遊戲寫入。
- 新 driver 初版誤比對短文字「重新讀取」，其原始量測實際是「重新讀取名冊」；10 個 false 旗標作廢，另存 `m1-reload-adjudicated.json`，只按完整名稱重算，未修改 AA／AAA 或重跑取綠。
- 這是有效替代刺激；未將無效的原版 H-2 M 改標為通過。

### 4. smooth 中間幀

兩版各測 plain、60ms 中途微 resize、60ms 中途發送 wheel，各 N3；有頭及無頭合計 36 次。使用 `no-preference`，在 native smooth 指令前就開始每個 rAF 取樣，沒有新增產品動畫或等待特例。

全部取得真正中間位置，約17–18幀；起點1506、目標1106，呼叫同步返回時仍在1506，之後漸進到目標。各例末態 AA true、SIV 0。逐幀 JSON 保存於 `remaining-headless-original.json`／`remaining-headed.json`。這不等於實體 trackpad／Ctrl-wheel 或所有雙 scroller 操作均已覆蓋。

### 5. 真頁面自動 release→repin

同一 SUMMARY 焦點：先停泊、外部寫入 DETAILS `padding-top:12px !important`、微 resize 讓 helper 觀察接管、縮到高度60觸發自動 release；回復390後用原生 SIV 讓來源重新可見，再捲到頁底觸發自動 repin。全程未改焦點，沒有直接呼叫 helper。

- TARGET N3：release 後與 repin 後均保留12px／important，3／3 PASS。
- BASE N3：接管後回到49px、release 丟失、repin 再寫49px，3／3 紅；區分能力成立。
- 只縮到200不會 release；只回復高度而不恢復可見來源也不會 repin。首次無完整鏈的6例保持 BLOCKED，不能當通過。完整鏈證據是 `repin-recovered-headless.json`。
- 高度60是刻意的極短 viewport 刺激，不代表此尺寸的閱讀／可操作性已通過。

### 6. Safari 與原生視窗能力

本機原生 Safari 的 TARGET 基本流程已親測：開系統面板→起始配套→魔術師→展開木杖→返回四職業，焦點回魔術師列→Escape，焦點回入口。另建的 Safari 視窗已關閉。AX／截圖保留；沒有將四次 Tab 或 Option-Tab 的不完整焦點證據標 PASS。

原生有頭 Chrome、`viewport:null`，要求320×568後實際 outerWidth／innerWidth均500，CDP 視窗 bounds 也500。**真320視窗受阻**，320模擬 viewport 不替代它。

原生 Chrome 尋找列嘗試未取得可確認的正確原生視窗／尋找列狀態；未將按鍵嘗試當成完成。補驗工具另建的 Chrome 分頁已關閉，沒有沿用無關頁面的狀態作證據。

## 新發現及仍未解

**Medium V1：rail 上限在雙重放大後令職業列裁切，屬 TARGET 相對 BASE 的退化。**

重現：原生200%縮放；568×320或844×390；魔術師詳細頁展開→返回列表→鍵盤停泊魔術師列→沿矩陣旋轉、回復、跨高度界線、回復→root字級200%。兩尺寸各N3、兩版對照，另以CDP各補留一份畫面。

| case | TARGET control／viewport | BASE control／viewport | 結果 |
|---|---|---|---|
| 568×320→CSS284×160 | top107、bottom165、高58；viewport底160 | top88、bottom151、高63；底160 | TARGET AAA false，BASE true，各3次 |
| 844×390→CSS422×195 | top142、bottom200、高58；viewport底195 | top105.5、bottom186、高80.5；底195 | TARGET AAA false，BASE true，各3次 |

TARGET computed max-height44px，但 padding28px兩側加border令實際高58px；rail可用高度不足，外框超出viewport5px，完整焦點框亦不能容納。CSS與helper的共同作用是待修復的推論，未實作補丁。影響已確認的完整可見與可讀性要求；不是AA全失焦。

另外：realzoom390×844加200%字級的 H2 寬僅1.5px、高194px，兩版各N3均AAA false，屬既有呈現限制。此窄矩形也小於driver的2px邊緣取樣偏移，AAA旗標含量法限制；不當成與職業列底部越界相同的幾何失敗，文字可讀性仍沒有通過證據。超大控制項與邊界幀另外保留，不用整體AA數字掩蓋。

**引用 t78u 外部結果、未在本輪重測：**短屏可讀高度不足158仍是Medium；1px容差來源的Low、evidence callback覆蓋timeout的Low、summary按住resize越出rail的Info都未修。外部幾何720→721／max252→253是實際變化，不是已證實捨入誤差。

## 引用、未測、受阻及作廢

- **引用有效同版外部結果**：PG579／579與BASE568／568、相關檔與mutation、G4、F1／F2／L-8、safe／對比、HTTP／main／fault／snapshot／舊UI／cleanup。詳見原包SUMMARY；Codex未重跑，沒有轉成親測。
- **未測**：真手機、讀屏器、系統字級、真safe area、Android網址列、實體Ctrl-wheel、Safari完整矩陣／旋轉／縮放。DOM／CSS／桌面瀏覽器模擬不替代這些證據。
- **受阻**：真pinch無可用實體手勢輸入；真320視窗被Chrome最小寬限制；原生Chrome尋找列沒有取得有效狀態。原G4 probe390×620 BLOCKED仍保留。
- **作廢／不作產品判定**：外部frame-only882、原版H-2的frame-only失焦旗標及M12次、heading的Tab回H2旗標、本輪reload名稱錯誤旗標、初次無效realzoom、初次不完整repin鏈。部分原生縮放的Playwright截圖為空白，已改用CDP留證，不用空白截圖證明產品狀態。

## 交接及停止界線

可在本機執行的交接driver與定向補驗已完成；必要實體／原生介面證據缺口逐項保留。這不是整個切片驗證通過，也不是使用者驗收。

工程仍FAIL。下一步應切回ultra，先分析V1與既有短屏空間限制，使用這份摘要及原始JSON，不重新跑已有有效綠燈。本輪不直接加補丁、不更改Canon／API／保存契約，不開始下一主要切片。

本輪新開的兩個服務SIGINT exit0，隔離PG55438已正常停止；資料目錄及證據保留。沒有清理外部Linux環境。新證據封存見同目錄REPLAY說明，供後續ultra只補讀受影響內容。
