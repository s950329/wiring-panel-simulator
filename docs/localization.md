# Interface languages

The main application and standalone HTML support **Traditional Chinese** (`zh-TW`) and **English** (`en`). The same bundled catalogs are used online and offline; changing a language does not download a translation or reload the application.

## User behavior

The language select is beside **Download HTML** in the header. Its choices use native language names, not flags. **Browser default** restores automatic selection.

1. A valid saved manual choice wins (`localStorage['wiring-panel.locale']`).
2. Otherwise the first supported language in `navigator.languages` wins. `navigator.language` is used when that list is empty.
3. Regional/script variants are matched through the registry, aliases and language families. With the two shipped locales, Chinese variants use Traditional Chinese; English variants use English.
4. If nothing matches, use English.

The automatic option shows what the browser would choose, even while a different language is selected manually. `languagechange` updates automatic mode but never overrides a manual choice. Choosing Browser default removes only this application's locale preference.

Storage access is guarded. When storage is blocked or unavailable, selection still works for the current page; persistence across reloads is then best-effort. The document's `lang`, `dir`, title and accessibility labels follow the selected language.

## Boundaries

Locale is **presentation state**, never project state. Do not serialize it into a wiring project or use translated text as an input to circuit/routing logic. The language adapter updates existing text nodes and `aria-label`, `title`, and `placeholder` attributes only. It never reruns the application, replaces controls, dispatches component actions, or changes input values, open details, terminal IDs or event handlers.

User-authored project names and raw identifiers use `data-i18n-ignore` (or the existing `.id` identifier class). Text in input values, code/preformatted blocks and content-editable elements is not translated. Physical model nameplates/textures are unchanged, like the labels on real equipment. JSON structure, persistent names, IDs and canonical diagnostic data remain language independent.

`src/wiring/panel.ts` keeps its canonical prompt in application state instead of reading the translated DOM back as state. Follow that pattern for future controls.

## Files

- `src/i18n/core.ts`: preference negotiation, guarded storage, notifications and canonical text bindings. No DOM or simulator dependency.
- `src/i18n/registry.ts`: supported language IDs, native names, document metadata, aliases and fallback.
- `src/i18n/locales/en.ts`: complete English catalog, combining common messages from `en-common.ts` with compound model labels. Keys are canonical Chinese source messages plus a few semantic UI keys.
- `src/i18n/locales/zh-TW.ts`: source-language messages and semantic-key translations.
- `src/i18n/messages.ts`: source-message formatting, exact/template matching, bounded caching and fallback.
- `src/i18n/browser.ts`: the native select, document metadata and a scoped DOM adapter for the existing framework-free views.

The DOM adapter is a compatibility boundary for this application's existing TypeScript views, not a general-purpose machine translator. Only registered messages/templates are translated. It remembers each node's canonical source, so switching back to Chinese does not depend on reverse-translating English. Dynamically updated statuses and diagnostics use the same catalog.

## Add a language

Create a catalog, for example `src/i18n/locales/ja.ts`:

```ts
import type {MessageKey} from './en.ts';
export const ja = {
  'language.label': '言語',
  'language.auto': 'ブラウザーの設定',
  'language.autoCurrent': 'ブラウザーの設定（{0}）',
  'app.title': '配線盤 · 3D ワークベンチ',
  '開始測試': 'テスト開始',
  '下載 HTML': 'HTML をダウンロード',
} satisfies Partial<Record<MessageKey, string>>;
```

Import it in `registry.ts` and append an entry:

```ts
{id: 'ja', nativeName: '日本語', lang: 'ja', dir: 'ltr', messages: ja},
```

The dropdown and browser detection pick up the entry automatically. Regional variants such as `ja-JP` match `ja`. For distinct regional/script catalogs, give each a unique ID and assign aliases deliberately; remove an older alias when it should belong to the new catalog. Missing or malformed translations fall back to English, then the source message. A complete release should translate the full catalog, even though partial catalogs are safe during development.

Preserve numbered placeholders such as `{0}` and `{1}` exactly; their order can change. Parameters are plain text, not HTML, and identifiers must remain verbatim. Only the explicitly declared message-valued slots in `messages.ts` recursively translate a nested diagnostic. Do not make all parameters translatable: a Chinese user-supplied ID can legitimately equal an interface label.

For new user-visible copy, add its source key and English translation. The canonical source acts as a gettext-style key: changing Chinese copy requires updating the corresponding catalogs. Test the **rendered composite message**, not just its individual literals, when joining a label, prefix or diagnostic. Large unrelated domain rewrites are not required to add another locale.

## Verification

`npm test` includes `qa/i18n-check.ts` and `qa/i18n-catalog-check.ts`. They verify preference precedence, language variants, blocked storage, source restoration, added-language fallback, placeholder parity, catalog coverage, real component presentations and electrical/validation diagnostics without WebGL.

Optional DOM-only checks use the pinned Node Playwright development dependency and Chromium (no Python required):

```sh
npx playwright install chromium
npm run dev -- --host 127.0.0.1
# In another terminal:
npm run test:browser:i18n -- http://127.0.0.1:5173
```

These check node identity, event handlers, preserved input/expanded details, accessibility labels, dynamic status text, automatic mode and phone-width overflow. They do not replace the owner's full visual/WebGL acceptance. A server-free variant bundles the actual TypeScript adapter with esbuild: `npm run test:browser:i18n -- --offline .`. Use `CHROMIUM_EXECUTABLE` to select an existing compatible Chromium instead of the managed installation.

Run `npm run build` after changes. Its offline step includes both catalogs in the standalone HTML and verifies the freshly generated inline scripts; do not maintain a separate translated HTML fork.
