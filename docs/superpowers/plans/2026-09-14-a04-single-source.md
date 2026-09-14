# A04 single-source implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task. Each task has a red/green test checkpoint.

**Goal:** Implement approved single-source specification v0.2 with real QF1-to-fuse wiring and no independent CONTROL in the normal project runtime.

**Architecture:** Integrate the existing project-format dependency at `98ba3d274f377a204cce8e12ad078e0f8a56ce37` without modifying its branch. Keep the pure electrical core source-aware; derive two-terminal supply candidates from explicitly declared phase pairs, never extra conducting sources. Normal project runtime gets a dedicated no-toggle controller; historical snapshot test tools remain explicitly legacy, not a UI mode.

**Tech stack:** TypeScript strict, Three 0.180.0, Node 22, node:test, Vite 6.1.0; no new runtime dependency.

**Spec:** docs/superpowers/specs/2026-09-14-a04-single-source-design-v0.2.md and the project-format design.

## Global constraints

- Single physical source and QF1 contact-controlled downstream supply. No CONTROL, source-available or per-circuit toggles in normal runtime.
- Source capability is opt-in; no changes to unspecified phase pairs, short/conflict, unsupported series, convergence or motor requirements.
- Project `configuration + connections`, schema 1; preserve actual endpoint routing; no invented points, bypass wires, or geometry baseline edits.
- Default A04 QF1 OFF; every load/import off; transient buttons and coil memory cleared. Preserve authored persistent states.
- Source and dependency branches preserved, no force push; current main documents retained. Same existing Site only.
- User's 30 acceptance conditions E01–V01 are future gates, not preclaimed test outcomes.

## Task 1: explicit phase-pair electrical capability

Files: `src/electrical/{contracts,netlist,power,solver,catalog,explanation}.ts`; test `qa/electrical-line-to-line-check.mjs`.
Interfaces: optional `ThreePhaseSource.lineToLine` (canonical phase indices 0..2, i<j, max3, unique pair, nonempty profile); optional `LoadResult.supplyEvidence`. `twoTerminalSupplies(supplies)` returns load candidates with original source IDs. Original supplies alone feed source-conflict and motor logic.

- [x] Add red tests: compatible phase pairs and reversed load endpoints energized; omitted capability stays unsupported; invalid/duplicate pairs rejected even disabled; profile mismatch, same-phase, shorts, source-conflicts, unsupported series and parallel motor regressions.
- [x] Run `node --import tsx --test qa/electrical-line-to-line-check.mjs` and retain failing output.
- [x] Validate declarations in netlist. In power derive candidates without unioning rails. In solver replace `supplies.filter(two-pole)` for load matching only; retain full source network checks. Attach original phase evidence to energized results.
- [x] Run new tests plus existing pure electrical suite and strict typecheck. Commit focused core change.

Concrete acceptance pattern:
```js
const result = evaluateCircuit(withExplicitPair);
assert.equal(result.loads[0].state, 'energized');
assert.deepEqual(result.loads[0].sourceIds, ['MAIN-SUPPLY']);
assert.equal(evaluateCircuit(withoutCapability).loads[0].state, 'unknown');
```

## Task 2: single-source project validation and simulation

Files: new `src/project/simulation.ts`, changes in `src/project/{catalog,equipment,validation,runtime,default-project}.ts`, `src/views/simulation-panel.ts`; tests `qa/project-single-source-check.mjs`.
Interfaces: dedicated project `SimulationController` exposes the existing connect/remove/operate/start/stop/subscribe/snapshot shape consumed by ProjectRuntime but no power setters or persisted power controls. `circuit()` has no two-pole sources. Explicit AC220 source declared by built-in definition; generic source retains no pair capability. Source enabled depends only on running mode, never QF1 state.

- [x] Write red tests for zero/one allowed source, renamed source, rejected independent or multiple sources and source parameters; snapshot must not include legacy `power/sourcePower` fields.
- [x] Implement fixed-source controller, project policy, builtin source definition, sources-without-parameters serialization. Remove UI source switches; use 開始測試／返回配線 and simulation-not-running copy.
- [x] Verify QF1 OFF keeps source live and upstream rails live; deliberate upstream bypass still energizes a compatible branch. Normal A04 shuts down via actual contacts.
- [x] Run typecheck and project policy/application tests. Commit runtime change.

## Task 3: legacy boundary and complete A04 connections

Files: `src/project/legacy.ts`, `src/views/project-files.ts`, `src/project/session.ts`; `examples/*.project.json`; tests `qa/project-single-source-check.mjs`, updated project acceptance/runtime/browser tests.

- [x] Red tests: wired legacy CONTROL rejects without mutation; unused auto CONTROL removed with explicit conversion note; old MAIN disabled cannot be guessed into QF1 state; generic MAIN must not acquire lineToLine capability.
- [x] Validate legacy authoritative wires and fixed links before dropping unused generated CONTROL; retain actual endpoints and safe states, reject ambiguities. Propagate conversion explanation to UI.
- [x] Update A04: remove CONTROL instance/two external wires; add QF1:T1→FU1:F1-IN and QF1:T3→FU1:F2-IN; 28 physical, 6 external, 3 assembly wires. Route with the normal service, never stored geometry.
- [x] Replace the old dual-source demonstration with a shared-source two-drive example; update assertions to test independent drive states without independent power.
- [x] Verify complete real-runtime start/hold/stop/trip/reset, both fuse paths, QF1 loss/restore, S-phase missing, held-start exception, panel movement and roundtrip. Commit fixture/legacy changes.

## Task 4: integration, independent verification and release

Files: `src/revision.js`, user/architecture docs, CI workflow, browser QA, acceptance log.

- [ ] Run all tests, typecheck, build and offline export. Preserve baseline fixture hash. Verify new A04 through served and standalone browser entry points; screenshots are a separate visual gate, not silently substituted by Node tests.
- [ ] Use next revision WIRE-R14 (dependency already R13). Update examples and docs with single-source semantics and explicit unsupported scope.
- [ ] Publish a reviewed integrated commit with parents of current main and dependency; verify remote hashes, run CI, download verified artifacts. Do not overwrite concurrent work.
- [ ] Attempt existing Site update only through available authorized deployment action. If unavailable, deliver same-source offline HTML, project JSON, source/build artifact and exact deployment limitation; never claim the Site updated without deployment evidence.

## Review checklist

Map E01–E09 to task1; A01–A11/G01–G02 to tasks2–3; P01–P05/U01–U02 to tasks2–3; V01/build/source consistency to task4. Keep source names and controls instance-independent. Do not add an API for per-source switching to the new normal runtime.

## Execution checkpoint

Core, runtime, legacy and actual A04 reconstruction completed. Local full tests 174/174 and build passed. Local browser policy blocks navigation; remote CI and publication remain in Task 4. Existing Site project identity preserved.
