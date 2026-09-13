# 電性資料與教學配置

核對日期：2026-09-13。實作範圍：Phase 0–4；WIRE-R7 已接入送電操作及原因追查。最終瀏覽器驗收另見測試記錄，不能由 Node 測試替代。

## teaching-control-v1

這是明示假設的離散教學 profile。`energized` 只表示負載兩端取得同一相符來源的兩個不同電位，不代表已確認實物額定電壓、功率或保護性能。程式每次判定有供電時回報 `RATING_UNVERIFIED`。本次沒有確認實物線圈、燈與蜂鳴器的完整額定標記。

`createTeachingComponent()` 必須由呼叫端明確選用。每個支援模型的 provenance 均指向本文件並保守標成 `teaching-assumption`；下表另外区分可查證的原廠資料、既有照片辨識紀錄與本次教學設定。這些資料沒有自動覆蓋既有幾何 `electricalRole`。

## 端子與接點對照

所有左欄為既有穩定 ID；沒有從顯示文字、Mesh 接觸或路由座標推導導通。

| 實例／型號 | 穩定端子與本 profile 的關係 | 依據與限制 |
|---|---|---|
| MC1／S-P16 | `1L1–2T1`、`3L2–4T2`、`5L3–6T3` 隨明確 coil snapshot 閉合；`A1–A2` 為線圈負載 | [原廠 S-P16 圖面](https://global.seec.com.tw/Templates/att/S-P16_P21_P25_E.pdf?lng=en)支持三主極與 A1/A2；現有照片中 A1/A2 辨識紀錄在 `src/models/mc1.js`。實物版本、額定值未確認，程式仍為教學模型。 |
| MC1 側翼 | `L-B-U/L-B-L/L-F-U/L-F-L/R-B-U/R-B-L/R-F-U/R-F-L` 均未支援 | 原廠圖面有 13–14 NO、21–22 NC，但不能據此把現有八個位置 ID 對上四個原廠編號。上下螺絲是否同點不猜測；任何一端被接入電路即 `MISSING_MODEL`。 |
| AP1／AP-22 | `53–54`、`83–84` NO；`61–62`、`71–72` NC；由明確 `parentId=MC1` 的 coil snapshot 驅動 | [原廠 AP-4P 型錄頁](https://global.seec.com.tw/en/product/4603.html)確認 AP-22 為 2NO+2NC。各編號與排列沿用既有標示，仍屬教學假設；尚未取得對應實物的端子圖或導通量測。 |
| TH1／資產標示 TH20 | 三路 `1/L1–2/T1`、`3/L2–4/T2`、`5/L3–6/T3` 固定導通；教學設定 `TC–TB` 常閉，`TC–TA` 常開，`tripped` 使兩者交換 | TC/TA/TB 是使用者照片辨識紀錄（`src/views/models.js`），電性對應未確認。現行 [TH-P20 原廠頁](https://global.seec.com.tw/en/product/4402.html)及[型錄](https://global.seec.com.tw/Templates/att/MS-P.pdf?lng=en)描述 1NO+1NC／95–96、97–98，不足以證實舊資產的三端共點關係。此處**僅為教學 SPDT 假設，不是實物 TH20 規格**；不更改已確認的三個端子 ID。 |
| PB1–PB5 | `1–2` NO（顯示 13–14）；`3–4` NC（顯示 21–22） | 依既有模型端子／顯示對照，明示教學假設。`pressed=false` 時 NO 斷、NC 通；true 相反。 |
| ES1 | `1–2` NC（顯示 21–22）；`latched=true` 斷開 | 教學假設，急停復歸只使這個接點閉合。 |
| SA1 | 位置 0：`1–2` 通；位置 1：全斷；位置 2：`3–4` 通 | 教學真值表，位置 1 為預設停止。既有 UI 的演示狀態不會自動輸入核心。 |
| QF1／T20 | `L1–T1`、`L2–T2`、`L3–T3` 隨 `on` 同步；初始 false | 教學三極開關，沒有隱含電源或自動保護曲線。 |
| FU1 | `F1-IN–F1-OUT` 由 `f1Intact`；`F2-IN–F2-OUT` 由 `f2Intact`；初始均 true | 教學理想保險絲；保護蓋 open 不在電性輸入中，不能改變導通。沒有熔斷電流／時間計算。 |
| TB1／46 格；TB2／13 格 | 每格 `nA–nB` 固定橋接，格與格隔離 | 明示教學端子台假設；不是由兩個螺絲的幾何位置判斷。 |
| HL1–HL4／BZ1 | `1–2` 分別為燈／蜂鳴器負載 | 教學 profile，額定值未確認；負載不合併兩個 net，不讀取手動亮燈／發聲測試。 |
| SO1／P2CF-11 | `1…11` 各自隔離 | [OMRON P2CF 官方頁](https://industrial.omron.eu/en/products/p2cf)確認為插座系列；資產為空插座，不加入不存在的插入式繼電器。 |
| MC2／S-C21L 待核；MC3／CN-18 | 所有現有端子可供識別，但無電性模型 | 未納入首個練習。未接線不妨礙其他電路；接入即 `MISSING_MODEL`。 |

MC1、AP1、TH1 的機械附掛不產生跨元件電線或原廠固定橋接。未核實的實物連接須後續補明確資料，不能用外觀接觸代替。

## 首個可執行配置

外部 `SUPPLY` 使用 `teaching-source` 的 `L/N` 端子；來源 `CONTROL` 明確指定兩端、enabled 與 `teaching-control-v1`。L/N 是本練習的教學名称；核心也容許任意兩端名稱及反向接線，沒有把 A2 寫死為中性線。

| 電線 ID | 起點 | 終點 |
|---|---|---|
| feed | SUPPLY.L | PB1.1 |
| start | PB1.2 | MC1.A1 |
| return | MC1.A2 | SUPPLY.N |

按鈕放開時線圈開路；輸入 `{inputs: {PB1: {pressed: true}}}` 時線圈得到邏輯供電。這不是自保持練習；`evaluateCircuit()` 的單輪結果不自動寫回接點。Phase 2 的 `settleCircuit()`／`ElectricalSimulator` 以明確的上一輪 coil snapshot 進行同步迭代。

Phase 2 已支援 `teaching-motor` 的外部 `U/V/W` 端子及 `teaching-three-phase-source` 的 `L1/L2/L3`，使用 `teaching-three-phase-v1` profile。三相是同一來源的三個不同相別，不是三個各自衝突的二端來源。Phase 3 已將電源與馬達做成右側外接端子卡片，不新增盤內 3D 幾何。

```ts
import {minimalControlCircuit} from '../src/electrical/catalog.ts';
import {evaluateCircuit} from '../src/electrical/solver.ts';

const circuit = minimalControlCircuit();
const evaluation = evaluateCircuit(circuit, {inputs: {PB1: {pressed: true}}});
// MC1/coil: energized, reason=supply；另有 RATING_UNVERIFIED。
```

## 計算與診斷邊界

- `buildNetlist()` 合併 wire、固定橋接與閉合接點，保留帶 ID 的導通邊與端點；負載不參與合併。net ID 與輸出均排序，使合法輸入的順序與反向電線不影響結果。
- `evaluateCircuit()` 單輪計算；不依賴 Three.js、DOM、座標、route points、蓋子或演示狀態。所有輸入保持不變。
- 回路完整：`energized/supply`；同 net：`unpowered/same-potential`；開路：`unpowered/open`；無啟用來源：`unpowered/source-off`。
- 不同來源共用任何理想導通 rail：`SOURCE_CONFLICT`；同來源兩端被理想導通短接：`SOURCE_SHORT`。本輪採整體 fault，沒有模擬 QF/FU 實際跳脫。
- 多個獨立來源經負載形成閉合回路：`UNSUPPORTED_SOURCE_NETWORK`／unknown；沒有回路的單支連線仍為 open。只在這項診斷的路徑搜尋中把來源視為邊，不把電源兩端合併成導線。
- 負載必須直接跨同一來源的兩個 net，且 profile 相符。串聯負載電壓分配不求解，回報 `UNSUPPORTED_SERIES`。用圖的雙連通區塊找出來源兩端之間的負載路徑，懸空支路維持 open，不誤判成串聯。
- 未知端點、重複 ID、錯誤定義／輸入、接入的缺漏模型令本輪 unknown，負載不回報成功。未接線的未知模型可留在盤面。預設先做全電路有效性檢查，尚無局部故障隔離。
- 沒有類比數值、時間、熱、電流、保護協調、任意多來源合成或實物額定安全驗證。

## Phase 2：穩態與事件邊界

`settleCircuit(circuit, inputs, previousCoils?, {maxIterations?})` 是無副作用的純函式；預設最多 32 輪，設定值必須是正的安全整數。所有線圈在同一輪求解後一起更新。狀態不變才回傳 `status: 'stable'`，其中 evaluation 的接點與 coils 必須一致。重複狀態向量回報 `OSCILLATION`，達上限回報 `ITERATION_LIMIT`；其他 fault／unknown 同樣回傳 `status: 'halted'`，`evaluation` 與 `coils` 為 null，不發布最後一輪當作答案。

`ElectricalSimulator.step(circuit, inputs)` 保留上一個已確認的穩態。每次傳入**完整操作快照**，不是增量事件；省略欄位使用 catalog 的預設值。回傳物件與 session 內部記憶隔離，呼叫端不能透過改結果覆蓋保持狀態。

遇到 halted 會清除線圈記憶並鎖定停止結果，直到 `reset()`。reset 是模擬停止／重新開始邊界，不會改使用者的急停、過載狀態或接線；下一次 step 仍須帶入它們。控制斷电必須作為一次 step 傳入，不能省略該事件後期待求解器知道曾經斷電。

```ts
import {directOnLineCircuit} from '../src/electrical/exercises.ts';
import {ElectricalSimulator} from '../src/electrical/simulator.ts';

const circuit = directOnLineCircuit();
const simulator = new ElectricalSimulator();
simulator.step(circuit, {QF1: {on: true}}); // 等待啟動
simulator.step(circuit, {QF1: {on: true}, PB3: {pressed: true}}); // 吸合
const held = simulator.step(circuit, {QF1: {on: true}}); // 放開 PB3，AP1 保持
// held.coils.MC1 === true；held.evaluation.motors[0].state === 'powered'
simulator.step(circuit, {QF1: {on: true}, PB5: {pressed: true}}); // 停止
```

馬達的 `powered` 只表示 U/V/W 分別直接接到同一相符來源的三個不同相別。輸出 `phaseOrder` 是來源相別索引，不推算實際旋轉方向、速度或轉矩；仍回報 `RATING_UNVERIFIED`。兩相互換保留供電成立並記錄相序變更。

| 主電路情境 | 馬達結果 | 模擬處理 |
|---|---|---|
| 三相完整、同來源且 profile 相符 | powered / supply | 可形成穩態 |
| 全未接或主電源關閉 | unpowered / open 或 source-off | 控制電路獨立計算 |
| 只接到一／兩個相別 | unpowered / missing-phase | `MOTOR_MISSING_PHASE` 警告，不冒稱運轉 |
| 兩個馬達端子接到同一相別 | unpowered / duplicate-phase | `MOTOR_DUPLICATE_PHASE` 警告 |
| 不同來源混接、供電種類／profile 不符 | unknown | 停止並要求修正／重設 |
| 須跨越其他負載才能取得相別 | unknown / unsupported-series | 不把燈、線圈或其他馬達視為理想導線 |
| 不同相直接短接或不同來源共用導通 rail | fault | 整個模擬停止，沒有自動 QF／FU 跳脫模型 |

### 直接啟動教學配置

`directOnLineCircuit()` 是 12 個教學元件、23 條電線的普通 Circuit 資料，求解器不辨識它的名稱、ID 或標準接線。控制與主電源在本配置中是**兩個獨立教學來源**，沒有暗含變壓器或實物配電關係。QF1 僅切換主電源；FU1 的 F1 支路在控制回路，F2 留作未使用的完整支路。

| 線路／ID | 起點 | 終點 |
|---|---|---|
| control-feed | CONTROL.L | FU1.F1-IN |
| fused-feed | FU1.F1-OUT | ES1.1 |
| emergency-stop | ES1.2 | PB5.3（NC） |
| stop-overload | PB5.4（NC） | TH1.TC |
| overload-start | TH1.TB（教學 NC） | PB3.1（NO） |
| start-coil | PB3.2（NO） | MC1.A1 |
| coil-return | MC1.A2 | CONTROL.N |
| hold-in / hold-out | PB3.1 → AP1.53 | AP1.54 → PB3.2 |
| lamp-in / lamp-out | MC1.A1 → HL4.1 | MC1.A2 → HL4.2 |
| 主極 1 | MAIN.L1 → QF1.L1 → QF1.T1 → MC1.1L1 | MC1.2T1 → TH1.1/L1 → TH1.2/T1 → M1.U |
| 主極 2 | MAIN.L2 → QF1.L2 → QF1.T2 → MC1.3L2 | MC1.4T2 → TH1.3/L2 → TH1.4/T2 → M1.V |
| 主極 3 | MAIN.L3 → QF1.L3 → QF1.T3 → MC1.5L3 | MC1.6T3 → TH1.5/L3 → TH1.6/T3 → M1.W |

主極各有四條外部線（`main-n`、`breaker-n`、`contactor-n`、`motor-U/V/W`）；QF、MC、TH 內部關係由各 model 定義，不是額外跳線。TH 的 main paths 不會因 TEST 直接斷開；TEST 只交換其教學控制接點。因此繞過 TH 常閉接點會令保護停止失效，求解器不以全域命令掩蓋此錯接。

一般保持接法在**控制電源**中斷後釋放，恢復且未按啟動時不重啟。但若只有主電源中斷而控制電路仍保持，恢復主電源後會重新供電；若啟動一直被按住，恢復控制電源也可能再次吸合。這是此教學接線的結果，不是實物操作安全保證。

## 驗證與後續核對

`npm run test:electrical` 在 Node 執行純電性測試；`npm test` 另外包含現有模型端子集合與面板姿勢整合檢查，以及原有幾何／路由驗證。

後續實物核對：MC1 八側翼端子逐點導通、AP1 實際端子排列、TH1 TC/TA/TB 真值表、TB 同格橋接及負載額定銘牌。在此之前，以上 teaching profile 不升級為實物已確認規格。
## Phase 3 application integration

WIRE-R6 exposes teaching CONTROL L/N, MAIN L1/L2/L3 and M1 U/V/W as endpoint cards. L/N are labels of this explicitly independent teaching control supply, not an assertion that a physical coil must use neutral. E-numbered user links are visible in the wire list; physical W-numbered wires retain routing and collision checks.

For a supported SP16 parent and TH20 child, `application/equipment.ts` explicitly registers the displayed three assembly straps: 2T1 ↔ 1/L1, 4T2 ↔ 3/L2 and 6T3 ↔ 5/L3. This is an authored teaching assembly configuration, separately listed in the UI, not a mesh-derived connection or a change to the generic solver. The original Phase 2 fixture still declares its own wires explicitly.

The application maps actual button pressed, emergency latched, breaker on, selector position and overload trip inputs into the core. Manual contactor pressed, lamp test and buzzer test never become electrical inputs. `ElectricalOutput` drives the display separately; halted outputs are null and visibly suppressed. Stopping clears transient demonstrations and coil memory, preserving emergency latch, overload trip and all wires. Browser E2E acceptance is tracked after Phase 4.


## Phase 4：原因、證據與復原

`explainSimulation()` 只解釋求解器的結果，不重新判定電性。`traceEndpoint()` 回傳端子所在理想導通網路、已開啟的相連電源端及原始 wire ID；不穿過燈、線圈或馬達負載。高亮包含同網路分支，並不表示電流方向或唯一供電路徑。

未供電的線圈會區分控制來源未開啟、同電位和未形成完整回路；相鄰的開路接點是觀察證據，不被宣稱為唯一錯線原因。保持支路說明採條件提示。馬達供電、缺相及重複相別依自身端子結果顯示，不從 MC 吸合推論。未接線的燈／蜂鳴器不重複列出原因卡片。

應用層保留與結果同一輪的 `evaluatedCircuit`，即使短接後模式改為 halted 仍可追查當時接線。halted 沒有有效 evaluation，因此只顯示診斷端子與相關接線，不渲染中途導通網路。停止後清除舊結果，修改接線再重新送電；急停和 TH 仍須各自復歸。

定位按钮不會經過接線端點選取入口；多線證據與可刪除的單線選取分開，操作狀態更新後清除舊高亮。右側 DOL 手動練習對照見 [electrical-user-guide.md](electrical-user-guide.md)。
