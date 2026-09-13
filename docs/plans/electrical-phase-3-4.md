# Electrical Phase 3–4 Implementation Plan

> **For agentic workers:** Execute with `superpowers:executing-plans` and TDD. The Site owner alone edits the existing checkout. Independent reviewers remain read-only. Finish each phase before starting the next; run final E2E after both.

**Goal:** Let users wire, energize, operate and diagnose the existing board using the verified electrical core.

**Architecture:** An application adapter reads actual component inputs and wire endpoints, owns the simulation session and publishes a separate electrical view output. The UI exposes explicit external source/motor cards. Diagnostic explanations consume solver evidence, never infer electrical state from geometry or recognize a standard answer.

**Tech Stack:** Existing strict TypeScript, Three.js, Node tests and tsx; native DOM UI. Browser E2E uses the supported supervised preview.

**Spec:** Approved `wiring-panel-electrical-plan-v0.1.md`, sections 4, 5.4, Phase 3–4 and acceptance matrix; `docs/electrical-models.md` documents teaching assumptions.

## Global constraints

- Keep all existing component/terminal IDs, geometry baseline, routes, Site identity and audience.
- New external devices are clearly labelled teaching cards, with visible endpoint connections; no invented 3D hardware or voltage ratings.
- Register the three displayed MC/TH assembly links explicitly from their supported placement relationship; show them as fixed teaching connections. Never derive them from mesh contact.
- Stop before editing wires. Stopping clears electrical outputs and transient input, preserving wires, emergency latch and overload trip. Starting clears manual coil/lamp/buzzer demonstrations.
- Active simulation disables manual contactor/lamp/buzzer demonstrations, but retains real pushbutton, emergency, breaker, selector and overload controls.
- Unknown, fault, oscillation or iteration limit publishes no partial electrical output. Retry requires stopping/resetting the session.
- Every phase has a focused commit after its tests pass. Publish the complete verified application to the existing Site only; website/offline export share the revision.

## Phase 3: application and view integration

Files: `src/application/simulation.ts`, `src/application/equipment.ts`, `src/views/simulation-panel.ts`; existing component contracts/view, interactions, main and wiring panel/controller; `qa/simulation-application-check.mjs`.

- [ ] Write and run failing application tests for `SimulationController.start()`, `stop()`, `refresh()`, `operate(id, action)`, `connectExternal(from, to)`, `removeExternal(id)` and `snapshot()` against real component instances.
- [ ] Implement input mapping and explicit equipment/source/assembly declarations. `circuit()` contains physical user wires, external user links and declared fixed links only. External edits validate endpoints, duplicate/self links and mode before mutation.
- [ ] Add `ElectricalOutput` and `setElectricalOutput()` to component runtime. `pressed`, `audible`, lamp view and auxiliary view use settled output while simulation is active; mechanical `state` remains independent. Filter demonstration controls in `present()`.
- [ ] Test start/release/hold/stop and emergency/overload/power events using actual component actions. Assert `MC1.state.pressed === false` while its simulated `pressed === true`, correct lamp output, and independent M1 result.
- [ ] Add source/motor endpoint cards, start/stop and main/control supply switches, load state, connection selection and visible fixed-assembly list. Keep current terminal picking and physical route validation.
- [ ] Guard all wire edits, pending asynchronous routing, Delete/undo and mode switching while active. Preserve the electrical result during panel/camera geometry changes.
- [ ] Run `npm test` and `npm run build`, independently review the integration, fix findings, and commit Phase 3 before Phase 4 edits.

## Phase 4: evidence and recovery

Files: `src/electrical/explanation.ts`, simulation panel, main/scene/wiring highlight hooks, `qa/electrical-explanation-check.mjs`, documentation.

- [ ] Write failing tests for powered paths, open contacts, same-potential coil, missing motor phases, unknown terminals, short circuits and non-convergence. Explanations carry endpoint arrays and wire IDs obtained from actual netlist edges.
- [ ] Implement `explainSimulation(circuit, result)` and source/endpoint tracing. For open loads, report provable disconnected endpoints and open contacts bordering the reached net; do not claim one unique root cause when several are possible.
- [ ] Render Chinese explanations and endpoint focus controls. Locating evidence must not create a wire. Highlight source connectivity and explicit conducting paths without current-direction animations.
- [ ] Verify halted output, stop/edit/retry, power restoration and independent emergency/TH reset. Add readable teaching limitations and a concise manual exercise connection table.
- [ ] Run all core, application, geometry and route tests plus production/offline build; review and commit Phase 4.

## Final E2E and delivery

- [ ] Start the approved supervised preview, read browser capabilities and exercise real UI controls from terminal picking through simulation. Verify normal DOL, missing hold/phase, emergency/overload reset, source off/on, edit guards, panel movement and diagnostics.
- [ ] Inspect desktop/mobile layout and browser errors; use read-only visible state as evidence. Do not substitute Node results for WebGL acceptance. If infrastructure prevents any required case, record the exact outstanding case truthfully.
- [ ] Fix source defects, rerun affected E2E and complete regression/build gates. Verify matching website/offline source revision.
- [ ] Push focused commits to canonical GitHub, verify source tree, push identical source to the existing Site, package validated build, deploy and confirm terminal success. Report only the actual verified scope.
