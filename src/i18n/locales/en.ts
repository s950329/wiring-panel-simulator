import {en as common} from './en-common.ts';
import {editorEnglish} from './en-editor.ts';

/** Complete English catalog, including labels composed by legacy model builders. */
export const en = {
  ...common,
  ...editorEnglish,
  '左後上 · 常閉 NC': 'Left rear upper · Normally closed (NC)',
  '左後下 · 常開 NO': 'Left rear lower · Normally open (NO)',
  '左前上 · 常閉 NC': 'Left front upper · Normally closed (NC)',
  '左前下 · 常開 NO': 'Left front lower · Normally open (NO)',
  '右後上 · 常閉 NC': 'Right rear upper · Normally closed (NC)',
  '右後下 · 常開 NO': 'Right rear lower · Normally open (NO)',
  '右前上 · 常閉 NC': 'Right front upper · Normally closed (NC)',
  '右前下 · 常開 NO': 'Right front lower · Normally open (NO)',
} as const;
export type MessageKey = keyof typeof en;
