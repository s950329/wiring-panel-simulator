# 配線專案格式與操作（WIRE-R16）

一般保存單位是完整配線專案：`configuration` 保存元件與結構配置，`connections` 只保存端子連接。程式不再要求匯入資料與 BOARD 024 相同，也不接受配線檔指定電線路徑。原本的 BOARD 024 只是預設空專案。

## 使用方式

按「匯入配線專案 JSON」載入新格式，或舊 R8–R12 整盤快照。匯入會先建立另一份暫存盤面並自動走線；全部完成才替換畫面。進度列可取消，格式、元件或路由錯誤會保留原專案。讀檔及重建期間不可送電、接線或調整設備。

匯入後保持配線模式，模擬未執行。開關位置、急停鎖定、過載跳脫、旋鈕檔位、過載設定及操作板開闔會還原；按住的按鈕、演示亮燈、接觸器吸合與自保持記憶不恢復。按「開始測試」才執行求解；QF1 的實際接點控制正常下游供斷電，沒有獨立電源勾選。

按「匯出配線專案 JSON」保存目前設定與實際連接；匯出不改動目前的通電或演示狀態。線號、相機、選取、電線座標、求解結果、端子局部座標及完整型號資料不進檔案。

選取任意實例後按「單獨檢視選中元件」，會顯示該實例及其組裝，不依賴 MC1 的固定名稱。檢視使用渲染圖層，不移除碰撞障礙。「載入預設盤面」則重新建立電源已預接、尚無練習接線的 BOARD 024，不與舊專案合併。

## 可直接載入的範例

- `examples/a04-motor-start.project.json`：完整 A04 電路，28 條盤內線、3 條馬達外接線，另有 3 條固定電源進線與 3 條組裝銅片；操作板閉合、QF1 OFF、模擬未執行。
- `examples/board-024-empty.project.json`：原盤面配置，包含三條固定電源進線，沒有使用者接線。
- `examples/custom-panel-less.project.json`：不同底板尺寸、兩顆元件、一條線，沒有操作板或隱含電源。
- `examples/shared-source-drives.project.json`：兩組不同位置／方向的 S-P16、AP-22、TH20，共用一個三相來源及一個總開關，各自以 TH 接點控制回路，不使用獨立供電開關。

A04 的啟動鍵為 PB3、停止鍵為 PB5；TH1 TEST 使 MC1 釋放、HL3 紅燈與 BZ1 警報啟動。RESET 後且 ON 已放開時不自行重啟。唯一 MAIN 使用明示的相間能力，經 QF1 後的 R–T 與兩顆 FUSE 供控制回路；沒有 CONTROL。仍不計算真實電流、保護時間或實體額定。

## 契約

頂層：`format: "wiring-panel-project"`、`schemaVersion: 1`、可選 `name`、`configuration`、`connections`。這個 schemaVersion 與網站的 WIRE-R16 不同。新版只接受白名單欄位。

`configuration` 的欄位：

| 欄位 | 內容 |
|---|---|
| `units` | `{ "position": "scene-units", "rotation": "degrees" }`，不是實測毫米 |
| `board` | `id`、`width`、`depth`、`thickness`，底板上表面 Y=0 |
| `operationPanel` | `null`，或 `id`、`definitionId: "hinged-operation-panel"`、`definitionVersion: 1`、`position`、`rotationY`、`width`、`depth`、`thickness`、`skirtHeight`、`state: {open}` |
| `rails`、`ducts` | 各項 `id`、`mountId`、`position`、`rotationY`、`length`、`width`；本版安裝於底板 |
| `components` | 各項 `id`、`definitionId`、`definitionVersion: 1`、`placement`，及允許的 `parameters`／`state` |
| `fixedConnections` | 可選的設備預接線陣列，每项為 `{from, to}` 端點；不參與使用者接線計數、刪除或復原，明示 `[]` 表示沒有額外預接線 |
| `assemblies` | `id`、`definitionId: "shihlin-sp16-accessories"`、`definitionVersion: 1`、`hostId` |
| `panelGateway` | `null`，或 `panelId`、`component`（端子台實例）、`boardSide` 與 `panelSide`（相反的 A／B） |

元件自由安裝使用 `placement: {mountId, position:[x,y,z], rotationY}`。操作板上元件使用相對鉸鏈座標，不隨翻轉改寫。附掛元件使用 `{assemblyId, slot:"auxiliary"|"overload"}`，由組裝規格提供相對位置；外接電源與馬達使用 `placement: null`。位置與方向由資料提供，型號內的端子位置與電性仍由已支援的元件庫提供。

S-P16 附件組裝的宿主必須是 `shihlin-sp16`；`auxiliary` 插槽接受 `shihlin-ap22`，局部位置 `[0,83,0]`；`overload` 接受 `shihlin-th20`，位置 `[0,0,80]`。只有實際附掛 TH20 時才生成三條固定銅片；自由放置在接觸器旁邊不會被當成接好。

持續輸入按型號驗證：斷路器 `state.on`；急停 `state.latched`；選擇開關 `state.position`（0、1、2）；過載 `state.trip` 與 `parameters.current`（12–18、間隔 0.5）；保險絲保護蓋 `state.open`；來源不接受 `parameters.enabled` 或 available。缺值用該型號預設值；無效值拒絕，不截斷。瞬時 `pressed`／手動燈 `on` 即使出現在輸入中，也只驗證布林型別後丟棄，不持續演示。

`connections` 每項只有：

```json
{
  "from": { "component": "QF1", "terminal": "T1" },
  "to": { "component": "MC1", "terminal": "1L1" }
}
```

`configuration.fixedConnections` 使用相同端點格式，與組裝銅片一起進入電性求解；固定預接線以清單呈現，既有電源電纜外觀保持原樣，不為任意預接線自動生成 3D 走線。新文件中固定線與使用者線若重複會拒絕。

from／to 不代表交流電流方向。A→B 與 B→A 是同一連接；拒絕重複、自接與重複的固定銅片，允許不同連接共用端子的分支。按陣列次序重建；新線號不保證保留舊的編號空缺。

## 路由與相容性

WIRE-R16 的匯入器會辨識缺少 `fixedConnections`、且完整結構仍等同既有 BOARD 024 的新版專案格式。比對包含底板、操作板、導軌、線槽、元件 ID／型號／位置、組裝及過門配置；忽略名稱、操作狀態、參數與清單順序。只有這些舊盤會補三條 MAIN→QF1 固定進線，並移除使用者清單中完全相同（含反方向）的進線；原始 22 條控制線與開關位置不變，錯接也不會被改正。匯入狀態會顯示轉換說明。明示 `fixedConnections: []` 或改過結構的自訂盤不會被補線；通用 validator／solver 不辨識課堂答案，也不隱含新增電源。

手動接線、檔案匯入與離線命令共用 `ProjectRuntime.connect()`。路由器讀取當前專案的 `RoutingContext`，按線槽 ID 與幾何可達關係選路，不依賴固定第 4 條線槽。現階段線槽相接需在相同底面高度、平面範圍相交；不同高度或斷開的線槽群會明確報錯，不生成盤外替代路徑。

有操作板的匯入先在暫存模型展開接線，再驗證／重算到保存的目標開闔狀態。關閉失敗會取消整次匯入，不偷偷把檔案改成展開。所有路線仍受元件淨空、線距與自交檢查。取消在讀檔、各建模／接線步驟之間生效；單次同步路由仍有既有節點上限及時間檢查，不宣稱能在任意計算指令中即時中斷。

JSON 無法攜帶任意全新型號、腳本或遠端模型。未知型號／契約版本、缺少宿主或端子、錯誤插槽與原型污染欄位均拒絕。允許保存電氣錯線練習；短路或尚缺電性模型由測試求解診斷；兩個來源的配置在本盤會先被拒絕，不為了通過模擬而改接線。

資源上限：10 MB、128 元件、8,192 端子、512 使用者接線、512 額外固定預接線、各 64 條線槽／導軌、引用深度 16。ID 最多 100 字元（文字、數字、底線、連字號、句點，不能使用冒號或管線字元），專案名稱 200 字元。座標每軸絕對值 ≤10,000，尺寸為 ≤10,000 的有限正值；安裝中心須在對應安裝面範圍內。支援一塊矩形底板、零或一塊操作板、90° 整數倍的安裝方向，不含拖拉配置編輯器。

舊檔仍有 CONTROL 接線時不相容，會指出端點並保留原專案；只有未接線的自動 CONTROL 可移除並回報。舊 main=false 無法映射為總開關，拒絕而不猜測；generic MAIN 不自動增加相間能力。其他可映射的舊 R8–R12 整盤快照以明示舊配置規則轉換：忽略舊路線、顯示 metadata 及求解結果，但驗證型號引用、配置／元件位置一致、組裝偏移及固定銅片。舊版的固定 800×640×7 盤體才能唯一還原；不同尺寸或有矛盾的舊資料會拒絕，不猜測。舊單元件快照繼續使用 `/mc1.html` 的相容入口；一般新版專案不得把除錯快照當作輸入。

## 開發命令與入口

```sh
npm ci
npm test
npm run build
npm run rebuild-project -- old-or-new.json new-project.json
```

重建命令實際跑同一套模型與路由，輸出純專案資料，從不覆寫原檔或既有輸出。新增的主要測試位於 `qa/project-*-check.mjs`；完整 Node 測試包含原有幾何基準。`qa/project-browser-check.py` 另外驗證瀏覽器實際操作與獨立 HTML。

程式分工：`src/project/` 的 contracts／fields／validation／catalog／assemblies／legacy／default-project 負責純資料；model／structures／resources／equipment／runtime／session 負責重建與所有權；view-binding 只控制渲染圖層；app 負責目前專案 UI。舊 `layout.ts` 是預設配置的相容讀取介面，不再是新專案的來源。`scene.js` 的舊建模入口、舊 snapshot 工具及 `/mc1.html` 保留供歷史回歸／除錯，不供一般動態專案匯出。

`window.wiringLab.getProject()` 回傳目前專案副本；`loadProject(jsonText)` 與檔案選擇器使用相同交易；`getSnapshot()` 是明確標示的 `wiring-panel-debug`，不支援一般還原。沒有回傳 live mesh 或模型參照。
