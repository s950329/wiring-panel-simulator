import type {ComponentDefinition} from '../../core/contracts.ts';
import {emergencyTerminals, pushButtonTerminals, selectorTerminals} from './shared.ts';

const button = (
  id: string,
  name: string,
  color: number,
  sticker = false,
): ComponentDefinition => ({
  id,
  category: 'pushButton',
  visual: {model: 'button'},
  behavior: 'button',
  name,
  color,
  ...(sticker ? {sticker: true} : {}),
  photo: 'IMG_2686',
  model: '圓形操作元件',
  size: [38, 45, 38],
  terminals: pushButtonTerminals(),
  electrical: {
    contacts: [
      {type: 'NO', terminals: ['1', '2']},
      {type: 'NC', terminals: ['3', '4']},
    ],
  },
  hint: '按住按鈕，放開回彈。也可用下方按鍵操作。',
});

export const controlDefinitions = {
  'emergency-red': {
    id: 'emergency-red',
    category: 'emergencyStop',
    visual: {model: 'emergency'},
    behavior: 'emergency',
    name: '緊急停止',
    color: 14824544,
    model: '按下鎖定・旋轉復歸',
    photo: 'IMG_2686',
    size: [38, 45, 38],
    terminals: emergencyTerminals(),
    electrical: {contacts: [{type: 'NC', terminals: ['1', '2']}]},
    hint: '按下蘑菇頭保持鎖定；向右拖曳旋轉解鎖，或按「旋轉復歸」。',
  },
  'selector-three-position': {
    id: 'selector-three-position',
    category: 'selector',
    visual: {model: 'selector'},
    behavior: 'selector',
    name: '手動／自動選擇開關',
    color: 1448218,
    model: '三段定位（示範設定）',
    photo: 'IMG_2686',
    size: [38, 45, 38],
    terminals: selectorTerminals(),
    hint: '左右拖曳旋鈕，或點選檔位。手動／停止／自動為模擬設定。',
  },
  'button-yellow': button('button-yellow', '黃色按鈕', 15839232),
  'button-teal': button('button-teal', '藍綠色按鈕', 2255734),
  'button-green': button('button-green', '綠色按鈕', 3634781),
  'button-red-sticker': button('button-red-sticker', '紅色按鈕（貼紙）', 9654101, true),
  'button-red': button('button-red', '紅苲按鈕', 13329768),
} satisfies Record<string, ComponentDefinition>;
