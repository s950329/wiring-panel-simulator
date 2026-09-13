# 配線盤元件架構 · WIRE-R3 / Component Catalog Phase 1–4

本次重構以既有 WIRE-R3 畫面、端子座標與配線行為為回歸基準，將元件型號、端子與已確認電氣語意整理成可擴充的 Component Catalog。這一輪不新增電路通電求解，也不改變目前盤面的操作語義或 3D 幾何。

## 核心分層

```text
Component Definition (產品／型號)
        │
        ├── category        產品語意
        ├── behavior        操作／狀態行為
        ├── visual.model    3D builder registry key
        ├── terminals       canonical 端子規格
        └── electrical      已確認內部電氣關係
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

`shihlin-sp16` 是產品 definition；`MC1` 是盤面上的 instance。相同 definition 可以建立多個獨立 instance，各自持有自己的 root、parts 與 state。

## 模組責任

| 模組 | 責任 |
|---|---|
| `src/core/contracts.ts` | category、visual、terminal、electrical、state、behavior、view 契組 |
| `src/catalog/definitions.ts` | 聚合各分類 definition、檢查重複 ID 並 deep-freeze |
| `src/catalog/definitions/*.ts` | contactor、protection、control、indicator、relay、terminal-block 等產品資料 |
| `src/catalog/resolve.ts` | 驗證 definition、端子／電氣引用、placement 與父子關係 |
| `src/layout.ts` | 盤面元件實例的位置；不持有產品端子資料 |
| `src/components.ts` | 組合 definition、placement、behavior、visual builder 與 view |
| `src/views/catalog-terminals.ts` | Catalog topology 與既有 JS geometry builder 的一致性邊界 |
| `src/views/models.js`、`src/models/mc1.js` | 既有已核對 3D 幾何建立器；不再是端子規格的資料來源 |
| `src/wiring/terminals.ts` | 依 Component ID + Terminal ID 解析世界位置與出線方向 |
| `src/wiring/router.js` | 線槽選擇、局部逃逸、避障與線間距 |

## Category、Behavior、Visual Model

三者分離：

- `category`：產品是什麼，例如 `contactor`、`pushButton`、`lamp`。
- `behavior`：元件如何改變 state，例如 `contactor`、`button`、`selector`。
- `visual.model`：使用哪個 3D builder，例如 `contactorSP`、`button`。

新增新產品型號不再需要擴充封閉的 `ViewType` union。只有真的增加全新 3D 外觀時才需要增加 visual builder；只有既有 behavior 無法表達新的機構／狀態時才新增 behavior。

## Catalog Definition 分類

目前定義拆分為：

```text
src/catalog/definitions/
├── contactors.ts
├── protection.ts
├── controls.ts
├── indicators.ts
├── relay.ts
├── terminal-blocks.ts
└── shared.ts
```

`definitions.ts` 是唯一聚合入口；分類檔不得重複產品 ID，且 map key 必須等於 definition.id。

## Terminal Contract

所有目前 22 種產品都必須在 Catalog 宣告端子拓撲。Canonical terminal 只使用：

```ts
{
  id: 'A1',
  position: [22, 20, -61],
  exitDirection: [0, 0, -1],
  role: 'coil'
}
```

`localPosition` 與 `electricalRole` 相容 alias 已移除。Runtime、Wiring 與測試使用同一個 `position / exitDirection / role` contract。

目前已資料化的範圍包含：

- T20 breaker、雙保險絲座。
- S-P16、AP-22、S-C21L、CN-18。
- TH20（TA/TB/TC 電氣角色仍標示 `unverified`）。
- OMRON P2CF-11 11-pin socket。
- 46 組與 13 組 terminal strip。
- PB、Selector、Emergency Stop、Lamp、Buzzer。

3D builder 仍負責建立螺絲與外殼等幾何；`catalog-terminals.ts` 會逐一比對 builder 產生的 terminal center 與 Catalog `position`。不一致直接失敗，避免存在兩套默默分岔的端子座標。PB／Selector 在 WIRE-R3 新增的第三、第四端子仍由這個 view boundary 產生，並維持 geometry baseline extension 標記。

## Electrical Definition

Electrical Definition 只保存已確認的內部關係，尚未進行通電求解。例如：

```ts
electrical: {
  coil: {terminals: ['A1', 'A2']},
  contacts: [
    {type: 'NO', terminals: ['1L1', '2T1'], controlledBy: 'coil'}
  ]
}
```

目前已登錄 S-P16、AP-22、S-C21L、CN-18、PB 與 Emergency Stop 等已確認資料。TH20 的 TA/TB/TC 目前只確認幾何與標示，因此不建立推測性的 Electrical Definition。

後續 Electrical Simulation 只能依賴：

```text
Connection Graph + Component State + Electrical Definition
```

不得依賴品牌名稱、型號字串或 Three.js mesh。

## Definition 驗證

`getDefinition()` 會驗證：

- category / behavior / visual.model。
- size 必須為有限向量。
- 每個產品必須有至少一個 Catalog terminal。
- terminal ID 唯一、position / exitDirection 有效。
- electrical coil / contact 只能引用存在的 terminal。
- terminal block 的 count / pitch 有效。

`resolvePlacement()` 只接受 instance placement 欄位，不允許透過 placement 覆寫 definition 的 behavior、外觀或產品資料。

## 新增型號

如果新型號沿用既有 visual builder 與 behavior，通常只需增加 definition 與 placement：

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

## Wiring 邊界

Wiring 不知道品牌或產品型號，只使用：

```text
Component ID + Terminal ID
Position + Exit Direction
```

端子位置與出線方向皆為 component-local；操作板翻轉或元件旋轉由矩陣轉換成 world coordinates。`escapePath` 仍是預留欄位，目前 router 不讀取。

## 型別與驗證

TypeScript 維持 strict / allowJs / noEmit。既有幾何與 routing JS 是刻意保留的 incremental migration boundary。

- `npm run typecheck`：核心型別與負向型別案例。
- `npm test`：geometry／MC1／wiring／component／operation-panel + Catalog regression。
- `npm run offline`：產生 standalone HTML。
- `npm run build`：執行 typecheck、offline build 與 Vite build。

幾何基準仍是既有 `qa/fixtures/model-baseline.json`。不得因架構搬遷而更新 baseline 來掩蓋 geometry regression。

## WIRE-R3：操作板姿勢與配線交易

`WiringController.movePanel()` 接收新姿勢與還原函式，套用姿勢後先檢查固定線的淨空；只重算連到操作板或受到遮擋的路徑。新線材全部建好才一次替換，保留 ID、端點、選取與線序。失敗時釋放暫存 mesh 並還原姿勢，不建立穿模替代線。

操作板以 `userData.operationPanel` 標記，閉合時 router 優先從端子壓片邊緣沿後方出口走出，再上升；所有段落仍通過既有實體與線間距檢查。頁面模式與未完成起點由配線 UI 管理；元件 selection 不再隱含改變操作板姿勢。
