import type {LocaleDefinition} from './contracts.ts';
import {en} from './locales/en.ts';
import {zhTW} from './locales/zh-TW.ts';

/** Add a catalog and one entry here; the selector and negotiation use this registry. */
export const locales: readonly LocaleDefinition[] = [
  {id: 'zh-TW', nativeName: '繁體中文', lang: 'zh-Hant', dir: 'ltr',
    aliases: ['zh', 'zh-Hant', 'zh-HK', 'zh-MO', 'zh-Hans', 'zh-CN'], messages: zhTW},
  {id: 'en', nativeName: 'English', lang: 'en', dir: 'ltr', messages: en},
];
export const SOURCE_LOCALE = 'zh-TW';
export const FALLBACK_LOCALE = 'en';
export const STORAGE_KEY = 'wiring-panel.locale';
