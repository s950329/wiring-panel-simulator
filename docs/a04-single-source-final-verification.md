# WIRE-R14 最終驗證與交付狀態

本文件補充 `a04-single-source-acceptance.md`，記錄實作完成後的實際主分支驗證。應用程式來源為 commit `0ad9da5ecec34e4ccf0e0d32b21a3394017cc735`，tree `aaabf6cad9cfe6f49e57d7dd90808f92a3647b4b`；本次文件更新不改變程式、測試或建置內容。

## 主分支完整 CI

[Run 34859276352](https://github.com/s950329/wiring-panel-simulator/actions/runs/34859276352) 已整體成功，非僅挑選成功步驟：

- `npm ci`、TypeScript strict、`npm test`：174 通過、0 失敗、0 跳過。
- 網站與離線 HTML 建置成功；原有 chunk／dependency audit 警示見前份驗收文件，未宣稱已完成依賴安全修正。
- 真實 Chromium 瀏覽器 25 個操作檢查通過，pageErrors 為空；包含單一來源、QF1 控制、四端 FUSE 接線的原生重建、啟停、自保持、過載、操作板開闔、匯出／匯入、取消、重設及本地 file:// 單檔啟動。
- 產物及 canonical 原始碼 ZIP 封存成功。下載後已逐檔核對原始碼；13 個 production files 及單檔 HTML 與本地交付內容逐位元組相同。

## 不隱藏先前逾時

同一 commit 的分支 [Run 34858534964](https://github.com/s950329/wiring-panel-simulator/actions/runs/34858534964) 曾在完成 19 個瀏覽器檢查後，於「重設盤面」等待超過 30 秒；當時沒有未捕捉的瀏覽器例外，174 個測試及建置已成功。之後 main 在**不修改程式或原有測試期限**的情況下通過全部 25 項。

隔離的 [Run 34859882735](https://github.com/s950329/wiring-panel-simulator/actions/runs/34859882735) 只把診斷腳本的重設等待上限改為 90 秒，保持同一程式、全部斷言及繪圖設定；亦通過 25 項，重設實測約 1.14 秒。這不證明先前逾時的根因，也不能據此宣稱延長等待已修復程式；因此未把診斷改動併入 main。保留診斷分支與原始結果，作為測試穩定性紀錄。

`a04-loaded.png` 截圖持續在 10 秒逾時，明列 captureWarnings。功能操作及 Three.js 幾何驗證已完成，但**FUSE 四端的螢幕目視驗收仍未完成**，不能以合成示意圖或通過的單元測試替代。

## 可用交付物

- `wiring-panel-WIRE-R14.html`：可由桌面 Chrome 直接開啟；無須另開伺服器。
- `A04-single-source-WIRE-R14.project.json`：由程式重建後輸出，只保存配置与端子連接。28 條盤內線、6 條外接線、3 條固定組裝導體；QF1 預設 OFF、操作板閉合、模擬未執行。
- 同版本原始碼、網站 build ZIP、SHA-256 清單及使用說明。

正常 runtime 沒有獨立 CONTROL 或主／控制電源勾選。正確 A04 中 QF1 OFF 切斷下游 MC、馬達、燈與警報供電，但不取消進線來源；刻意接進線側的旁路仍依實際接線運算。

## 尚未發布既有 Site

目前未透過工具更新或驗證 `leo-wiring-panel.leochien0808.chatgpt.site` 的此次發布，不能把 GitHub main 與 build 成功當作原網址已更新。原 Site project_id 保留、不另建替代 Site。新 project JSON 應配合 R14 使用，不要匯入仍顯示 R12 的頁面。

可先使用本次交付的 R14 HTML，匯入新 A04，按「開始測試」、將 QF1 扳為 ON，再按 PB3。按 PB5 停止控制；扳 QF1 OFF 應讓正常 A04 的下游回路一起失去供電。這仍是教學模擬，並非實機額定或安全驗證。
