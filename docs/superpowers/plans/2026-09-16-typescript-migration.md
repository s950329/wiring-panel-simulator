# Strict TypeScript Migration Implementation Plan

> **For agentic workers:** Execute this continuation task-by-task with `superpowers:executing-plans`; preserve the approved application behavior and the existing regression suite.

**Goal:** Migrate every authored JavaScript and Python module, including tools and tests, to strict TypeScript without changing electrical or routing behavior.

**Architecture:** Keep the existing module boundaries. Reuse the core, electrical, project, and routing contracts; explicitly type the remaining Three.js, DOM, controller, and test boundaries. Replace the two Python Playwright scripts with Node Playwright TypeScript scripts, preserving their optional/manual status.

**Tech Stack:** Existing Node 22.16.0, TypeScript 5.9.3, tsx 4.20.6, Three.js 0.180.0, Vite 6.1.0; explicit Node types, esbuild, and Playwright development dependencies from the previously prepared toolchain.

**Spec:** User-authorized continuation of JavaScript/Python → TypeScript migration, `AGENTS.md`, and `VERSION_CONTROL.md`.

## Global constraints

- Preserve the baseline tree `c21cc2d6b64c1409bed6912e382310e1a954b59f` / main `2e4ea79b0e17c66b07f79660138e848957a314dc`, locale support, deployment identity, and all unrelated files.
- No `any`, `@ts-ignore`, `@ts-nocheck`, or disabled strict checks. Negative type tests may retain their intentional `@ts-expect-error` assertions.
- Never replace `qa/fixtures/model-baseline.json` to conceal geometry changes.
- Preserve project JSON and legacy snapshot compatibility, source/write protections in CLI tools, routing budgets, collision checks, and electrical truth tables.
- The owner performs browser/WebGL visual acceptance; typecheck browser scripts but do not run WebGL acceptance.
- Generated browser JavaScript and bundled third-party JavaScript remain build artifacts, not handwritten source.

## 1. Baseline and migration regression guard

- [x] Retrieve and verify the exact upstream source tree and previous offline toolchain.
- [x] Run the original `npm test` from the unmodified baseline workspace and record the outcome.
- [x] Add `qa/typescript-migration-check.ts`: recursively reject JS/Python in `src/`, `scripts/`, and `qa/`; require strict compiler coverage of every TypeScript file; reject unsafe suppression and explicit `any` syntax.
- [x] Run `node --import tsx --test qa/typescript-migration-check.ts`; confirm it fails on the existing language boundaries before converting them.

## 2. Application and routing contracts

- [x] Rename all first-party `.js` modules and `vite.config.js` to `.ts`; update first-party imports and HTML entry points (not external `three/addons/*.js`).
- [x] Add explicit geometry/material/model, routing/collision/controller, scene/picking, DOM, and browser API contracts using existing domain types.
- [x] Convert class fields and callbacks without changing runtime calculations, candidate ordering, geometry, or application transaction semantics.
- [x] Remove migration-only double casts where the implementation now exposes the real contract.
- [x] Check `npm run typecheck` and geometry/routing/electrical regression tests without modifying expected fixtures.

## 3. Tools and complete test coverage

- [x] Convert `scripts/build-offline.mjs`, `rebuild-project.mjs`, and `reroute-snapshot.mjs` to `.ts`; keep byte-equality and syntax checks, explicit CLI errors, and non-overwrite writes.
- [x] Convert every `.mjs` test/helper to `.ts`, keeping all original assertions, test cases, and test discovery.
- [x] Add precise test-only DOM/canvas utilities where necessary instead of widening production types for mocks.
- [x] Make `tsconfig.json` strict with `allowJs: false`, covering `src`, `qa`, `scripts`, and `vite.config.ts`.
- [x] Update npm commands to execute TypeScript using `node --import tsx`; declare Node types and esbuild directly.

## 4. Python browser checks to TypeScript

- [x] Port DOM-only localization checks to `qa/i18n-browser-check.ts` with equivalent browser preference, mutation, state, mobile overflow, and disposal assertions.
- [x] Port full application/offline acceptance to `qa/project-browser-check.ts` with real pointer input, diagnostics, and try/finally browser cleanup.
- [x] Replace stale revision literals with `MODEL_REVISION`, retain explicit browser setup and optional execution, and document commands.
- [x] Remove both Python source files and update active documentation references.

## 5. Verify and publish source

- [x] Run a clean `npm ci`, complete `npm test`, `npm run offline`, `npm run build`, CLI smoke/error checks, and `git diff --check`.
- [x] Confirm no first-party JS/Python remains, every TypeScript file is compiler-checked, and the protected geometry fixture is byte-identical.
- [x] Review the diff, record exact test outcomes and unrun browser checks, and update README / architecture guidance incrementally.
Publication gate: recheck GitHub main; publish the validated source tree with a canonical parent and a non-forced fast-forward, refusing concurrent changes. Verify the remote tree and CI before reporting publication.
