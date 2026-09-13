import type {
  CatalogTerminalDefinition, ComponentDefinition, TerminalRole, Vec3,
} from '../core/contracts.ts';

const terminal = (
  id: string,
  position: Vec3,
  role: TerminalRole = 'unverified',
  displayName?: string,
  group?: string,
  exitDirection: Vec3 = [0, 0, position[2] >= 0 ? 1 : -1],
): CatalogTerminalDefinition => ({
  id, position, exitDirection, role,
  ...(displayName === undefined ? {} : {displayName}),
  ...(group === undefined ? {} : {group}),
});

const pushButtonTerminals = (): CatalogTerminalDefinition[] => [
  terminal('1', [-9, -41, -6], 'contact', '13 · 常開 NO', 'NO'),
  terminal('2', [9, -41, 6], 'contact', '14 · 常開 NO', 'NO'),
  terminal('3', [-9, -41, 6], 'contact', '21 · 常閉 NC', 'NC'),
  terminal('4', [9, -41, -6], 'contact', '22 · 常閉 NC', 'NC'),
];
const selectorTerminals = (): CatalogTerminalDefinition[] => [
  terminal('1', [-9, -41, -6], 'contact', '13 · 接點 A', 'selector-A'),
  terminal('2', [9, -41, 6], 'contact', '14 · 接點 A', 'selector-A'),
  terminal('3', [-9, -41, 6], 'contact', '23 · 接點 B', 'selector-B'),
  terminal('4', [9, -41, -6], 'contact', '24 · 接點 B', 'selector-B'),
];
const twoFrontTerminals = (y = -41, role: TerminalRole = 'control'): CatalogTerminalDefinition[] => [
  terminal('1', [-9, y, -6], role),
  terminal('2', [9, y, 6], role),
];
const emergencyTerminals = (): CatalogTerminalDefinition[] => [
  terminal('1', [-9, -41, -6], 'contact', '21 · 常閉 NC', 'NC'),
  terminal('2', [9, -41, 6], 'contact', '22 · 常閉 NC', 'NC'),
];

const sp16Terminals: CatalogTerminalDefinition[] = [
  terminal('1L1', [-22, 70, -46], 'power', undefined, 'main'),
  terminal('3L2', [0, 70, -46], 'power', undefined, 'main'),
  terminal('5L3', [22, 70, -46], 'power', undefined, 'main'),
  terminal('2T1', [-22, 70, 46], 'power', undefined, 'main'),
  terminal('4T2', [0, 70, 46], 'power', undefined, 'main'),
  terminal('6T3', [22, 70, 46], 'power', undefined, 'main'),
  terminal('L-B-U', [-47, 80, -40], 'contact', '左後上', 'side'),
  terminal('L-B-L', [-47, 47, -40], 'contact', '左後下', 'side'),
  terminal('L-F-U', [-47, 80, 40], 'contact', '左前上', 'side'),
  terminal('L-F-L', [-47, 47, 40], 'contact', '左前下', 'side'),
  terminal('R-B-U', [47, 80, -40], 'contact', '右後上', 'side'),
  terminal('R-B-L', [47, 47, -40], 'contact', '右後下', 'side'),
  terminal('R-F-U', [47, 80, 40], 'contact', '右前上', 'side'),
  terminal('R-F-L', [47, 47, 40], 'contact', '右前下', 'side'),
  terminal('A1', [22, 20, -61], 'coil', 'A1', 'rear-lower'),
  terminal('A2', [0, 20, -61], 'coil', 'A2', 'rear-lower'),
];

/** Reusable model specifications. IDs here identify products/variants, not panel instances. */
const definitions: Record<string, ComponentDefinition> = {
  'shihlin-t20': {
    id: 'shihlin-t20', category: 'breaker', visual: {model: 'breaker'}, behavior: 'breaker',
    manufacturer: 'SHIHLIN', name: '三極電源斷路器', model: 'T20 · 儀表用電源', photo: 'IMG_2689',
    size: [98, 112, 112],
    hint: '從正面看，往前推為 ON，往後扳為 OFF。點選三連動橫桿切換，三極同步動作。',
  },
  'twin-fuse-holder': {
    id: 'twin-fuse-holder', category: 'fuse', visual: {model: 'fuse'}, behavior: 'fuse',
    name: '雙保險絲座', model: '可掀式透明保護蓋', photo: 'IMG_2688', size: [43, 35, 72],
    hint: '點選透明保護蓋，示範掀開與閉合。',
  },
  'shihlin-sp16': {
    id: 'shihlin-sp16', category: 'contactor', visual: {model: 'contactorSP'}, behavior: 'contactor',
    manufacturer: 'SHIHLIN', name: '電磁接觸器', model: 'SHIHLIN S-P16', photo: 'IMG_2690', size: [115, 90, 143],
    terminals: sp16Terminals,
    electrical: {
      coil: {terminals: ['A1', 'A2']},
      contacts: [
        {type: 'NO', terminals: ['1L1', '2T1'], controlledBy: 'coil'},
        {type: 'NO', terminals: ['3L2', '4T2'], controlledBy: 'coil'},
        {type: 'NO', terminals: ['5L3', '6T3'], controlledBy: 'coil'},
      ],
    },
    hint: '按住可動件示範機械壓合，放開即復位。本體共 16 個接線點：六個主端子、八個側翼端子，以及後側下排 A1／A2。位置標籤表示左／右、前／後、上／下，實物端子號待確認。下方 TA／TB／TC 可選取 TH1 查看。',
  },
  'shihlin-ap22': {
    id: 'shihlin-ap22', category: 'auxiliaryContact', visual: {model: 'auxiliary'}, behavior: 'auxiliary',
    manufacturer: 'SHIHLIN', name: '輔助接點組', model: 'SHIHLIN AP-22 · 2NO + 2NC', photo: 'IMG_2687', size: [78, 49, 70],
    hint: '獨立安裝於 S-P16 上方的 2NO + 2NC 輔助接點；隨接觸器機械動作聯動。',
  },
  'shihlin-th20': {
    id: 'shihlin-th20', category: 'overload', visual: {model: 'overload'}, behavior: 'overload',
    manufacturer: 'SHIHLIN', name: '熱過載繼電器', model: 'SHIHLIN TH20', photo: 'IMG_2687', size: [101, 71, 77],
    hint: 'TC 在上方，TA／TB 在下方。TEST／RESET 操作語義為模擬設定；照片未能確認白色操作桿的完整標示。',
  },
  'omron-p2cf11': {
    id: 'omron-p2cf11', category: 'socket', visual: {model: 'socket'}, behavior: 'socket',
    manufacturer: 'OMRON', name: '11 腳繼電器插座', model: 'OMRON P2CF-11', photo: 'IMG_2687', size: [68, 32, 79],
    hint: '照片是 11 腳空底座。點選端子查看其識別碼。',
  },
  'shihlin-sc21l': {
    id: 'shihlin-sc21l', category: 'contactor', visual: {model: 'contactorSC'}, behavior: 'contactor',
    manufacturer: 'SHIHLIN', name: '電磁接觸器', model: 'SHIHLIN S-C21L（型號待核）', photo: 'IMG_2687', size: [86, 106, 113],
    hint: '按住銘牌中央黑色可動件，放開即復位。此動作不代表線圈通電。',
  },
  'cn18': {
    id: 'cn18', category: 'contactor', visual: {model: 'contactorCN'}, behavior: 'contactor',
    name: '電磁接觸器', model: 'CN-18', photo: 'IMG_2690', size: [80, 106, 101],
    hint: '按住灰色框內的黑色機構，放開即復位。',
  },
  'terminal-strip-46': {
    id: 'terminal-strip-46', category: 'terminalBlock', visual: {model: 'terminalStrip'}, behavior: 'terminalStrip',
    name: '主端子台', model: '46 組・雙螺絲', count: 46, pitch: 14.7, photo: 'IMG_2686', size: [692, 29, 56],
    hint: '每格兩個螺絲分別為 A、B。識別碼為模型編號，可供後續配線引用。',
  },
  'terminal-strip-13': {
    id: 'terminal-strip-13', category: 'terminalBlock', visual: {model: 'terminalStrip'}, behavior: 'terminalStrip',
    name: '輔助端子台', model: '13 組・雙螺絲', count: 13, pitch: 15.2, photo: 'IMG_2690', size: [216, 29, 56],
    hint: '每格兩個螺絲分別為 A、B。識別碼為模型編號，可供後續配線引用。',
  },
  'koino-buzzer': {
    id: 'koino-buzzer', category: 'buzzer', visual: {model: 'buzzer'}, behavior: 'buzzer',
    manufacturer: 'Koino', name: '蜂鳴器', color: 1656925, model: 'Koino', photo: 'IMG_2686', size: [38, 45, 38],
    terminals: twoFrontTerminals(-45),
    hint: '蜂鳴器不具按壓機構。按住下方按鍵進行發聲測試。',
  },
  'emergency-red': {
    id: 'emergency-red', category: 'emergencyStop', visual: {model: 'emergency'}, behavior: 'emergency',
    name: '緊急停止', color: 14824544, model: '按下鎖定・旋轉復歸', photo: 'IMG_2686', size: [38, 45, 38],
    terminals: emergencyTerminals(),
    electrical: {contacts: [{type: 'NC', terminals: ['1', '2']}]},
    hint: '按下蘑菇頭保持鎖定；向右拖曳旋轉解鎖，或按「旋轉復歸」。',
  },
  'selector-three-position': {
    id: 'selector-three-position', category: 'selector', visual: {model: 'selector'}, behavior: 'selector',
    name: '手動／自動選擇開關', color: 1448218, model: '三段定位（示範設定）', photo: 'IMG_2686', size: [38, 45, 38],
    terminals: selectorTerminals(),
    hint: '左右拖曳旋鈕，或點選檔位。手動／停止／自動為模擬設定。',
  },
  'button-yellow': {
    id: 'button-yellow', category: 'pushButton', visual: {model: 'button'}, behavior: 'button',
    name: '黃色按鈕', color: 15839232, photo: 'IMG_2686', model: '圓形操作元件', size: [38, 45, 38],
    terminals: pushButtonTerminals(),
    electrical: {contacts: [{type: 'NO', terminals: ['1', '2']}, {type: 'NC', terminals: ['3', '4']}]},
    hint: '按住按鈕，放開回彈。也可用下方按鍵操作。',
  },
  'button-teal': {
    id: 'button-teal', category: 'pushButton', visual: {model: 'button'}, behavior: 'button',
    name: '藍綠色按鈕', color: 2255734, photo: 'IMG_2686', model: '圓形操作元件', size: [38, 45, 38],
    terminals: pushButtonTerminals(),
    electrical: {contacts: [{type: 'NO', terminals: ['1', '2']}, {type: 'NC', terminals: ['3', '4']}]},
    hint: '按住按鈕，放開回彈。也可用下方按鍵操作。',
  },
  'button-green': {
    id: 'button-green', category: 'pushButton', visual: {model: 'button'}, behavior: 'button',
    name: '綠色按鈕', color: 3634781, photo: 'IMG_2686', model: '圓形操作元件', size: [38, 45, 38],
    terminals: pushButtonTerminals(),
    electrical: {contacts: [{type: 'NO', terminals: ['1', '2']}, {type: 'NC', terminals: ['3', '4']}]},
    hint: '按住按鈕，放開回彈。也可用下方按鍵操作。',
  },
  'button-red-sticker': {
    id: 'button-red-sticker', category: 'pushButton', visual: {model: 'button'}, behavior: 'button',
    name: '紅色按鈕（貼紙）', color: 9654101, sticker: true, photo: 'IMG_2686', model: '圓形操作元件', size: [38, 45, 38],
    terminals: pushButtonTerminals(),
    electrical: {contacts: [{type: 'NO', terminals: ['1', '2']}, {type: 'NC', terminals: ['3', '4']}]},
    hint: '按住按鈕，放開回彈。也可用下方按鍵操作。',
  },
  'button-red': {
    id: 'button-red', category: 'pushButton', visual: {model: 'button'}, behavior: 'button',
    name: '紅色按鈕', color: 13329768, photo: 'IMG_2686', model: '圓形操作元件', size: [38, 45, 38],
    terminals: pushButtonTerminals(),
    electrical: {contacts: [{type: 'NO', terminals: ['1', '2']}, {type: 'NC', terminals: ['3', '4']}]},
    hint: '按住按鈕，放開回彈。也可用下方按鍵操作。',
  },
  'lamp-white': {
    id: 'lamp-white', category: 'lamp', visual: {model: 'lamp'}, behavior: 'lamp',
    name: '白色指示燈', color: 14213370, photo: 'IMG_2686', model: '圓形操作元件', size: [38, 45, 38],
    terminals: twoFrontTerminals(),
    hint: '指示燈不具按壓機構。下方按鍵只做獨立亮燈測試。',
  },
  'lamp-yellow': {
    id: 'lamp-yellow', category: 'lamp', visual: {model: 'lamp'}, behavior: 'lamp',
    name: '黃色指示燈', color: 15578880, photo: 'IMG_2686', model: '圓形操作元件', size: [38, 45, 38],
    terminals: twoFrontTerminals(),
    hint: '指示燈不具按壓機構。下方按鍵只做獨立亮燈測試。',
  },
  'lamp-red': {
    id: 'lamp-red', category: 'lamp', visual: {model: 'lamp'}, behavior: 'lamp',
    name: '紅色指示燈', color: 9443388, photo: 'IMG_2686', model: '圓形操作元件', size: [38, 45, 38],
    terminals: twoFrontTerminals(),
    hint: '指示燈不具按壓機構。下方按鍵只做獨立亮燈測試。',
  },
  'lamp-green': {
    id: 'lamp-green', category: 'lamp', visual: {model: 'lamp'}, behavior: 'lamp',
    name: '綠色指示燈', color: 554567, photo: 'IMG_2686', model: '圓形操作元件', size: [38, 45, 38],
    terminals: twoFrontTerminals(),
    hint: '指示燈不具按壓機構。下方按鍵只做獨立亮燈測試。',
  },
};

function freezeDefinition(definition: ComponentDefinition): ComponentDefinition {
  Object.freeze(definition.size);
  Object.freeze(definition.visual);
  if (definition.terminals) {
    for (const t of definition.terminals) {
      Object.freeze(t.position);
      Object.freeze(t.exitDirection);
      if (t.escapePath) {
        for (const p of t.escapePath) Object.freeze(p);
        Object.freeze(t.escapePath);
      }
      Object.freeze(t);
    }
    Object.freeze(definition.terminals);
  }
  if (definition.electrical?.coil) {
    Object.freeze(definition.electrical.coil.terminals);
    Object.freeze(definition.electrical.coil);
  }
  if (definition.electrical?.contacts) {
    for (const contact of definition.electrical.contacts) {
      Object.freeze(contact.terminals);
      Object.freeze(contact);
    }
    Object.freeze(definition.electrical.contacts);
  }
  if (definition.electrical) Object.freeze(definition.electrical);
  return Object.freeze(definition);
}
for (const [id, definition] of Object.entries(definitions)) definitions[id] = freezeDefinition(definition);
export const componentDefinitions: Readonly<Record<string, ComponentDefinition>> = Object.freeze(definitions);
