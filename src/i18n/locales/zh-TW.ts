import {en, type MessageKey} from './en.ts';
/** Existing source messages remain the canonical Traditional Chinese catalog. */
export const zhTW: Record<MessageKey, string> = Object.fromEntries(
  Object.keys(en).map(key => [key, key])
) as Record<MessageKey, string>;
Object.assign(zhTW, {
  'language.label': '語言',
  'language.auto': '跟隨瀏覽器',
  'language.autoCurrent': '跟隨瀏覽器（{0}）',
  'app.title': '配線盤 · 3D 實作工作台',
  'message.at': '{0}：{1}',
  'COMPONENT INSPECTOR': '元件檢視',
});
