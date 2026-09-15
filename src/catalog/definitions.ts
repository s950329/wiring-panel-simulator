import type {ComponentDefinition} from '../core/contracts.ts';

/** Reusable model specifications. IDs here identify products/variants, not panel instances. */
const definitions: Record<string, ComponentDefinition> = {
  "shihlin-t20": {
    "id": "shihlin-t20",
    "viewType": "breaker",
    "behavior": "breaker",
    "name": "三極電源斷路器",
    "model": "T20 · 儀表用電源",
    "photo": "IMG_2689",
    "size": [
      98,
      112,
      112
    ],
    "hint": "從正面看，往前推為 ON，往後扳為 OFF。點選三連動橫桿切換，三極同步動作。"
  },
  "twin-fuse-holder": {
    "id": "twin-fuse-holder",
    "viewType": "fuse",
    "behavior": "fuse",
    "name": "雙保險絲座",
    "model": "可掀式透明保護蓋",
    "photo": "IMG_2688",
    "size": [
      43,
      35,
      72
    ],
    "hint": "點選透明保護蓋，示範掀開與閉合。"
  },
  "shihlin-sp16": {
    "id": "shihlin-sp16",
    "viewType": "contactorSP",
    "behavior": "contactor",
    "name": "電磁接觸器",
    "model": "SHIHLIN S-P16",
    "photo": "IMG_2690",
    "size": [
      115,
      90,
      143
    ],
    "hint": "本盤 S-P16 左右各裝一組 APS-11：同側下方前後兩端為常開，上方前後兩端為常閉，隨線圈吸合切換。A1／A2 是線圈端子；TA／TB／TC 請選取 TH1 查看。"
  },
  "shihlin-ap22": {
    "id": "shihlin-ap22",
    "viewType": "auxiliary",
    "behavior": "auxiliary",
    "name": "輔助接點組",
    "model": "SHIHLIN AP-22 · 2NO + 2NC",
    "photo": "IMG_2687",
    "size": [
      78,
      49,
      70
    ],
    "hint": "獨立安裝於 S-P16 上方的 2NO + 2NC 輔助接點；隨接觸器機械動作聯動。"
  },
  "shihlin-th20": {
    "id": "shihlin-th20",
    "viewType": "overload",
    "behavior": "overload",
    "name": "熱過載繼電器",
    "model": "SHIHLIN TH20",
    "photo": "IMG_2687",
    "size": [
      101,
      71,
      77
    ],
    "hint": "TC 在上方，TA／TB 在下方。TEST／RESET 操作語義為模擬設定；照片未能確認白色操作桿的完整標示。"
  },
  "omron-p2cf11": {
    "id": "omron-p2cf11",
    "viewType": "socket",
    "behavior": "socket",
    "name": "11 腳繼電器插座",
    "model": "OMRON P2CF-11",
    "photo": "IMG_2687",
    "size": [
      68,
      32,
      79
    ],
    "hint": "照片是 11 腳空底座。點選端子查看其識別碼。"
  },
  "shihlin-sc21l": {
    "id": "shihlin-sc21l",
    "viewType": "contactorSC",
    "behavior": "contactor",
    "name": "電磁接觸器",
    "model": "SHIHLIN S-C21L（型號待核）",
    "photo": "IMG_2687",
    "size": [
      86,
      106,
      113
    ],
    "hint": "按住銘牌中央黑色可動件，放開即復位。此動作不代表線圈通電。"
  },
  "cn18": {
    "id": "cn18",
    "viewType": "contactorCN",
    "behavior": "contactor",
    "name": "電磁接觸器",
    "model": "CN-18",
    "photo": "IMG_2690",
    "size": [
      80,
      106,
      101
    ],
    "hint": "按住灰色框內的黑色機構，放開即復位。"
  },
  "terminal-strip-46": {
    "id": "terminal-strip-46",
    "viewType": "terminalStrip",
    "behavior": "terminalStrip",
    "name": "主端子台",
    "model": "46 組・雙螺絲",
    "count": 46,
    "pitch": 14.7,
    "photo": "IMG_2686",
    "size": [
      692,
      29,
      56
    ],
    "hint": "每格兩個螺絲分別為 A、B。識別碼為模型編號，可供後續配線引用。"
  },
  "terminal-strip-13": {
    "id": "terminal-strip-13",
    "viewType": "terminalStrip",
    "behavior": "terminalStrip",
    "name": "輔助端子台",
    "model": "13 組・雙螺絲",
    "count": 13,
    "pitch": 15.2,
    "photo": "IMG_2690",
    "size": [
      216,
      29,
      56
    ],
    "hint": "每格兩個螺絲分別為 A、B。識別碼為模型編號，可供後續配線引用。"
  },
  "koino-buzzer": {
    "id": "koino-buzzer",
    "viewType": "buzzer",
    "behavior": "buzzer",
    "name": "蜂鳴器",
    "color": 1656925,
    "model": "Koino",
    "photo": "IMG_2686",
    "size": [
      38,
      45,
      38
    ],
    "hint": "蜂鳴器不具按壓機構。按住下方按鍵進行發聲測試。"
  },
  "emergency-red": {
    "id": "emergency-red",
    "viewType": "emergency",
    "behavior": "emergency",
    "name": "緊急停止",
    "color": 14824544,
    "model": "按下鎖定・旋轉復歸",
    "photo": "IMG_2686",
    "size": [
      38,
      45,
      38
    ],
    "hint": "按下蘑菇頭保持鎖定；向右拖曳旋轉解鎖，或按「旋轉復歸」。"
  },
  "selector-three-position": {
    "id": "selector-three-position",
    "viewType": "selector",
    "behavior": "selector",
    "name": "手動／自動選擇開關",
    "color": 1448218,
    "model": "三段定位（示範設定）",
    "photo": "IMG_2686",
    "size": [
      38,
      45,
      38
    ],
    "hint": "左右拖曳旋鈕，或點選檔位。手動／停止／自動為模擬設定。"
  },
  "button-yellow": {
    "id": "button-yellow",
    "viewType": "button",
    "behavior": "button",
    "name": "黃色按鈕",
    "color": 15839232,
    "photo": "IMG_2686",
    "model": "圓形操作元件",
    "size": [
      38,
      45,
      38
    ],
    "hint": "按住按鈕，放開回彈。端子 2／3 為常開：按下導通；端子 1／4 為常閉：按下斷開。"
  },
  "button-teal": {
    "id": "button-teal",
    "viewType": "button",
    "behavior": "button",
    "name": "藍綠色按鈕",
    "color": 2255734,
    "photo": "IMG_2686",
    "model": "圓形操作元件",
    "size": [
      38,
      45,
      38
    ],
    "hint": "按住按鈕，放開回彈。端子 2／3 為常開：按下導通；端子 1／4 為常閉：按下斷開。"
  },
  "button-green": {
    "id": "button-green",
    "viewType": "button",
    "behavior": "button",
    "name": "綠色按鈕",
    "color": 3634781,
    "photo": "IMG_2686",
    "model": "圓形操作元件",
    "size": [
      38,
      45,
      38
    ],
    "hint": "按住按鈕，放開回彈。端子 2／3 為常開：按下導通；端子 1／4 為常閉：按下斷開。"
  },
  "button-red-sticker": {
    "id": "button-red-sticker",
    "viewType": "button",
    "behavior": "button",
    "name": "紅色按鈕（貼紙）",
    "color": 9654101,
    "sticker": true,
    "photo": "IMG_2686",
    "model": "圓形操作元件",
    "size": [
      38,
      45,
      38
    ],
    "hint": "按住按鈕，放開回彈。端子 2／3 為常開：按下導通；端子 1／4 為常閉：按下斷開。"
  },
  "button-red": {
    "id": "button-red",
    "viewType": "button",
    "behavior": "button",
    "name": "紅色按鈕",
    "color": 13329768,
    "photo": "IMG_2686",
    "model": "圓形操作元件",
    "size": [
      38,
      45,
      38
    ],
    "hint": "按住按鈕，放開回彈。端子 2／3 為常開：按下導通；端子 1／4 為常閉：按下斷開。"
  },
  "lamp-white": {
    "id": "lamp-white",
    "viewType": "lamp",
    "behavior": "lamp",
    "name": "白色指示燈",
    "color": 14213370,
    "photo": "IMG_2686",
    "model": "圓形操作元件",
    "size": [
      38,
      45,
      38
    ],
    "hint": "指示燈不具按壓機構。下方按鍵只做獨立亮燈測試。"
  },
  "lamp-yellow": {
    "id": "lamp-yellow",
    "viewType": "lamp",
    "behavior": "lamp",
    "name": "黃色指示燈",
    "color": 15578880,
    "photo": "IMG_2686",
    "model": "圓形操作元件",
    "size": [
      38,
      45,
      38
    ],
    "hint": "指示燈不具按壓機構。下方按鍵只做獨立亮燈測試。"
  },
  "lamp-red": {
    "id": "lamp-red",
    "viewType": "lamp",
    "behavior": "lamp",
    "name": "紅色指示燈",
    "color": 9443388,
    "photo": "IMG_2686",
    "model": "圓形操作元件",
    "size": [
      38,
      45,
      38
    ],
    "hint": "指示燈不具按壓機構。下方按鍵只做獨立亮燈測試。"
  },
  "lamp-green": {
    "id": "lamp-green",
    "viewType": "lamp",
    "behavior": "lamp",
    "name": "綠色指示燈",
    "color": 554567,
    "photo": "IMG_2686",
    "model": "圓形操作元件",
    "size": [
      38,
      45,
      38
    ],
    "hint": "指示燈不具按壓機構。下方按鍵只做獨立亮燈測試。"
  }
};
for (const definition of Object.values(definitions)) {
  Object.freeze(definition.size);
  Object.freeze(definition);
}
export const componentDefinitions: Readonly<Record<string, ComponentDefinition>> = Object.freeze(definitions);
