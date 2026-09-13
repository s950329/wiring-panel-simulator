import type {ComponentDefinition} from '../../core/contracts.ts';
import {twoFrontTerminals} from './shared.ts';

const lamp = (id: string, name: string, color: number): ComponentDefinition => ({
  id,
  category: 'lamp',
  visual: {model: 'lamp'},
  behavior: 'lamp',
  name,
  color,
  photo: 'IMG_2686',
  model: '圓形操作元件',
  size: [38, 45, 38],
  terminals: twoFrontTerminals(),
  hint: '指示燈不具按壓機構。下方按鍵只做獨立亮燈測試。',
});

export const indicatorDefinitions = {
  'koino-buzzer': {
    id: 'koino-buzzer',
    category: 'buzzer',
    visual: {model: 'buzzer'},
    behavior: 'buzzer',
    manufacturer: 'Koino',
    name: '蜂鳴器',
    color: 1656925,
    model: 'Koino',
    photo: 'IMG_2686',
    size: [38, 45, 38],
    terminals: twoFrontTerminals(-45),
    hint: '蜂鳴器不具按壓機構。按住下方按鍵進行發聲測試。',
  },
  'lamp-white': lamp('lamp-white', '白色指示燈', 14213370),
  'lamp-yellow': lamp('lamp-yellow', '黃色指示燈', 15578880),
  'lamp-red': lamp('lamp-red', '紅色指示燈', 9443388),
  'lamp-green': lamp('lamp-green', '綠色指示燈', 554567),
} satisfies Record<string, ComponentDefinition>;
