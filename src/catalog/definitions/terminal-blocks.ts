import type {ComponentDefinition} from '../../core/contracts.ts';
import {terminalStripTerminals} from './shared.ts';

export const terminalBlockDefinitions = {
  'terminal-strip-46': {
    id: 'terminal-strip-46',
    category: 'terminalBlock',
    visual: {model: 'terminalStrip'},
    behavior: 'terminalStrip',
    name: '主端子台',
    model: '46 組・雙螺絲',
    count: 46,
    pitch: 14.7,
    photo: 'IMG_2686',
    size: [692, 29, 56],
    terminals: terminalStripTerminals(46, 14.7),
    hint: '每格兩個螺絲分別為 A、B。識別碼為模型編號，可供後續配線引用。',
  },
  'terminal-strip-13': {
    id: 'terminal-strip-13',
    category: 'terminalBlock',
    visual: {model: 'terminalStrip'},
    behavior: 'terminalStrip',
    name: '輔助端子台',
    model: '13 組・雙螺絲',
    count: 13,
    pitch: 15.2,
    photo: 'IMG_2690',
    size: [216, 29, 56],
    terminals: terminalStripTerminals(13, 15.2),
    hint: '每格兩個螺絲分別為 A、B。識別碼為模型編號，可供後續配線引用。',
  },
} satisfies Record<string, ComponentDefinition>;
