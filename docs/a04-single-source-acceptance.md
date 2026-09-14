# WIRE-R14：A04 單一電源修正與驗收

## 行為與交付範圍

依已確認的 v0.2 供電規格，正常專案只接受零／一組三相來源，沒有獨立 CONTROL、available 參數或個別電源開關。零來源是尚未接入電源的草稿。A04 明示選用 `teaching-ac220-three-phase-source` v1；同一來源的三組相對可供相容控制負載使用，來源本身仍只有一個。

來源在測試模式中啟用。QF1 只改變其三組接點，不更改來源的 enabled；進線端仍連至電源，錯接在進線側的旁路不會被軟體隱藏。「開始測試／返回配線」是軟體運算／編線邊界，不是第二顆供電開關。

A04 範例為 `examples/a04-motor-start.project.json`：28 條原生盤內走線、6 條外接線、3 條組裝導體，預設 QF1 OFF、操作板閉合、模擬未執行。兩個 FUSE 的 IN 改為 QF1:T1／T3；OUT 維持控制回路端點。沒有手工保存 points 或虛擬 CONTROL 旁路。

整合以專案格式分支 `98ba3d274f377a204cce8e12ad078e0f8a56ce37` 為程式基底，保留 main `38b1c13834bc606214740548ce64dbae04233876` 的最新規格。原專案格式分支不覆寫。

## 實際本機驗證

- 原分支基準：144 項測試通過。
- 新版完整 `npm test`：174 項通過、0 失敗、0 跳過，含 TypeScript strict。
- 新相間能力測試先重現失敗，再確認成功；稀疏索引的無效宣告另以失敗／成功測試保護。
- 本盤唯一來源、無 power/sourcePower/setPower/setSource、拒絕來源 enabled/available 等契約通過。
- 實際 Three.js 重建 28 條線、兩輪操作板開闔、逐線實體碰撞／線距／自交、專案匯出再匯入、所有實例改名等回歸通過。既有模型基準檔未修改。
- 按 ON 啟動／放開保持／OFF 停止／過載警報／RESET 不自啟，與 QF1 斷開／恢復、警報時斷開 QF1、進線側仍連到來源、故意旁路 QF1、任一 FUSE／其四端接線中斷、S 相缺失及持續按住 ON 的恢復行為均通過。
- 相對省略、無效宣告、不同 profile、同相、相間短路、跨來源衝突、串聯負載與懸空分支仍維持原安全分類，沒有關掉故障檢查。
- 舊有 CONTROL 接線的拒絕載入保留原專案；未接線的自動 CONTROL 才能移除且顯示報告。MAIN generic 保留原能力，不默默升級。
- `npm run build` 成功，包含獨立 HTML 兩段 script 的語法與逐位元組檢查，以及 Vite 建置。大型 chunk 警示仍如實保留。

## 瀏覽器與發布狀態

本機 Chromium 在進入 `http://127.0.0.1:4173/` 時遭 `ERR_BLOCKED_BY_ADMINISTRATOR`，未完成本機瀏覽器操作驗收。沒有變更瀏覽器管理政策。

`.github/workflows/project-format-ci.yml` 與 `qa/project-browser-check.py` 已更新為 R14 功能案例，將在隔離分支執行實際 pointer 操作、A04／不同專案匯入、QF1、按鈕、警報、取消、單檔 HTTP 與 file 入口。遠端驗收以對應 commit 的 Actions 結果為準。畫面截圖有獨立 captureWarnings；截圖失敗不得寫成目視通過。

目前尚未取得可更新原 `leo-wiring-panel.leochien0808.chatgpt.site` 的發布工具。本文件記錄程式／建置結果，不代表既有 Site 已更新。保留 `.openai/hosting.json` 原 project_id，禁止另建替代 Site。

## 邊界

仍為教學導通／供電模型，沒有實機額定、安全認證、保險絲時間／電流曲線、轉速或相量數值計算。MC 狀態綠燈不保證馬達三相完整。TH20 既有量程不因題圖標示 3.3A 就被改寫。保險絲蓋開闔不是熔斷。

`application/simulation.ts` 與舊快照工具僅為歷史回歸／單元件除錯保留；正常配線頁使用 `project/simulation.ts`，不建立舊來源。一般專案不能匯入 debugger 的執行快照來恢復雙來源。
