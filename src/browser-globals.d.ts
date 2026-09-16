import type {ProjectLab} from './project/app.ts';
import type {LegacyLab} from './legacy-inspector.ts';
export {};
declare global {
  interface Window {
    WIRING_TEXTURES?: Record<string, string>;
    webkitAudioContext?: typeof AudioContext;
    wiringLab?: (ProjectLab | LegacyLab) & {getLocale?: () => string; setLocale?: (locale: string) => void; dispose?: () => void};
  }
}
