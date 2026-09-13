# 配線盤元件架構 · WIRE-R3 / Component Catalog Phase 1

本階段以既有 WIRE-R3 畫面、端子座標與配線行為為回歸基準，開始把元件型號資料改成可擴充的 Component Catalog。重構不新增電路通電求解，也不改變目前盤面的操作語義。

## 核心分層

```text
Component Definition (產品／型號)
        │
        ├── category        產品語意
        ├── behavior        操作／狀態行為
        ├── visual.model    3D builder registry key
        ├── terminals       已驗證端子規格
        └── electrical      已驗證內部電氣關係
        │
        ▼
Component Placement (盤面實例)
        │
        ▼
Component Runtime
        │
   ┌────┼────┐
   ▼    ▼    ▼
 View Wiring Behavior
```

`shihlin-sp16` 是產品 definition；`MC1` 是盤面上的 instance。相同 definition 可以建立多個獨立 instance，各自持有自己的 root、terminals、parts 與 state。

## 目前模組責任

| 模組 | 責任 |
|---|---|
| `src/core/contracts.ts` | category、visual、型號、placement、terminal、electrical、state、behavior、view 契約 |
| `src/catalog/definitions.ts` | 可重用產品／型號資料；不包含盤面位置或當前狀態 |
| `src/catalog/resolve.ts` | 解析 definitionId，驗證 definition、端子／電氣引用、placement、父子關係與循環 |
| `src/layout.ts` | 盤面、線槽、DIN 軌及元件實例的位置 |
| `src/components.ts` | 組合 definition、placement、behavior、visual builder 與 view 的唯一工廠 |
| `src/views/catalog-terminals.ts` | Catalog 端子與舊 JS model builder 的 migration boundary |
| `src/views/models.js`、`src/models/mc1.js` | 沿用已核對的 3D 幾何建立器 |
| `src/core/component.ts` | ComponentInstance：獨立狀態、操作入口、view 呼叫與序列化 |
| `src/core/behaviors.ts` | 純狀態轉換；不依賴 DOM／Three.js |
| `src/wiring/terminals.ts` | 由穩定端點 ID 解析世界位置、出線方向與夾線 anchors |
| `src/wiring/router.js` | 線槽選擇、局部逃逸、避障與線間距 |

## Category、Behavior 與 Visual Model

三者分離：

- `category`：產品是什麼，例如 `contactor`、`pushButton`、`lamp`。
- `behavior`：它如何改變 state，例如 `contactor`、`button`、`selector`。
- `visual.model`：要用哪個 3D builder，例如 `contactorSP`、`button`。

舊版 `ViewType` 是封閉 union；每增加一種外型都必須修改核心型別。Phase 1 改為 `visual.model` registry key，因此增加新的產品型號不需要擴充核心 product-type union。`ResolvedComponent.type` 暫時保留為 `visual.model` 的 compatibility projection，供尚未搬遷的 JS builder 使用。

例如：

```ts
{
  id: 'shihlin-sp16',
  category: 'contactor',
  behavior: 'contactor',
  visual: {model: 'contactorSP'},
  model: 'SHIHLIN S-P16',
  size: [115, 90, 143],
  // ...
}
```

## Catalog Terminal

Catalog terminal 的 canonical 欄位為：

```ts
{
  id: 'A1',
  position: [22, 20, -61],
  exitDirection: [0, 0, -1],
  role: 'coil'
}
```

目前已先搬遷：

- S-P16 的 16 個端子。
- PB 的 NO + NC 四端子拓撲。
- Selector 的兩組四端子拓撲。
- Emergency Stop 的 NC 雙端子。
- Lamp／Buzzer 的雙端子位置。

其他既有元件仍由已驗證的 model builder 建立端子。`catalog-terminals.ts` 會把 legacy terminal 正規化為同一個 runtime shape，因此 wiring 與 inspector 不需要同時支援兩種資料格式。

`position` 與 `role` 是新 canonical 欄位。`localPosition` 與 `electricalRole` 在 Phase 1 暫時保留為 runtime compatibility alias，待舊呼叫端全部遷移後移除。

Catalog 已宣告端子時，3D builder 中既有端子的位置必須與 Catalog 一致；不一致會直接拋錯，避免兩套座標悄悄分岔。PB／Selector 新增的第三、第四端子仍由 view migration layer 建立，並保留 WIRE-R3 geometry baseline 的 extension 標記。

## Electrical Definition

Phase 1 只建立資料契約，不執行通電求解。

目前可描述：

```ts
electrical: {
  coil: {terminals: ['A1', 'A2']},
  contacts: [
    {type: 'NO', terminals: ['1L1', '2T1'], controlledBy: 'coil'}
  ]
}
```

已登錄的資料包括：

- S-P16：A1/A2 coil 與三組主接點。
- PB：一組 NO + 一組 NC。
- Emergency Stop：一組 NC。

尚未充分確認的側翼端子與 Selector 內部導通邏輯不會猜測補上。Electrical Simulation 後續只應讀取 Catalog electrical definition + component state，不應依賴品牌、型號字串或 Three.js mesh。

## Definition 驗證

`getDefinition()` 會驗證：

- category / behavior / visual.model 是否存在。
- size 是否為有限向量。
- authored terminal ID 是否唯一。
- terminal position / exitDirection 是否有效。
- electrical coil / contact 是否引用存在的 terminal。
- terminal block 的 count / pitch 是否有效。

`resolvePlacement()` 只接受 instance placement 欄位，不允許呼叫端透過 placement 覆寫 definition 的 behavior、外觀或產品資料。

## 新增型號

若新型號沿用既有 visual builder 與 behavior，通常只需增加 definition 與 placement：

```ts
{
  id: 'mitsubishi-st20',
  category: 'contactor',
  behavior: 'contactor',
  manufacturer: 'Mitsubishi',
  model: 'S-T20',
  visual: {model: 'mitsubishi-st-series'},
  size: [80, 100, 110],
  terminals: [...],
  electrical: {...},
  hint: '...'
}
```

```ts
{
  id: 'MC4',
  definitionId: 'mitsubishi-st20',
  x: 500,
  z: 350,
  rotation: -90
}
```

如果外觀已存在，只需重用 `visual.model`。只有真正出現新的 3D 外觀時才需要在 view/model registry 新增 builder；不需要再修改核心 ViewType union。只有出現既有 behavior 無法表達的新機構／狀態時，才需要新增 behavior。

## 操作與 Runtime

1. UI 或 mesh interaction 解析成 action。
2. `ComponentInstance.dispatch()` 由 behavior 驗證 action。
3. behavior 產生新的 immutable state。
4. view 依 state 更新可動件。
5. wiring 需要路由姿態時呼叫 `syncRoutingPose()`。

MomentaryOperations 仍統一管理按鈕、接觸器與蜂鳴器的暫態操作。AP1 的機械連動仍由 parent `pressed` state 傳入 view，不由 Catalog electrical solver 驅動；這是後續 simulation phase 才會調整的邊界。

## Wiring 邊界

Wiring 不應知道品牌或產品型號，只使用：

```text
Component ID + Terminal ID
Position + Exit Direction
```

例如：`MC1:A1`。

端子位置與出線方向皆為 component-local，操作板翻轉或元件旋轉由矩陣轉換成 world coordinates。`escapePath` 仍為預留欄位，router 目前不讀取。

## 型別與驗證

TypeScript 維持 strict / allowJs / noEmit。既有幾何與 routing JS 是刻意保留的 incremental migration boundary。

- `npm run typecheck`：核心型別與負向型別案例。
- `npm test`：既有 geometry／MC1／wiring／component／operation-panel regression，加上 Catalog regression。
- `npm run offline`：產生 standalone HTML。
- `npm run build`：執行 typecheck、offline build 與 Vite build。

幾何基準仍是既有 `qa/fixtures/model-baseline.json`。不得因架構搬遷而更新 baseline 來掩蓋 geometry regression。

## WIRE-R3：操作板姿勢與配線交易

`WiringController.movePanel()` 接收新姿勢與還原函式，套用姿勢後先檢查固定線的淨空；只重算連到操作板或受到遮擋的路徑。新線材全部建好才一次替換，保留 ID、端點、選取與線序。失敗時釋放暫存 mesh 並還原姿勢，不建立穿模替代線。

操作板以 `userData.operationPanel` 標記，閉合時 router 優先從端子壓片邊緣沿後方出口走出，再上升；所有段落仍通過既有實體與線間距檢查。頁面模式與未完成起點由配線 UI 管理；元件 selection 不再隱含改變操作板姿勢。
