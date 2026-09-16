# TypeScript development and migration

## Source and compiler coverage

Application modules, Three.js model builders, collision/routing code, CLI tools,
Vite configuration, Node tests and optional browser acceptance scripts are all
TypeScript. The migration replaces 16 `.js`, 48 `.mjs` and 2 Python files; it
keeps the existing module boundaries, project JSON format, source revision
`WIRE-R20`, geometry fixtures and routing/electrical behavior.

`npm run typecheck` uses TypeScript 5.9.3 with `strict: true`, `allowJs: false`
and `noEmit: true`. It checks `src/**/*.ts`, `qa/**/*.ts`, `scripts/**/*.ts` and
`vite.config.ts`, not only the application core. Type-only imports use
`import type`; local executable imports use `.ts`. External Three.js addon
imports keep the dependency's `.js` paths.

The migration guard in `qa/typescript-migration-check.ts` rejects authored
JavaScript/Python in these source directories, missing compiler coverage,
explicit `any` and unchecked-source directives. Deliberate negative type tests
use narrowly scoped `@ts-expect-error` assertions. JSON validation still runs
at runtime: TypeScript does not validate imported user files.

Three.js `userData`, browser globals and event boundaries have explicit local
contracts. Mutable test copies and minimal DOM fixtures live in `qa/helpers/`;
they do not weaken the immutable project or component contracts.

Generated JavaScript in `dist/` and the standalone HTML is expected: browsers
execute the bundled output, not the TypeScript source. Dependencies and generated
exports are not committed. Historical dated plans and acceptance reports retain
their original filenames and outcomes; their former `.js`, `.mjs` and Python
source paths now correspond to `.ts` files.

## Development and validation

Use Node.js 22; CI is pinned to 22.16.0. Dependencies remain pinned in the lockfile.

```sh
npm ci
npm run typecheck
npm test
npm run build
```

`npm test` includes the existing electrical, geometry, routing, import/export,
transaction, localization and component tests plus three migration guards.
`npm run build` first regenerates the standalone HTML and checks its embedded
script syntax and byte equality, then runs Vite. The website and downloadable
HTML use the same TypeScript application entry point and model revision.

The optional utilities use the same domain implementation as the application:

```sh
npm run rebuild-project -- INPUT.json NEW-OUTPUT.json
npm run reroute -- SNAPSHOT.json NEW-SNAPSHOT.json --close-panel
```

They do not overwrite the input or an existing output. `rebuild-project` handles
native projects and supported legacy conversion; `reroute` explicitly rebuilds
legacy snapshot geometry rather than changing ordinary snapshot import behavior.

## Optional browser acceptance (Node Playwright)

Python and Python Playwright are no longer required. Node Playwright is a pinned
development dependency; Chromium is installed separately when these checks are
needed. Browser/WebGL acceptance remains manual and is not part of `npm test`
or the standard CI workflow.

```sh
npx playwright install chromium
npm run dev -- --host 127.0.0.1
# In another terminal:
npm run test:browser:i18n -- http://127.0.0.1:5173
npm run test:browser:project -- http://127.0.0.1:5173
```

The localization check exercises the actual adapter in a DOM-only fixture,
without WebGL. Its server-free variant bundles that same TypeScript adapter with
esbuild instead of copying or rewriting its source:

```sh
npm run test:browser:i18n -- --offline .
```

The project check exercises real pointer controls, import/export, operation-panel
poses, simulation and both served and `file://` standalone HTML. Run
`npm run build` first to generate `public/wiring-panel.html` and
`downloads/wiring-panel-WIRE-R20.html`. Revision checks import `MODEL_REVISION`
rather than hardcoding an older revision. The browser context explicitly selects
Traditional Chinese because its UI assertions use the canonical Chinese labels.

Set `CHROMIUM_EXECUTABLE` to use an existing compatible Chromium executable.
Both commands support `--help` without launching a browser. Reports and screenshots
are written to the ignored `qa-results/` directory, and browsers are closed in
`finally` blocks on failures as well as success.

## Migration verification record

The pre-migration baseline at `2e4ea79b0e17c66b07f79660138e848957a314dc`
passed all 232 existing Node tests before editing. The migration guard was run
first and failed on the original language/compiler boundaries as expected.

Post-migration verification: all **235 tests passed**, with zero failures or
skips (the existing 232 tests plus three migration guards). A clean lockfile
installation, full strict typecheck, standalone generation and Vite production
build passed. The standalone verifies two inline scripts, exact embedded code
bytes and four nameplate textures. Vite retains its existing non-fatal large
chunk warning. CLI missing-argument, input-preservation, native A04 reconstruction
and existing-output refusal checks passed.

Browser scripts are compiled and their help entry points checked during this
migration; their actual DOM/WebGL acceptance runs are explicitly not claimed.
The protected `qa/fixtures/model-baseline.json` remains unchanged.
