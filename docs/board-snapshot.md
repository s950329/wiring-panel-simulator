# 盤面 JSON 快照（WIRE-R8）

按右側上方「匯出盤面 JSON」。檔名含版本與 UTC 時間，例如 `wiring-panel-WIRE-R8-2026-09-13T15-30-00-000Z.json`。走線失敗後可直接匯出並提供檔案，不必清除現有接線；送電中與模擬暫停時也能匯出。

匯出是點擊當下的資料副本，不改動盤面、選取、操作或模擬。若正在計算新線，快照會記錄 `busy` 與 `routing`；要保留完成結果，可待訊息出現後再匯出。重新整理仍會清除頁面狀態，此版尚未提供匯入。

## 格式

頂層 `format` 固定為 `wiring-panel-snapshot`，`schemaVersion` 為 `1`，`revision` 是模型修訂代號。未來匯入功能應先驗證格式與版本、端點及配置相容性，再決定重建或轉換方式。

| 欄位 | 內容 |
|---|---|
| `exportedAt`、`units` | UTC 匯出時間；座標為場景單位，角度為弧度 |
| `configuration` | 盤面、線槽、導軌、過門規則及初始元件配置 |
| `components` | 當前元件 ID、定義、配置、操作狀態、端子、電性輸出、父層、實際姿勢、可動機構及燈罩材質狀態 |
| `wiring.physical` | 實體線 ID、端點、路徑座標、線槽索引及半徑 |
| `wiring.external` | 外接電源／馬達的 E 編號接線 |
| `wiring.fixed` | 明示固定組裝連接 |
| `wiring.session` | 操作模式、未完成起點、計算狀態、選中線、證據線、復原順序與最近走線嘗試 |
| `simulation` | 模擬模式、電源設定、結果、對應求解輸入與當前 circuit；元件檢視頁可為 `null` |
| `view` | 頁面、選中元件／端子、操作板開闔、附掛與格線顯示、相機及世界姿勢 |

`wiring.session.lastAttempt` 的 `status` 為 `routing`、`connected` 或 `failed`；保存 `from`、`to`、`error` 與 `wireId`。尚未嘗試接線時為 `null`。最近嘗試記錄不等於現存接線，線是否存在以 `wiring.physical` 為準。

模擬暫停後，`evaluatedCircuit` 對應引發錯誤的那輪結果，`circuit` 表示快照當下輸入；兩者可以不同。`components` 另存邏輯狀態與當下材質／機構姿勢，以便判斷畫面是否尚在動畫過程。

快照不包含 Three.js mesh、GPU 資源或 DOM，模型由版本化原始碼重建；未保存逐幀動畫計時及整段操作錄影。此格式是排查與日後分享的資料基礎，目前不能直接拖回網站恢復盤面。
