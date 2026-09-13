import type {CatalogTerminalDefinition, ComponentDefinition} from '../../core/contracts.ts';
import {terminal} from './shared.ts';

const socketTerminals: CatalogTerminalDefinition[] = [];
let socketId = 1;
for (const z of [-31, 31]) {
  for (const x of [-24, -8, 8, 24]) {
    socketTerminals.push(terminal(String(socketId++), [x, 27, z]));
  }
}
for (const z of [-16, 0, 16]) {
  socketTerminals.push(terminal(String(socketId++), [-27, 35, z], 'unverified', undefined, undefined, [-1, 0, 0]));
}

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
    terminals: socketTerminals,
    hint: '照片是 11 腳空底座。點選端子查看其識別碼。',
  },
} satisfies Record<string, ComponentDefinition>;
