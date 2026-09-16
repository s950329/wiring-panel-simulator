# Wiring Panel Simulator

[English](README.md) | [繁體中文](README.zh-TW.md)

一個以瀏覽器為基礎的 **3D 工業配線模擬器**，讓使用者在沒有實體配線盤的情況下，也能練習配線、理解控制電路，並測試電路動作。

> **本專案持續開發中。** 僅供教育與訓練用途。

**[線上 Demo](https://wiring-panel-simulator.pages.dev)**

## 為什麼做這個專案？

學習工業配線通常需要實體訓練設備，但離開教室後，多數學習者並沒有一套配線盤可以繼續練習。

這個專案因此從一個簡單的問題開始：

> **如果沒有實體配線盤，能不能直接在瀏覽器繼續練習？**

Wiring Panel Simulator 希望在 3D 環境中重現重要的學習體驗。它不只用來畫電路圖，也讓使用者辨識元件、連接端子、查看走線、操作控制元件，並觀察基本電路行為。

## 功能

- **互動式 3D 配線盤** — 支援 360° 旋轉、縮放與多角度檢視。
- **端子式配線** — 依序選取兩個端子即可建立連線。
- **自動走線** — 自動使用可用線槽與 3D 空間，並檢查元件碰撞及電線間距。
- **可開闔操作板** — 展開後可存取背面端子，系統會驗證展開與收合兩種狀態下的走線。
- **電路模擬** — 支援斷路器、NO／NC 按鈕、電磁接觸器、輔助接點、熱過載保護、指示燈、蜂鳴器及基本三相馬達電路。
- **視覺化回饋** — 強調選中的電線、亮起的指示燈、導通路徑與診斷證據。
- **JSON 匯入／匯出** — 保存及還原完整配線專案；匯入驗證失敗時不會取代目前專案。
- **自動驗證** — 電氣邏輯、走線、幾何、元件行為與專案相容性可獨立於 WebGL 畫面測試。
- **單檔離線版本** — 可產生能在現代瀏覽器本機執行的單一 HTML。
- **介面語系** — 支援繁體中文與英文，依瀏覽器偏好自動選擇，也可手動切換並記住選擇；網頁版與離線版皆適用。

## 目前的訓練情境

目前主要以基礎馬達控制訓練為核心，專案內附兩個可直接匯入的範例：

- [`examples/a04-motor-start.project.json`](examples/a04-motor-start.project.json) — 完整的馬達直接啟動電路。
- [`examples/board-024-classroom.project.json`](examples/board-024-classroom.project.json) — 課堂控制回路實習。

A04 範例的動作流程：

```text
QF1 ON
   ↓
按下 START
   ↓
MC1 吸合
   ↓
輔助接點形成自保持回路
   ↓
馬達運轉

按下 STOP 或觸發熱過載
   ↓
MC1 釋放，馬達停止
```

## 快速開始

### 環境需求

- Node.js 22（CI 使用 22.16.0）
- npm
- 支援 WebGL 2 與硬體加速的現代瀏覽器

### 在本機執行

```bash
git clone https://github.com/s950329/wiring-panel-simulator.git
cd wiring-panel-simulator
npm ci
npm run dev
```

Vite 會在終端機顯示本機開發網址。

## 基本操作

1. 在空白區域拖曳，旋轉配線盤。
2. 選取第一個端子。
3. 選取第二個端子。
4. 由系統自動計算電線路徑。
5. 完成控制回路。
6. 收合操作板。
7. 進入測試模式，開啟 QF1 並操作電路。

使用者不需要自行在 3D 空間中手動畫線。

## 開發與測試

```bash
npm test                 # 完整驗證
npm run test:electrical  # 電氣模擬測試
npm run typecheck        # TypeScript 型別檢查
npm run build            # 正式版本
npm run offline          # 單一離線 HTML
```

專案將 **電氣模型、走線邏輯與 3D 顯示** 分開，讓核心行為不需依賴 WebGL 也能自動測試。

應用程式、工具與測試皆以 **strict TypeScript** 維護，包含選擇性執行的 Node Playwright 瀏覽器驗收，不再需要 Python。瀏覽器使用的 JavaScript 由建置產生。型別檢查範圍、工具命令與瀏覽器驗證方式，請參考 [TypeScript 開發指南](docs/typescript-migration.md)。

實作細節請參考：

- [`ARCHITECTURE.md`](ARCHITECTURE.md)
- [`docs/electrical-user-guide.md`](docs/electrical-user-guide.md)
- [`docs/electrical-models.md`](docs/electrical-models.md)
- [`docs/project-format.md`](docs/project-format.md)

## Roadmap

- [x] 互動式 3D 配線盤
- [x] 端子式接線與自動走線
- [x] 操作板展開／收合
- [x] JSON 匯入／匯出
- [x] 基本控制回路與馬達啟動模擬
- [x] 電氣、走線、幾何與專案自動測試
- [ ] 更多工業元件與實習電路
- [ ] 更清楚的電路診斷與錯誤說明
- [ ] 更彈性的自訂配線盤
- [ ] 更完整的初學者教學模式

## 貢獻

**語系翻譯：** 新增語言時，在 `src/i18n/locales/` 加入翻譯檔，再於 `src/i18n/registry.ts` 登錄，下拉選單與瀏覽器語言判斷就會一起支援。範例、翻譯參數與缺漏時的回退規則，以及驗證方式，請參考[語系擴充指南](docs/localization.md#add-a-language)。

歡迎提交 Bug 回報、功能建議與 Pull Request，特別需要以下方向的協助：

- 新增或驗證工業元件
- 修正端子定義或電氣行為
- 改善自動走線
- 新增實習電路
- 改善文件、無障礙設計與學習體驗

無論具備軟體工程、電機或工業自動化經驗，都很適合參與。若要進行較大的修改，請先建立 Issue 討論設計方向。

## 安全聲明

本模擬器僅供 **教育、訓練與模擬用途**。

部分元件尺寸、端子配置與電氣行為是依據教材、照片及實物觀察建立，不保證完全符合特定廠牌或型號。

本模擬器不能取代：

- 設備原廠文件
- 經確認的工程圖面
- 適用的電氣法規與標準
- 合格的電氣專業訓練

**請勿將模擬結果作為真實帶電設備接線的唯一依據。**

## 授權

本專案屬於 **source-available**，並非 OSI 定義下的開源軟體，採用 [PolyForm Noncommercial License 1.0.0](LICENSE)。

依照授權條款，允許非商業用途的使用、研究、修改與散布。商業使用必須另外向專案作者取得授權。
