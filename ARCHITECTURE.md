# 配線盤元件架構 · WIRE-R2

## WIRE-R17：群組規劃與雙姿勢交易

`wiring/planner.ts` 負責一個姿態的完整線組解。先按使用者線序重用仍符合目前 anchor、實體、線距、自交與操作板側界線的路徑；單線失敗時用碰撞記錄的 wire ID，將受限出口優先安排，再重算被移動的電線。候選佇列包含局部先後調整、替代出口／高度，以及以共用端子負載和穩定端點排序的後備規劃。搜尋最多 32 組並受同一姿態的時間與取消檢查限制。這是有界搜尋；沒有找到解不代表幾何上不可能。

`router.js` 的層高、線槽偏移改由兩端附近 88 scene-units 內的實際線段占用和候選變體決定。端子出口依候選輪換 anchors／側向出線；局部 A* 找到的出口可保留前段、重新驗證較高的垂直段。操作板側直連的橋接 A* 在接受完整候選前執行自交驗證，失敗會繼續搜索。`CollisionWorld` 保留造成碰撞的 wire ID；節點預算耗盡與候選空間耗盡分別記錄，不降低原有淨空。

`WiringController.connect()` 暫時計算目前與另一個工作姿態的解，還原顯示姿態後才一次提交 mesh、routes、sequence 和 selection；runtime 只在成功後追加電性接線順序。兩套解只作偏好快取，`movePanel()` 每次均重新驗證現在的實體與端子；新增障礙不會被快取忽略。刪線同步更新兩套快取，舊快照替換則清除快取。`lastPlan` 記錄姿態、嘗試、阻擋線及搜尋預算診斷，正常專案只保存配置與電性端點，除錯匯出另包含此診斷。

若所有候選端子 anchor 都被實體封住，預檢立即拒絕；改變其他電線順序無法排除此類障礙。規劃或 mesh 準備失敗均保留原線材、選取及操作板角度。驗證範圍是展開／收合兩個靜態工作姿態；本輪未建立柔性線材長度、鉸鏈彎曲或翻轉掃掠物理。

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

## WIRE-R9：快照匯入

`application/snapshot-validation.ts` 從 unknown JSON 驗證格式、版本、單位、固定配置、元件型號／端子、狀態與數值範圍、接線 ID／端點及視角，只取明示的可還原欄位。支援 WIRE-R8 與 WIRE-R9 的 schemaVersion 1；整盤及單獨檢視各自在相同頁面還原。

`application/board-import.ts` 先驗證全部輸入與外接連接，再同步暫設目標機構姿勢，用 `wiring/restore.ts` 核對已保存路徑的端子 anchor、實體淨空、線距、自交與操作板側限制。此暫態不跨 frame 或 await，結束後無論成功失敗都先還原原有狀態與動畫姿勢；全部檢查及 mesh 建立成功後才替換接線。整段不重新搜尋路線、不忽略失敗線、不清空後逐條新增。

SimulationController 的 prepareRestore 驗證完成才提供同步提交；匯入只還原外接線與電源選項，保持 off，清除舊求解結果與線圈記憶。瞬時 pressed 正規化為 false，持續控制狀態保留。盤面導線 group 及 sequence 一次替換，接線列的復原順序與單線選取同步還原；未完成起點、舊證據與最近嘗試不重播。檔案讀取期間原盤面仍可操作，真正套用時再次檢查是否仍未送電且沒有走線工作。

匯入不採用 JSON 中的元件模型程式或派生電性結果。接線路徑以目前版本的原始模型驗證，幾何基準及端子座標不變。原始 JSON 仍完整保留故障結果，供排查使用。

## WIRE-R10：指示燈亮滅對比

ThreeComponentView 在建立時即把四顆指示燈設為熄滅材質，原始線性色彩乘以 0.06，降低環境反射、透明塗層及金屬度並增加粗糙度。亮起時保持色彩比例、將最大線性色彩通道提高至 1，自發光強度為 3.2；紅、綠底色不再限制亮起時的強度。手動測試與電路輸出使用相同樣式入口，其他操作元件及金屬燈框不變。材質只改 uniform，clearcoat 在兩個狀態都大於零，避免切換 shader 功能旗標。場景建立時對四顆燈罩明確綁定環境貼圖，讓 Three 使用各自的 envMapIntensity；否則 r180 會改用全場景的 environmentIntensity，覆蓋單顆燈的設定。

快照包含新增的表面材質參數，匯入驗證暫設姿勢後也會完整還原這些參數。相容版本明示列為 WIRE-R8／R9／R10，修訂代號更新不會悄悄排除 R9。新增測試檢查四顆實際鏡片材質的暗色初始狀態、逐盞點亮與相鄰燈不受影響、紅燈供電後斷電，以及匯入失敗時原有亮燈表面不變。

## WIRE-R11：熄燈色彩辨識

使用者的實際畫面顯示 R10 熄滅紅／綠燈接近黑色。熄滅色改為保留原色比例、最大線性通道正規化後乘以 0.3，使原本較暗的型號也有可辨識的底色；自發光仍為零，亮燈材質及反射設定沿用 R10。元件幾何、端子、電性與全場景照明不變。匯入相容版本增加 R11，仍接受 R8～R10。

既有材質測試改為同時檢查熄滅色的可見範圍、原色相、單燈亮滅與鄰燈對比，避免只追求變暗而再次壓黑底色。亮燈材質亮度指標須超過自身熄滅的 12 倍、各顆未亮鄰燈的 3 倍；這是材質層檢查，並非螢幕像素或目視驗收。

## WIRE-R12：亮燈色彩保留

使用者畫面確認 R11 的亮燈呈粉白與近白綠色。R10 留下的亮燈基底最大線性通道 1 加上自發光 3.2，在 ACESFilmicToneMapping／exposure 1.25 下過度壓縮並降低飽和度。亮燈現在沿用 R11 的 0.3 燈罩基底，只加入 0.45 自發光；熄燈外觀、全景照明、幾何與電路行為不變。R8～R12 快照皆可匯入。

既有測試保留逐盞亮滅、鄰燈不受影響與供電斷電；移除迫使顏色過曝的跨色亮度倍率門檻，改為自身亮度增加及色彩保留。新增 CPU 色調映射回歸，依已安裝 Three r180 的 ACES 公式、場景 exposure 與三種中性漫反射樣本，檢查白色未逼近全白、黃紅綠仍有通道差異及飽和度；舊設定會失敗。這不包含完整 GPU 照明、陰影或鏡面反射，不能替代瀏覽器目視驗收。既有 WebGL 停用限制見 `docs/wire-r10-acceptance.md`。


## WIRE-R14：單一來源與相間控制供電

整合 R13 動態專案格式。正常頁改用 `project/simulation.ts`，不再使用有獨立 CONTROL／MAIN 勾選的歷史 controller。專案驗證依電性規格類型限制零／一個三相來源，拒絕 `parameters.enabled`／available；default 與 A04 顯式使用 AC220 教學來源。完整供電拓樸與器件狀態是唯一輸入，QF1 OFF 不全域 disable 來源。

`ThreePhaseSource.lineToLine` 是可選的相對宣告。`electrical/line-to-line.ts` 驗證；`power.twoTerminalSupplies()` 建立一般負載匹配候選，沿用原來源 ID。候選不是 Source、不能進入導通 union 或馬達三相索引。`solver` 先檢查原始來源的短路／混源，再匹配相對與 profile；來源證據由該輪結果輸出。未宣告能力不自動允許相間負載。

`project/legacy.ts` 拒絕仍接 CONTROL 的舊檔，保留原檔／原 runtime；只有無引用的自動 CONTROL 可在轉換副本移除並回報 conversionNotes。舊 generic MAIN 不升級能力，舊 main=false 無法映射為 QF1 時拒絕。正常新格式不保存來源可用勾選。

全部先通過原生路由與操作板姿態驗證，才交易式替換。`examples/a04-motor-start.project.json` 有28條盤內線、6條外接線，QF1初始OFF。歷史 `application/simulation.ts`、舊快照與單元件入口仍供舊核心回歸／除錯，不是正常頁的雙供電模式。完整驗收與環境限制見 `docs/a04-single-source-acceptance.md`。


## WIRE-R15：課堂接點校正

`electrical/catalog.ts` 的既有 S-P16 課堂資產納入左右 APS-11 各一組 NO／NC，以同一實例的 coil 驅動；側端子保留既有 ID 及幾何座標，仍歸於幾何用的 side group。兩側、上下接點各自獨立，不添加固定短接。AP1 上裝模組的 parent-coil 行為不變。

按鈕的電性配對改為 NO 2/3、NC 1/4，`components.ts` 同步顯示 ID 與功能；模型不依 PB3／PB5 名稱或帽色判斷接點。內建教學接線的舊 PB 1/3 端點校正，但匯入器不做推測性遷移，保留使用者既有物理端點。使用者課堂案例的原始 22 條線另存固定 fixture，測試包含視野歸正投影、接點真值、隔離、自保、停止優先、過載及實際匯入控制器。

`examples/board-024-classroom.project.json` 在原始控制線後追加三條明示進線，QF1 初始 OFF；沒有自動接電、馬達捷徑或辨識答案的特殊分支。仍以原生路由重建並驗證操作板收合。


## WIRE-R16：設備固定進線

`configuration.fixedConnections` 明示設備預接線，與可編輯的 `connections` 分開保存。`fixedProjectWires()` 合併預接線及原有組裝銅片給 runtime；MC→TH 幾何仍只使用 `fixedAssemblyWires()`。預設盤、空盤範例及兩個課堂範例均配置 MAIN→QF1 三條固定進線，仍只有一個來源。固定線不進使用者配線順序、刪除或復原；QF 接點照常隔離下游。

`readProject()` 在正常驗證成功後，才對缺新欄位且結構完整吻合 stock BOARD 024 的舊專案呼叫 `upgradeClassroomInlet()`。比對不看名稱、狀態、參數及清單順序；補上固定進線時只移除相同的舊手動進線，保留其他端點及錯線並回報說明。新版重複接線仍拒絕，自訂盤與明示空固定清單不遷移；通用驗證與求解本身不推導供電。
