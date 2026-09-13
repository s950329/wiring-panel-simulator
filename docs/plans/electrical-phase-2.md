# Electrical Phase 2 Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` with TDD and independent read-only review. The Site owner alone edits the existing checkout; the existing GitHub/Site sync authorization applies.

**Goal:** Deliver stateful contactor feedback, self-hold and three-phase motor supply checks without adding incomplete simulation UI.

**Architecture:** Keep single-pass `evaluateCircuit()` pure. Add bounded simultaneous iteration and a session wrapper that retains only verified stable coil state. Describe a three-phase source as one source identity with three distinct poles; motor terminals remain loads, never ideal bridges.

**Tech Stack:** Existing strict TypeScript, Node test runner, tsx; no new dependencies.

**Spec:** Approved `wiring-panel-electrical-plan-v0.1.md`, sections 5.3 and Phase 2 / acceptance matrix; existing `docs/electrical-models.md` defines the explicit teaching assumptions.

## Global constraints

- Preserve endpoint IDs, geometry fixture, route rules, Site identity and audience. UI remains WIRE-R5 until Phase 3.
- No thermal/current/speed/torque or actual voltage-rating claims. TH20 TC/TA/TB remains the documented teaching SPDT assumption.
- No hard-coded recognition of a correct exercise or global prohibition on restarting. Results follow actual contacts and wires.
- No publishing a transient iteration as stable. Fault/unknown/oscillation/limit halt the session; reset clears only solver memory, never user input or wiring.
- Existing two-pole callers remain compatible. Optional three-phase/motor fields extend the data contract.

## Task 1: Stable feedback and session memory

Files: create `src/electrical/simulator.ts`, `qa/electrical-simulator-check.mjs`; extend diagnostic contracts only as needed.

- [ ] Write regressions for settled main/auxiliary contacts, self-hold release, missing hold wire, simultaneous two-coil propagation/order independence, own-NC oscillation, iteration limit and error latching.
- [ ] Run `node --import tsx --test qa/electrical-simulator-check.mjs`; observe failure before implementation.
- [ ] Implement `settleCircuit(circuit, inputs?, previousCoils?, options?)`. Default iteration bound 32; positive integer required. Start absent coil states false. Compute all next states from one evaluation, then compare sorted vectors. Only identical vectors return `{status:'stable', evaluation, coils, iterations, diagnostics}`. Error/repeated vector/limit returns `{status:'halted', reason, evaluation:null, coils:null, iterations, diagnostics}`.
- [ ] Implement `ElectricalSimulator.step(circuit, inputs?)` and `reset()`. Copy stable coil state internally; latch a halted result until reset. Each step receives a complete input snapshot; omitted controls use catalog defaults. Do not mutate caller data.
- [ ] Run focused tests and strict typecheck; commit coherent implementation after review/integration gates.

Core transition:

```ts
const evaluation = evaluateCircuit(circuit, {inputs, coils});
const next = Object.fromEntries(evaluation.loads.filter(l => l.kind === 'coil')
  .map(l => [l.component, l.state === 'energized']));
// Check evaluation errors first, then equality, repeated vector, and bound.
```

## Task 2: Three-phase sources and motor supply

Files: extend `contracts.ts`, `catalog.ts`, `netlist.ts`, `solver.ts`; create focused `power.ts` and `qa/electrical-power-check.mjs`.

- [ ] Add failing tests for direct three-phase supply, phase permutations, missing/duplicate phase, source off, mixed sources, wrong profile, phase shorts and load-mediated paths.
- [ ] Add optional `Circuit.threePhaseSources` (`id`, three endpoint `phases`, `profile`, `enabled`) and `ElectricalModel.motors` (`id`, three terminal IDs, `profile`). Add `Evaluation.motors` separately from two-terminal loads.
- [ ] Validate all declared terminals/IDs and source relationships. Three distinct phase rails belong to one source; do not model them as three conflicting two-pole sources.
- [ ] Motor is powered only when all three terminal nets directly receive distinct phases of the same compatible source. Return phase order as evidence, not a rotation/speed claim. Missing/duplicate phase remains a recognized unpowered motor while the control coil may stay energized; unsupported networks remain unknown.
- [ ] Detect shorts and cross-source rail conflicts across both source types. Do not classify load-mediated supply as normal or silently open when a closed unsupported path exists.
- [ ] Run phase tests, simulator tests and all existing pure electrical tests.

## Task 3: Direct-on-line sequence and handoff

Files: create `src/electrical/exercises.ts`, `qa/electrical-dol-check.mjs`; extend package scripts, architecture and electrical documentation.

- [ ] Define `directOnLineCircuit()` with explicit independent teaching control and main sources, PB3 start NO, PB5 stop NC, ES1 NC, FU1 control fuse, TH1 teaching NC, MC1 and AP1 hold contact, QF1 three-pole switch, TH1 power paths and M1 U/V/W.
- [ ] Before adding the factory, write sequence tests: ready → start → release/hold → stop; stop+start; emergency/reset; trip/reset; power loss/restore; missing hold/return; same-potential coil; main missing while coil energized; duplicate motor phase; main power isolated from control; bypassed TH demonstrates no global stop; IDs and wire order do not change outcomes.
- [ ] Run the complete test suite and production/offline build. Document exact control/main wire mapping, input snapshots, diagnostics and reset behavior. Retain existing source/geometry revisions because the UI does not yet import this core.
- [ ] Obtain independent read-only review, fix real findings with regressions, then commit/push GitHub and verify source-tree equality. Sync and publish the same tree/build to the existing Site; report that UI integration is the next phase.

## Scope review

Task 1 consumes existing `Circuit/Evaluation` and adds only feedback; Task 2 extends those data contracts compatibly and exercises them through Task 1; Task 3 integrates both with real teaching contact definitions. Source/motor contracts are authored electrical data, not inferred from 3D coordinates. UI-mode switching and browser interaction acceptance remain Phase 3–4 and are not claimed here.
