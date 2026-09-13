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

`EvaluationState.inputs` 為電性操作，`coils` 為外部提供的線圈 snapshot；求解結果不直接改寫機械 `pressed` 或燈泡測試狀態。完整資料依據、未確認端子、教學假設及 API 範例見 `docs/electrical-models.md`。新增模組尚未由 application／view 匯入，所以畫面與離線 HTML 仍是 WIRE-R5；此 source commit 不代表畫面已有送電模擬。

`npm run test:electrical` 可在沒有 DOM 或 Three.js 匯入的電性測試程式中執行。完整 `npm test` 另比對所有既有元件的端子 ID 並驗證面板翻轉、演示操作不改變相同輸入的電性結果。Phase 2 的穩態回授、三相馬達及 Phase 3–4 的 UI／解釋尚待實作。
