import type {CatalogTerminalDefinition, ComponentDefinition} from '../../core/contracts.ts';
import {poleBankTerminals, terminal} from './shared.ts';

const th20Terminals: CatalogTerminalDefinition[] = [
  ...poleBankTerminals(['1/L1', '3/L2', '5/L3'], 59, 50, -19),
  ...poleBankTerminals(['2/T1', '4/T2', '6/T3'], 59, 36, 16),
  terminal('TC', [46, 50.5, 17], 'unverified', 'TC', 'overload-contact'),
  terminal('TA', [39, 16, 27], 'unverified', 'TA', 'overload-contact'),
  terminal('TB', [57, 16, 27], 'unverified', 'TB', 'overload-contact'),
];

export const protectionDefinitions = {
  'shihlin-t20': {id: 'shihlin-t20', category: 'breaker', visual: {model: 'breaker'}, behavior: 'breaker', manufacturer: 'SHIHLIN', name: '三極電源斷路器', model: 'T20 · 儀表用電源', photo: 'IMG_2689', size: [98, 112, 112], hint: '從正面看，往前推為 ON，往後扳為 OFF。點選三連動橫桿切換，三極同步動作。'},
  'twin-fuse-holder': {id: 'twin-fuse-holder', category: 'fuse', visual: {model: 'fuse'}, behavior: 'fuse', name: '雙保險絲座', model: '可掀式透明保護蓋', photo: 'IMG_2688', size: [43, 35, 72], hint: '點選透明保護蓋，示範掀開與閉合。'},
  'shihlin-th20': {id: 'shihlin-th20', category: 'overload', visual: {model: 'overload'}, behavior: 'overload', manufacturer: 'SHIHLIN', name: '熱過載繼電器', model: 'SHIHLIN TH20', photo: 'IMG_2687', size: [101, 71, 77], terminals: th20Terminals, hint: 'TC 在上方，TA／TB 在下方。TEST／RESET 操作語義為模擬設定；照片未能確認白色操作桿的完整標示。'},
} satisfies Record<string, ComponentDefinition>;
