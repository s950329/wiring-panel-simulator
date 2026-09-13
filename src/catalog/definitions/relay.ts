import type {ComponentDefinition} from '../../core/contracts.ts';

export const relayDefinitions = {
  'omron-p2cf11': {
    id: 'omron-p2cf11',
    category: 'socket',
    visual: {model: 'socket'},
    behavior: 'socket',
    manufacturer: 'OMRON',
    name: '11 腳繼電器插座',
    model: 'OMRON P2CF-11',
    photo: 'IMG_2687',
    size: [68, 32, 79],
    hint: '照片是 11 腳空底座。點選端子查看其識別碼。',
  },
} satisfies Record<string, ComponentDefinition>;
