# Dynamic Wiring Project Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import/export a complete configurable wiring project containing authored placement/state and endpoint-only connections; rebuild routes using the same service as manual wiring.

**Architecture:** A pure project contract and built-in component/assembly adapters validate inputs independently of Three.js. A project runtime owns its configured model, equipment, connection ordering and resources. A transactional session builds a replacement away from the current scene, then atomically publishes it; existing snapshot utilities remain diagnostic compatibility boundaries.

**Tech Stack:** Existing Three 0.180.0, TypeScript 5.9.3 strict, Vite 6.1.0, Node test runner with tsx 4.20.6. No additional runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-14-project-format-design.md`

## Global Constraints

- `format: wiring-panel-project`, `schemaVersion: 1`; one rectangular baseplate and zero/one hinged panel; Y rotations are integer multiples of 90 degrees.
- Scene proportion units, not measured millimetres. Known built-in definitions only. No embedded code, remote models or arbitrary transforms.
- Input limits: 10 MB, 128 components, 8,192 terminals, 512 connections, 64 ducts/rails each, reference depth 16, IDs 100 characters, name 200 characters, finite positions/dimensions bounded by 10,000.
- Preserve accepted geometry fixtures and discrete electrical semantics. Persistent settings restored; transient demonstrations reset; imports never start simulation.
- Preserve original project on validation/routing/cancellation/stale-session failure. No omitted wires, fabricated paths or reduced clearance.
- Keep `.openai/hosting.json` and existing Site identity. Every source change under Git; no force push or credentials in files. Browser/hosting limitations must be stated, not claimed as passed.

## File map

`src/project/contracts.ts`, `validation.ts`, `catalog.ts`, `assemblies.ts`, `legacy.ts`, `default-project.ts` own serializable inputs. `model.ts`, `structures.ts`, `equipment.ts`, `runtime.ts`, `session.ts`, `resources.ts` own reconstruction, operation and lifecycle. `src/wiring/context.ts` and `duct-network.ts` parameterize the existing collision-tested router. `src/views/project-files.ts` owns cancellable import/export UI. Existing main/scene/wiring/simulation UI read the active runtime and share its connect operation. `scripts/rebuild-project.mjs` exercises the identical pipeline offline.

## Task 1: Pure configuration, definition/state and assembly contracts (A2–A6, A9)

**Files:** Create `src/project/{contracts,validation,catalog,assemblies,default-project}.ts`; create `qa/project-contract-check.mjs` and `qa/helpers/project-data.mjs`.

**Interfaces:** `parseProject(source: string): ProjectDocument`; `validateProject(value: unknown): ProjectDocument`; `defaultProject(): ProjectDocument`; `resolveMounts(configuration): Map<string, ResolvedMount>`; `fixedAssemblyWires(configuration): Wire[]`.

- [x] Write failing contract tests, including non-default equipment IDs, parameter ranges, defaults, unknown versions, wrong mount types, duplicate/reversed/self connections, legal shared-terminal branches and duplicate fixed straps.
  ```js
  const input = minimalProject();
  const result = parseProject(JSON.stringify(input));
  assert.equal(result.configuration.components[0].id, 'breaker');
  assert.throws(() => parseProject(JSON.stringify({...input, schemaVersion: 99})), /schemaVersion/);
  ```
- [x] Run `node --import tsx --test qa/project-contract-check.mjs`; observe missing API/contract failure.
- [x] Implement whitelist validators with explicit field-path errors, trusted catalog adapters, semantic state normalization, assembly host/slot resolution and pure default data. New exports never carry derived render/electrical fields.
- [x] Run contract tests and `npm run typecheck`; commit `feat(project): define portable project configuration and connections`.

## Task 2: Dynamic structures, assemblies, equipment and runtime (A1–A7, A11)

**Files:** Create `src/project/{structures,model,equipment,resources,runtime}.ts`; modify `src/application/{equipment,simulation}.ts`, `src/primitives.js`, `src/layout.ts`; create `qa/project-runtime-check.mjs`.

**Interfaces:** `createProjectRuntime(project: ProjectDocument): ProjectRuntime`; runtime exposes components/world/flap/routing/simulation, `connect(from,to)`, `remove(id)`, `exportProject()`, `movePanel(open)`, `dispose()`. Geometry coordinates resolved from configuration; simulated equipment from capabilities, not names.

- [x] Write failing real-model tests: default-vs-existing terminal geometry; two SP16 hosts with attachments at moved/rotated mounts; freestanding TH creates no fixed conductors; renamed sources and motor; persistent settings vs transient output; resource disposal leaves shared primitives alive.
  ```js
  const runtime = createProjectRuntime(minimalProject());
  assert.deepEqual([...runtime.components.keys()], ['breaker', 'coil']);
  assert.equal(runtime.simulation.circuit().sources.length, 0);
  runtime.dispose();
  ```
- [x] Run `node --import tsx --test qa/project-runtime-check.mjs` and capture failure.
- [x] Implement configurable rectangular base/panel geometry and resolved placements without modifying leaf model geometry. Add explicit equipment options and individual source switches to SimulationController while retaining legacy defaults only for legacy entry points.
- [x] Run runtime and existing component/electrical/geometry regressions; commit `feat(project): reconstruct configured models and electrical equipment`.

## Task 3: Project-scoped native routing (A7–A9)

**Files:** Create `src/wiring/{context,duct-network}.ts`; modify `src/wiring/{router.js,controller.js,restore.ts}`, `src/scene.js`; create `qa/project-routing-check.mjs`.

**Interfaces:** Each model owns a `RoutingContext` with ID-addressed ducts, optional gateway, base bounds and a cancellation checkpoint. `routeWire(world, components, from, to, wires, context)` shares existing escape/join/clearance logic. Legacy geometry assigns its own compatibility context rather than the router importing `layout.ts`.

- [x] Write graph and real-route tests: permuting duct arrays preserves geometry; fourth-duct assumption removed; intersecting chains succeed; disconnected/no ducts fail clearly; rotated panel exit/gateway; actual routes satisfy CollisionWorld and validateSelf.
  ```js
  const first = runtime.connect(a, b);
  const reordered = createProjectRuntime(projectWithReversedDuctOrder);
  assert.deepEqual(reordered.connect(a, b).points, first.points);
  ```
- [x] Observe failures; implement deterministic ID-sorted duct connectivity and shared routing context. Preserve old default route regression via equivalent geometric junctions. Add bounded search checkpoints and no synthetic bypass.
- [x] Run native route, panel-open/close and project-route regressions; commit `refactor(routing): route through the active project duct network`.

## Task 4: Legacy conversion, transactional session and file UI (A5–A6, A9–A11)

**Files:** Create `src/project/{legacy,session}.ts`, `src/views/project-files.ts`, `scripts/rebuild-project.mjs`; modify `src/main.js`, `src/scene.js`, `src/views/simulation-panel.ts`, `src/wiring/panel.js`; create `qa/project-session-check.mjs`, `qa/project-files-check.mjs`.

**Interfaces:** `readProject(source): {project, convertedLegacy}`; `buildProject(source, {signal,onProgress}): Promise<ProjectRuntime>`; `ProjectSession.load(source, options)`, `.cancel()`, `.active`, `.busy`. Source ordered connections restored through runtime.connect, staging in the open-panel pose then validating saved target pose.

- [x] Write failing tests for R8–R12 conversion without trusting old points/metadata; inconsistent placement/fixed conductors reject; cancellation and stale jobs preserve exact active object/state; too-large/unknown source rejection; export order and settings round trip.
  ```js
  const before = session.active;
  await assert.rejects(session.load(badSource));
  assert.equal(session.active, before);
  assert.equal(session.busy, false);
  ```
- [x] Implement conversion with known legacy assembly/placement mapping; never invoke the old exact-snapshot validator before conversion. Build independently, yield/check cancellation between bounded routing steps, commit only a current completed job.
- [x] Rebind scene/UI on commit, remove disposed UI listeners, lock mutation for entire load, clear audio/pointer/selection/results. Add import progress/cancel, project name and reset-to-default. Inspect selected instance inline rather than global MC1. Keep old standalone snapshot entry as diagnostic compatibility.
- [x] Run session and DOM regression tests; commit `feat(project): import and export projects transactionally`.

## Task 5: End-to-end acceptance, documentation and publication (A1–A12)

**Files:** Add example new projects under `examples/`, acceptance docs and tests; update revision, package scripts and architecture documentation. Preserve all existing Site metadata and geometry fixtures.

- [x] Convert user's A04 snapshot using the implemented API; export endpoint-only JSON; reimport and assert startup/self-hold/stop/overload/red+buzzer/reset/control-loss sequence using the real simulator.
- [x] Add multi-instance renamed/moved fixture, panel-less fixture, no-source project and malformed legacy fixture. Test repeated loading/disposal and scene interactions in Chromium when allowed.
- [x] Run full `npm test`, `npm run build`, original baseline fixture comparison, security/whitelist review and artifact byte checks. Record exact output; no inferred success counts.
- [ ] Commit validated source; compare current GitHub HEAD, preserve concurrent changes, push through GitHub Git APIs when direct transport is unavailable and verify blobs/commit.
- [ ] Publish only to the existing Site if a supported deployment tool is available. Otherwise deliver built standalone HTML, new example JSON, source/build archive and an explicit not-published status. Do not create another Site.
