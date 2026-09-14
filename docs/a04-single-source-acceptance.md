# WIRE-R14：A04 單一電源修正與驗收

## 實作範圍

依 v0.2 規格，正常專案只接受零／一組三相來源。零來源是尚未接電的編線草稿；完整 A04 使用一組 `teaching-ac220-three-phase-source` v1。沒有獨立 CONTROL、available 參數或個別主／控制電源開關。

來源僅在測試模式執行求解。QF1 改變自己的三組接點，不改變來源 enabled；進線端仍接至來源，刻意接在進線側的旁路也不會被全域 OFF 捷徑掩蓋。「開始測試／返回配線」是運算及編線模式，不是第二個電源。

A04：`examples/a04-motor-start.project.json`。28 條原生盤內線、6 條外接線、3 條固定組裝導體，預設 QF1 OFF、操作板閉合、模擬未執行。兩顆 FUSE 的 IN 分別從 QF1:T1／T3 取電，OUT 保留控制支路；四端都在真實盤內連線中。檔案只保存 configuration 與 connections，不保存人工 points。

整合保留 main 規格 `38b1c13834bc606214740548ce64dbae04233876` 與已完成的 project-format 分支 `98ba3d274f377a204cce8e12ad078e0f8a56ce37`，不覆寫原分支。實作 tree：`4cfb3e031cf3ca1107b3afbfa9ca8dfc6ff8f02e`；實作 commit：`e1d0c89558ad3dca41ef5a336d0ca947f04c38e8`。

## 已執行驗證

原分支基準為 144 項測試。新版在本機及 GitHub Actions 都執行 `npm test`：**174 通過、0 失敗、0 跳過**，含 TypeScript strict。新功能有先失敗再成功的回歸，包含稀疏索引等無效相對宣告；既有幾何基準未修改。

實際 Three.js 與電性引擎驗證涵蓋：完整 28 條線重建、端子 anchor、碰撞／間距／自交、兩輪操作板開闔、專案往返、實例改名、啟動、自保持、停止、過載與 RESET、兩顆保險絲及四端斷線、QF1 斷開／恢復、進線側帶電、故意旁路、S 相缺失與持續按住 ON 時的恢復行為。

相對省略、無效宣告、profile 不同、同相、短路、混源、串聯負載、懸空分支及線圈收斂仍有原有保護。舊 CONTROL 有接線時拒絕載入並保留原專案；只有未使用的自動 CONTROL 可移除且須回報。Generic MAIN 不自動升級相間能力。

`npm run build` 通過，包含 strict、獨立 HTML 內嵌程式語法及逐位元組一致性、Vite production build。既有大型 chunk 警示保留。依賴未升級；npm ci 回報的既有 audit 警示（1 moderate、1 high）未在本次修正，不宣稱完成安全稽核。

## 真實瀏覽器驗證

[驗證執行紀錄](https://github.com/s950329/wiring-panel-simulator/actions/runs/34857197663) 在 SHA-256 及完整 Git tree 核對後，使用 Playwright 1.55.0／Chromium 140 執行實際 UI 操作。`qa-results/browser-results.json` 記錄 **25 項通過、pageErrors 為空**，不是只跑 Node 模擬：

- R14 啟動、預設盤面、A04 原生重建、只有 MAIN／M1、沒有獨立供電操作、QF1 預設 OFF。
- 啟動／放開自保持／三相馬達、OFF 停止、TH 過載紅燈與蜂鳴器、RESET 不自啟。
- QF1 切斷控制及警報供電，恢復後 ON 已放開則不自啟；原始來源仍只有一個。
- 兩輪操作板開闔、僅端點匯出、不同配置替換、任意實例檢視、取消保留、同來源兩驅動器、重設。
- HTTP 提供的單檔 HTML，以及本地 `file://` 單檔，均實際啟動及匯入專案成功。

**截圖／目視驗收仍有缺口：** `a04-loaded.png` 截圖逾時 10 秒，已在 captureWarnings 明列。這不否定成功的 UI／電路斷言，但不能宣稱已完成 FUSE 四端的螢幕目視驗收。本機 Chromium 導航另受管理政策阻擋；未更改該政策。

首次驗證 run 的測試、建置與瀏覽器步驟均成功，但最後由 runner 推送 workflow 檔案時，GITHUB_TOKEN 缺少 workflows 權限而失敗。因此不把該 run 的整體狀態稱為成功。已透過正常授權的 GitHub repository connector 建立相同已驗證 tree 的實作 commit；後續 branch／main 的唯讀 CI 再驗證並封存原始碼，無須 runner 寫入分支。

## 交付與既有 Site

R14 單檔 HTML 與新 A04 專案配套交付；新 project JSON **不能拿到尚為 R12 的舊站匯入**。R14 HTML 已由上述真實瀏覽器測試確認可從本地檔案開啟。

現有 `leo-wiring-panel.leochien0808.chatgpt.site` **尚未發布此次更新**：目前沒有可更新該既有 Site 的授權發布工具。保留 `.openai/hosting.json` 的原 project_id，不另建替代網站。網站部署包只是 build artifact，不是已發布證據。

## 模型邊界

仍為教學導通／供電模型，不計算真實電流、相量、馬達轉速、熔斷時間或熱過載曲線，也不是實機安全認證。MC 綠燈不保證馬達三相完整；TH20 量程未因題圖標示 3.3A 而改寫；保護蓋開闔不是保險絲熔斷。

歷史 `application/simulation.ts` 與快照工具僅保留作回歸／單元件除錯；正常頁面使用無獨立電源控制的 `project/simulation.ts`。一般匯入不能藉 debugger 快照恢復雙來源。
