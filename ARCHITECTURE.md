# 配線盤元件架構 · WIRE-R2

本次以使用者已確認的模型與 WIRE-R1 配線行為為基準。重構的目的，是讓新增規格和行為有明確邊界；未增加電路通電求解或拖放編輯器。

## 目前的分工

| 模組 | 責任 |
|---|---|
| `src/core/contracts.ts` | 型號、實例配置、端子、狀態、action、behavior、view 契約 |
| `src/catalog/definitions.ts` | 可重用型號／外觀變體資料；不包含盤面位置或當前狀態 |
| `src/catalog/resolve.ts` | 解析 definitionId；驗證位置、重複 ID、父元件與循環；白名單合併配置 |
| `src/layout.ts` | 盤面、線槽、DIN 軌及元件實例的擺放位置 |
| `src/core/component.ts` | ComponentInstance：獨立狀態、操作入口、view 呼叫、可序列化資料 |
| `src/core/behaviors.ts` | 純狀態轉換、允許操作、狀態文字與操作描述；不依賴 DOM／Three.js |
| `src/views/component-view.ts` | ThreeComponentView：把 typed state 反映到既有模型，提供路由姿態同步 |
| `src/views/inspector.ts` | 由操作描述產生按鈕／選項／滑桿；管理 hold 事件 |
| `src/core/interactions.ts` | DOM／mesh 動作解析、配線開蓋限制、暫態操作與音效生命週期 |
| `src/components.ts` | 組合 definition、placement、behavior、model 與 view 的唯一工廠 |
| `src/views/models.js`、`src/models/mc1.js` | 沿用已核對的 3D 幾何建立器 |
| `src/wiring/terminals.ts` | 從穩定端點 ID 解析世界變換、盤面座標、出線方向與夾線 anchors |
| `src/wiring/router.js` | 沿用既有線槽選擇、局部逃逸、避障與電線間距演算法 |

型號與實例的例子：`shihlin-sp16` 是規格，`MC1` 是盤面上的實例。兩顆相同規格共用不可變 definition，但各自建立 root、terminals、parts 和狀態。

## 操作與更新

1. UI 或 mesh 互動經過 action 解析與 application guard。
2. `ComponentInstance.dispatch()` 檢查該 behavior 是否支援操作，不支援則回傳 accepted=false。
3. behavior 產生新的狀態；實例凍結狀態，外部不能直接修改。
4. scene 呼叫 `updateView(parent)`；view 更新可動部件。AP1 的連動來自父元件的 pressed。
5. 需要路由時，WiringController 呼叫 `syncRoutingPose()`，使保險絲蓋到達確定姿態。

按下／釋放、急停、檔位、過載、ON/OFF 與開蓋各有自己的 state。保護蓋 open 不代表保險絲的電气導通。元件從 Map 動態取得時，型別只知道 ComponentRuntime，因此仍由行為做 runtime action 檢查。

MomentaryOperations 統一管理按鈕、接觸器與蜂鳴器的暫態操作。失焦、取消、capture loss、隱藏頁面及重繪操作區會釋放暫態按壓；急停鎖定及其他持續狀態保留。

## 新增型號

沿用既有外觀及行為的元件，只需新增 definition 與 placement，例如：

```ts
// definitions.ts 的一項資料
{
  id: 'button-orange',
  viewType: 'button',
  behavior: 'button',
  name: '橘色按鈕',
  model: '圓形瞬時按鈕',
  size: [38, 45, 38],
  color: 0xe58b32,
  hint: '按住按鈕，放開回彈。'
}

// layout.ts 的實例配置
{
  id: 'PB6',
  definitionId: 'button-orange',
  x: 500,
  z: 300,
  rotation: 0
}
```

不同外型需要加入新的 viewType／模型建立器。不同功能需要新的 behavior 實作與工廠登錄。UI 從操作描述建立控制項，場景只呼叫 view，因此不需要把每種功能重新寫進 main／scene。

本階段 ThreeComponentView 是既有幾何的共用 adapter，動作幅度忠實沿用現有型號。若新增型號的機構動作不同，應提供對應 view 或動畫參數，不應在主程式增加型號特例。

## 端子與配線邊界

端點以 `{component, terminal}` 引用實例和端子 ID，並不儲存 Mesh。TerminalDefinition 是純資料，TerminalView 才持有 Three.js 物件。

現階段端子座標仍由已核對的建模函式建立，再在 view 邊界整理成不可變 TerminalDefinition；尚未將所有幾何端子搬成獨立規格資料。這避免本輪維護兩套座標造成差異。

- localPosition 與 exitDirection 都在**元件局部空間**。
- 螺絲本身可能旋轉，操作板也會翻轉；路由使用各自的矩陣換算。
- 插座 9–11 腳明確提供左向出線，路由器不再按型號猜方向。
- electricalRole 全部保持 unverified，尚未驗證內部電性或導通。
- escapePath 是保留欄位，目前路由器不使用它；內層端子仍透過原有避障搜尋找到出口。
- batching 必須保留獨立端子、可動 parts、routingBoxes、action 和 motion envelope，不能把整個元件合成單一障礙盒。

placement 記錄初始盤面配置。目前尚未提供拖放及位置寫回 API；未來加入拖放時，需同步 placement、root、附掛元件與受影響電線，不能只修改 root 後直接使用初始配置儲存。

## 型別與驗證範圍

TypeScript 5.9 採 strict、allowJs、noEmit。新核心採 TS，舊的幾何、場景、主頁與路由演算法暫時為 JS，checkJs 尚未全面開啟。因此本版不宣稱整個專案都已受嚴格型別檢查。

- `npm run typecheck`：含負向型別案例，驗證不合法 action、電流值及直接改 state 會被拒絕。
- `npm test`：型別檢查、原有幾何／MC1／配線測試，以及行為、附掛連動、取消、輸入驗證與序列化。
- `npm run build`：型別檢查後執行 Vite。
- `npm run offline`：型別檢查後產生獨立 HTML；驗證內嵌程式的語法與逐位元組一致性。

幾何基準是 WIRE-R1 實際模型的雜湊與全端子座標，不是重構後重新接受的快照。配線測試除了靜態障礙與電線間距，也透過新 action/view API 驗證機構操作後的淨空。

本輪測試在 Node 中使用 Three.js 幾何與事件物件，不需要 WebGL；它不能取代瀏覽器內的最終畫面與操作驗收。


## WIRE-R3：操作板姿勢與配線交易

`WiringController.movePanel()` 接收新姿勢與還原函式，套用姿勢後先檢查固定線的淨空；只重算連到操作板或受到遮擋的路徑。新線材全部建好才一次替換，保留 ID、端點、選取與線序。失敗時釋放暫存 mesh 並還原姿勢，不建立穿模替代線。

操作板以 `userData.operationPanel` 標記，閉合時 router 優先從端子壓片邊緣沿後方出口走出，再上升；所有段落仍通過既有實體與線間距檢查。操作板高度與支撐的變更是實體淨空修正，不是改變電性。頁面模式與未完成起點由配線 UI 管理；元件 selection 不再隱含改變操作板姿勢。

## WIRE-R5：操作板側走線

`layout.panelGateway` 指定過門端子台 TB1 的 B 側朝向操作板，A 側朝向盤內。兩端皆為操作板元件或 TB1 B 側時，路由在端子出口之間直接避障連接，`viaDucts` 為空；搜尋全程限制在端子台朝向操作板的一側，失敗時不繞回盤內線槽。涉及盤內端子的接線沿用線槽規則。

直接路徑仍使用實體淨空、電線間距及自交檢查，並由既有 `movePanel()` 在開闔時重新計算。新增測試涵蓋雙向選取、操作板內跳線，以及 36 個操作板端子同時接至 TB1 B 側後反覆開闔；元件幾何與端子座標保持原基準。

## 電性 Phase 0–1：独立核心

`src/electrical/` 新增純 TypeScript 資料契約、明示教學 catalog、netlist 與單輪 solver。端點仍為 `{component, terminal}`，但不依賴 Three.js 或核心的 view 型別。wire／固定橋接／閉合接點形成 net；負載保留兩個端點並接受明確來源 profile。`load-paths.ts` 使用雙連通區塊區分串聯負載與懸空支路。

`EvaluationState.inputs` 為電性操作，`coils` 為外部提供的線圈 snapshot；求解結果不直接改寫機械 `pressed` 或燈泡測試狀態。完整資料依據、未確認端子、教學假設及 API 範例見 `docs/electrical-models.md`。Phase 0–2 交付時尚未接入畫面；Phase 3 的接入方式見下節。

`npm run test:electrical` 可在沒有 DOM 或 Three.js 匯入的電性測試程式中執行。完整 `npm test` 另比對所有既有元件的端子 ID 並驗證面板翻轉、演示操作不改變相同輸入的電性結果。

## 電性 Phase 2：穩態回授與三相主電路

`simulator.ts` 的 `settleCircuit()` 以相同輸入、上一個線圈向量反覆呼叫单輪 evaluator，同時更新線圈；只有接點／線圈一致的穩態可對外發布。`ElectricalSimulator` 保存穩態並在錯誤、震盪或超限時清除記憶、鎖定 halted，直到 reset；不修改使用者操作或接線。

`Circuit.threePhaseSources` 與 `ElectricalModel.motors` 是向後相容的可選資料。`power.ts` 統一辨識二端／三相來源，檢查相間短路與來源衝突，並輸出獨立 `Evaluation.motors`。馬達只有直接接到同來源三個不同相別時供電成立，不能從 MC 的狀態推導；缺相／重複相別與串聯、混源等不支援情況分開。馬達負載路徑只供不支援網路偵測，不加入 net 的理想導通邊。

`exercises.ts` 的 `directOnLineCircuit()` 提供一般資料格式的教學配置，用於驗證啟停、保持、安全接點、電源事件與錯線。求解器沒有對它的 ID／線路做特判。`npm run test:electrical` 納入穩態、三相與完整事件序列測試。

馬達在診斷圖中以三條端子支線連至獨立 hub，並沿用 `load-paths.ts` 的來源對簡單路徑分析；這只是追蹤哪些端子參與回路，不代表星形繞組或電性橋接。未直接接到來源的端子必須位於實際來源回路上，才屬不支援的負載間供電；懸空支線不會因旁路馬達或無回流的另一電源而被誤判。

## 電性 Phase 3：WIRE-R6 操作整合

`application/simulation.ts` 讀取實際元件狀態及 WiringController 的端點，另保存 CONTROL、MAIN、M1 外接卡片的 E 編號連接；外接設備不冒充盤內幾何。`equipment.ts` 明示登錄 SP16／TH20 父子組裝的三條固定銅片接線，畫面可查閱，並不從 mesh 推導導通。

ComponentInstance 的 `electricalOutput` 與機械 `state` 分開。模擬中 `pressed`／`audible` 及 lamp view 使用穩態輸出；AP view 讀父接觸器的有效吸合狀態。`present()` 移除手動 MC／燈／蜂鳴器演示，application 操作入口也拒絕它們。MomentaryOperations 透過同一操作入口釋放瞬時輸入。

送電前清除演示狀態與舊線圈記憶；停止保留接線、急停與 TH 跳脫。實體／外接線的底層 mutation guard 與 UI 均鎖定 active／halted 模式，非同步走線完成前禁止送電；幾何 movePanel 不屬電路編輯。Phase 3 的 Node 測試包含真實元件、完整走線、面板移動、供電與編輯防護；瀏覽器 E2E 留待 Phase 4 完成後驗收。


## 電性 Phase 4：WIRE-R7 證據與復原

`electrical/explanation.ts` 從同一輪 Circuit／SimulationResult 建立中文原因、端點與 wire ID。`traceEndpoint()` 僅追蹤理想導通網路，不跨負載、不推論電流。開路接點只作相鄰證據；halted 只顯示原始診斷和相關接線，不重用中途輸出。

SimulationController 的 `evaluatedCircuit` 快照與 result 同步，停止即清除。simulation-panel 呈現可展開原因、端子定位按鍵；main 的定位入口與可新增電線的 selectTerminal 分開。WiringController 的 evidence 集合只控制材質；配線面板的單線選取、Delete 和歷史復原不會把證據高亮當成可刪除選取。狀態更新清除舊證據，重新追查使用新結果。


## WIRE-R8：操作板走線候選重試

TB1:42B → HL4:2 在周邊已有接線時可能失敗，並非空端子被當成占用。`join()` 原先只檢查橋接段與元件／其他線的碰撞；某個轉折順序會折回本線的端子出線段，完整線路的自交檢查才拒絕它。後續高度重試仍選到相同轉折，形成可避開卻連不上線的情況。

操作板直連現在以包含兩端出線段的完整候選路徑做自交判斷，`join()` 在接受候選前執行檢查，失敗就繼續嘗試其他軸向轉折。A* 結果同樣須通過完整候選檢查；搜尋仍有高度與節點上限。未放寬實體淨空、電線間距、半平面限制或自交檢查，也不移動既有線。元件幾何、端子 ID 與電性均未改動。

`qa/panel-route-retry-check.mjs` 重現不同高度端子折返及 22 條周邊線下 42B 仍未使用卻報錯的案例，驗證雙向連接、既有線不變、淨空與面板開闔。這是實際 Three.js 幾何與路由測試，不取代瀏覽器視覺驗收。

## WIRE-R8：快照與選線辨識

`application/board-snapshot.ts` 組合可序列化的元件、幾何姿勢、實體與外接接線、固定組裝連接、模擬及視角資料；格式識別與 `schemaVersion` 分開保存，詳見 `docs/board-snapshot.md`。匯出僅讀取當下狀態，不釋放瞬時輸入、不重新求解或重算路由。配線面板保存最近一次嘗試的兩端、進度、錯誤及成功 wire ID，失敗不會偽造一條接線。

單線選取使用桃紅色並沿既有 `scene.onBeforeRender` 以 1.2 秒週期向淺色變化；未選中線淡化，證據線用青色。每幀從當前 group 找選中 mesh，操作板移動替換 mesh 後仍持續顯示；取消選取、追查或刪線不殘留動畫。`prefers-reduced-motion` 停用顏色變化及接線列動畫，保留高對比。動畫只改材質，不影響路徑、碰撞或電性。

指示燈原有 view 已依手動狀態或模擬供電設定正面鏡片材質的 emissiveIntensity。新增四顆燈的實際 mesh／材質回歸測試，涵蓋手動亮滅、送電及斷電；操作提示說明需收合操作板查看正面。
