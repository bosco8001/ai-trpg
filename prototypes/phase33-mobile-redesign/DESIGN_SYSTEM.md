# 遺跡與餘燼 · Mobile Design System 02

狀態：使用者於 2026-10-06 明確回覆「接受這個設計」，已接受本原型的視覺設計方向，作為後續 UI 提案的基準。工程驗證仍待 Grok，尚未接入正式遊戲；不是 Phase 33 第二切片已通過。名稱只代表視覺方向，不是正式遊戲名稱或新增世界設定。先定義本系統，再實作同目錄的畫面。

## 決策順序與共同分工

使用者確認的規則與需求 → 正式 Canon／Phase Spec → 手機可用性 → 視覺一致性 → skill 一般建議。

- game-ui-ux：角色總覽 → 單一任務 Sheet → 影響核對 → 套用 → 返回總覽。只從單一記憶體配置衍生數值；Sheet 用堆疊管理，取消不套用草稿，返回不遺失上一層選擇，關閉返回入口焦點。
- ui-ux-pro-max：主畫面只放目前職業、主屬性、配置摘要、六格技能；長內容留在 Sheet 的內部捲動區。標籤與數字成組、狀態同時有文字與圖形，字體放大時允許重新排欄及內部捲動。
- apple-design：黑體負責功能與標題，標題加粗、數字另用清楚的字型搭配。按下立即變化，選取有邊線與勾選；Sheet 與回饋短而有方向，尊重減少動態、減少透明與高對比偏好。

本地 ui-ux-pro-max 設計系統搜尋回傳網站 Hero／CTA 與綠金配色，重試回傳科幻 HUD／Cyberpunk。兩者都不符合黑暗中世紀手機遊戲，沒有套用或保存搜尋產物；以下是按使用者需求整合的自訂設計，而非宣稱有匹配的資料庫模板。

## 視覺語言

冷黑玄武岩、霧銀、魔導青光、餘燼橙。世界氣氛存在於抽象破碎拱門、細刻線與少量光暈；內容區用乾淨的實色表面。避免金色大框、羊皮紙、表格儀表板、霓虹科技掃描線。裝飾 SVG 不承載資訊，全部 aria-hidden。

## 色彩與材質

| 語意 | Token | 值 |
|---|---|---|
| 深層背景 | --void | #090d12 |
| 畫面背景 | --background | #10161e |
| 基礎表面 | --surface | #18212c |
| 浮起表面 | --elevated | #202d39 |
| Primary／主要操作 | --primary | #ffc39d |
| 主要操作文字 | --on-primary | #1c1412 |
| 次要按鈕／文字 | --button-secondary／--on-button-secondary | #bfd3dd／#15232d |
| 可互動表面 | --control | #3d5362 |
| 低強度互動表面 | --control-muted | #293d4b |
| 互動邊界 | --control-border | #a4bac9 |
| 選取表面 | --control-selected | #1f4850 |
| Secondary／魔導資訊 | --secondary | #a0ddd6 |
| Accent／次要刻線 | --accent | #b6b5d8 |
| 主要文字 | --text | #f2f0ed |
| 次要文字 | --text-secondary | #c2cbd3 |
| 輔助文字 | --muted | #9cabb9 |
| 成功／生效 | --success | #a4d5b3 |
| 警告／未生效 | --warning | #e8c393 |
| 危險／非法輸入 | --danger | #ffaaa8 |
| 停用表面／文字 | --disabled-surface／--disabled-text | #25303b／#a5afb9 |
| 表面分界 | --border | #3d4d5c |
| 可互動邊界 | --border-strong | #6f8396 |
| 焦點 | --focus | #c5f5ef |

文字不直接壓在插畫上；只有有實色遮罩的短標題接近氣氛區。Border 分隔表面，可互動區另有 hover／pressed；選取用青色外框、勾選與文字。陰影只用於浮層和主角色徽記，卡片不各自浮起。青光不能作為唯一有效狀態標記。

## Typography、Spacing 與形狀

- 功能與標題字體：Heiti TC、Microsoft JhengHei、Noto Sans TC、system-ui、sans-serif；由裝置已安裝字型依序選取，不抓取外部字型。
- 短展示標題改為粗黑體，行高 1.25、字距 0.025em；數字使用 Avenir Next、Helvetica Neue、sans-serif 與 tabular-nums。Mac 字型檔清單有 STHeiti／Avenir Next，但尚未以瀏覽器確認實際選取；其他裝置可能使用備用字型。
- 字階：caption 0.8125rem、small 0.875rem、body 1rem、section 1.125rem、title 1.5rem、display 2rem；數字 tabular-nums，正文行高 1.55、短標題 1.25。長標籤允許換行。
- 間距：0.25／0.5／0.75／1／1.25／1.5／2rem，以 4px 節奏建立網格。
- 圓角：內部標籤 0.375rem、按鈕 0.75rem、卡片 1rem、Sheet 頂角 1.5rem；主框在手機全屏，不加手機外殼。
- Touch target ≥2.75rem，重要 CTA 至少 3rem。焦點外框 3px、offset 3px。
- 純裝飾圖示是同套 24×24、1.6px 線寬 SVG；職業徽記有較大版本。圖示跟可見文字一起使用，只有關閉等熟悉操作可用單圖示並有完整 aria-label。

## 元件契約

| 元件 | 規格 |
|---|---|
| Primary button | 較亮餘燼實色、深字，單一任務最多一個主要 CTA |
| Secondary button | 淺霧銀藍底、深色文字，與深色 Sheet 區分 |
| Quiet button | 中亮鋼藍底、銀色文字及清楚邊框，按下仍變化 |
| Danger | 只用於欄位錯誤或真正有損失的動作；未生效技能屬 warning |
| Card | 一個主題、無巨框；可點摘要／裝備／技能使用鋼藍底與較亮邊界，普通資訊卡維持深底 |
| Skill slot | 六格 3×2 起步、文字變大自動減欄；圖示、名稱、序號及生效／未生效／空格；點擊開單格配置 |
| Equipment slot | 一件示範裝備、效果、狀態、入口箭頭；這不是正式裝備欄位定案 |
| Input | 可見 label、1rem 字級、實色背景；錯誤直接顯示於欄位附近，保留舊值直到合法保存 |
| Bottom navigation | 角色／技能庫／裝備，三項；後兩者開啟任務 Sheet，並標出目前任務 |
| Bottom Sheet | 原生 dialog＋scrim，手機靠底、max-height 92dvh；固定 header／footer，中間捲動；Esc／關閉取消草稿，Back 返回上一層 |
| Full-screen Sheet | 技能庫、完整數值、設計展示等長任務，手機接近全屏並保留安全區；桌面變成居中限寬面板 |
| Segmented control | 技能庫全部／生效／未生效篩選，用 button aria-pressed；不是偷偷新增永久技能分類 |
| Loading | 按鈕 aria-busy、禁重複啟動、保留標籤並加靜態進度符號；設計展示可手動模擬，正式配置是同步操作、沒有假等待 |
| Feedback | 套用立即更新 HUD，穩定狀態列宣告結果；失效有原因，取消宣告未保存 |

## 動畫與可用性

- Pressed：80–100ms、輕微下壓／亮度變化，pointer-down 即開始；沒有聲音或強制震動。
- Sheet：220ms 小幅垂直位移與透明度，支援瀏覽器以 discrete display／overlay transition 反向退出；不支援時原生立即關閉。不是可拖曳 Sheet，沒有假把手或滑動關閉提示。
- 選取：120ms 表面與邊框變化；沒有閃爍、粒子循環、背景視差或長過場。
- 不在動畫期間鎖操作、不插入網路請求／假延遲。減少動態時取消位移與動畫；減少透明時使用實色；高對比提升邊框。
- 安全區用 env(safe-area-inset-*)，高度用 svh／dvh；一般尺寸主畫面精簡，短螢幕與放大字體允許內部內容捲動，不裁掉文字來硬塞一屏。
- 目標為 320／375／390／430px 與 200% 文字／zoom、橫向、短螢幕、虛擬鍵盤。這些是交由 Grok 的待測規格，不是已確認通過。

## 範圍

完整呈現角色配裝的新主畫面、Navigation、Sheet、技能庫、裝備挑選、影響預覽與設計展示。這個視覺系統可以供後續遊戲 HUD 使用，但本次沒有實作戰鬥 HUD、敘事引擎、HP／MP 或冒險流程。正式 UI 保持原狀，舊原型仍可比較。
