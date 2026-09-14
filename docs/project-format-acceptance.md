# 配線專案重建：WIRE-R13 歷史驗收記錄

本文件記錄原分支的 R13 驗證，不代表目前供電規格。R14 單一來源與新版 A04 的行為及結果請見 [單一來源驗收](a04-single-source-acceptance.md)。

## 範圍

依 `docs/superpowers/specs/2026-09-14-project-format-design.md` 實作 WIRE-R13。新版一般匯出為 `wiring-panel-project` v1；元件／結構配置與端點接線分離，不保存導線路徑。

## 已執行的本機驗證

完整 `npm test`：144 項通過、0 失敗、0 跳過；`npm run build` 成功，含 TypeScript strict、Vite 及獨立 HTML 的兩段 script 語法／逐位元組檢查。Vite 仍提示主 bundle 超過 500 kB，未藉調高警示門檻隱藏。

- 實際建立配置、元件、組裝、固定導體及外接設備；原有 108 項測試基準通過。
- 原有預設盤面與新預設 runtime 的所有端子定義／世界位置一致，3,542 個碰撞盒（含結構）逐項比對一致；未修改 model-baseline fixture。
- 新格式白名單、數量／數值限制、缺端子、未知型號／版本、插槽與重複／自接／分支案例通過。
- 新版 26 條 A04 盤內線＋8 條外接線實際重建，兩輪開闔、碰撞／線距／自交及匯出再匯入通過；三條固定銅片仍來自組裝。
- A04 待機、啟動、自保持、停止、再啟動、過載紅燈／蜂鳴器、RESET 不自啟、控制電源中斷及恢復不自啟通過。
- 舊快照轉換不使用舊 points 或 display metadata；矛盾位置與額外／缺少固定導體會拒絕。
- 讀檔中鎖定、取消、過期讀檔結果、走線失敗保留舊 runtime、清除 UI 鍵盤事件及專屬資源的回歸通過。
- 本機 Chromium 導航 `http://localhost:5173/` 受到 `ERR_BLOCKED_BY_ADMINISTRATOR` 阻擋；未把 Node 測試冒充瀏覽器目視驗收。

完整測試與建置次數／結果以隨附執行記錄及 GitHub Actions 該次 run 為準。`qa/project-browser-check.py` 已納入 CI，包含檔案匯入、PB 按下／放開、自保持、過載、取消、不同專案、獨立電源及獨立 HTML；只有該次 CI 成功才視為瀏覽器操作通過。

## 交付界線

應用程式與獨立 HTML 由同一份 WIRE-R13 原始碼建置。保留既有 Sites 設定，不建立新 Site。若沒有既有 Site 的發布工具，必須明確標示未發布，不把 GitHub 更新或建置成功當成網站已更新。

尚未加入拖拉配置編輯器、任意斜向／多層盤體、自帶元件腳本或真實電流計算。不同路由版本不保證相同線形；電路端點與持續設定才是往返保存的判準。
