# Custom panel completion and synchronization

Goal: finish the previously approved builder and publish one complete, verified source tree, not disconnected uploaded blobs.

Spec: ../specs/2026-09-18-custom-panel-design.md

- [x] Recover saved catalog, commands, geometry, history/controller, overlay, viewer/dialog and CSS without replacing main.
- [x] Add regression tests for immutable commands, bounds/collisions, attachment groups, transactional history, keyboard ownership and camera projection.
- [x] Complete `src/editor/ui.ts`; connect it to `src/project/app.ts` and camera switching in `src/scene.ts`. Preserve legacy wiring behavior outside builder mode.
- [x] Register editor English messages, advance WIRE-R21 compatibility, add tests to npm test and document use/limitations.
- [x] Run strict typecheck, complete npm test and production/standalone builds; inspect the final diff and protected model fixture.
Publication gate: publish all changed source as a single complete feature commit based on current main only after the exact tree passes CI. Verify tree hashes, create the PR and retain commit/CI evidence there.
