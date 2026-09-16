import assert from 'node:assert/strict';
import test from 'node:test';
import {createTeachingComponent, minimalControlCircuit} from '../src/electrical/catalog.ts';
import type {Diagnostic} from '../src/electrical/contracts.ts';
import {ElectricalSimulator, settleCircuit} from '../src/electrical/simulator.ts';
import {evaluateCircuit} from '../src/electrical/solver.ts';
import {mutableCircuit, mutableClone, required} from './helpers/fixture-types.ts';
const ep = (component: string, terminal: string) => ({ component, terminal });
const wire = (id: string, a: readonly [string, string], b: readonly [string, string]) => ({ id, from: ep(...a), to: ep(...b) });
const pressed = { PB1: { pressed: true } };
const withHold = () => {
    const c = mutableCircuit(minimalControlCircuit());
    return { ...c, components: [...c.components, mutableClone(createTeachingComponent({ id: 'AP1', definitionId: 'shihlin-ap22', parentId: 'MC1' }))],
        wires: [...c.wires, wire('hold-in', ['PB1', '3'], ['AP1', '53']), wire('hold-out', ['AP1', '54'], ['PB1', '2'])] };
};
const closed = (r: import('../src/electrical/simulator.ts').SimulationResult, component: string, id: string) => required(required(r.evaluation).contacts.find((c) => c.component === component && c.id === id)).closed;
test('settling publishes matching coil and contact states, not the first transient evaluation', () => {
    const c = mutableCircuit(minimalControlCircuit()), before = structuredClone(c);
    const off = settleCircuit(c);
    assert.equal(off.status, 'stable');
    assert.deepEqual(off.coils, { MC1: false });
    const on = settleCircuit(c, pressed);
    assert.equal(on.status, 'stable');
    assert.deepEqual(on.coils, { MC1: true });
    assert.equal(on.iterations, 2);
    assert.equal(closed(on, 'MC1', 'main-1'), true);
    assert.deepEqual(on.evaluation, evaluateCircuit(c, { inputs: pressed, coils: on.coils }));
    assert.deepEqual(c, before);
});
test('self-hold memory depends on the wired AP contact and survives only with that path', () => {
    const sim = new ElectricalSimulator(), c = withHold();
    assert.equal(required(sim.step(c).coils).MC1, false);
    const started = sim.step(c, pressed);
    assert.equal(required(started.coils).MC1, true);
    // Returned data cannot overwrite the session's last stable state.
    Object.assign(required(started.coils), {MC1:false});
    assert.equal(required(sim.step(c).coils).MC1, true);
    assert.equal(required(sim.step({ ...c, wires: c.wires.filter(w => w.id !== 'hold-out') }).coils).MC1, false);
    assert.equal(required(sim.step(c).coils).MC1, false);
});
test('multiple coils update simultaneously and settle independently of array order', () => {
    const c = mutableCircuit(minimalControlCircuit());
    c.components.push(mutableClone(createTeachingComponent({ id: 'MC2', definitionId: 'shihlin-sp16' })), mutableClone(createTeachingComponent({ id: 'AP1', definitionId: 'shihlin-ap22', parentId: 'MC1' })));
    c.wires.push(wire('aux-feed', ['SUPPLY', 'L'], ['AP1', '53']), wire('second', ['AP1', '54'], ['MC2', 'A1']), wire('second-return', ['MC2', 'A2'], ['SUPPLY', 'N']));
    const r = settleCircuit(c, pressed);
    assert.equal(r.status, 'stable');
    assert.deepEqual(r.coils, { MC1: true, MC2: true });
    assert.equal(r.iterations, 3);
    assert.deepEqual(settleCircuit({ ...c, components: [...c.components].reverse(), wires: [...c.wires].reverse() }, pressed), r);
});
test('own NC feedback is detected as oscillation with no partial state published', () => {
    const c = withHold();
    c.wires = [wire('feed', ['SUPPLY', 'L'], ['AP1', '61']), wire('coil', ['AP1', '62'], ['MC1', 'A1']),
        wire('return', ['MC1', 'A2'], ['SUPPLY', 'N'])];
    const r = settleCircuit(c);
    assert.equal(r.status, 'halted');
    assert.equal(r.reason, 'oscillation');
    assert.equal(r.coils, null);
    assert.equal(r.evaluation, null);
    assert.equal(r.iterations, 2);
    assert.ok(r.diagnostics.some(d => d.code === 'OSCILLATION'));
});
test('iteration limit rejects an unverified transient result and validates its bound', () => {
    const c = mutableCircuit(minimalControlCircuit());
    const r = settleCircuit(c, pressed, {}, { maxIterations: 1 });
    assert.equal(r.status, 'halted');
    assert.equal(r.reason, 'iteration-limit');
    assert.equal(r.coils, null);
    assert.equal(settleCircuit(c, pressed, {}, { maxIterations: 2 }).status, 'stable');
    for (const maxIterations of [0, -1, 1.5, Infinity, NaN])
        assert.throws(() => settleCircuit(c, pressed, {}, { maxIterations }), RangeError);
});
test('source fault halts the session until reset, which does not change wires or inputs', () => {
    const c = withHold(), sim = new ElectricalSimulator();
    assert.equal(required(sim.step(c, pressed).coils).MC1, true);
    const shorted = { ...c, wires: [...c.wires, wire('short', ['SUPPLY', 'L'], ['SUPPLY', 'N'])] };
    const r = sim.step(shorted, pressed);
    assert.equal(r.status, 'halted');
    assert.equal(r.reason, 'circuit-fault');
    assert.equal(r.coils, null);
    assert.deepEqual(sim.step(c), r);
    const before = structuredClone(c);
    sim.reset();
    assert.equal(required(sim.step(c).coils).MC1, false);
    assert.deepEqual(c, before);
    // A physically held start input really can restart: no global anti-restart shortcut.
    sim.reset();
    assert.equal(required(sim.step(c, pressed).coils).MC1, true);
});
test('invalid previous state and unsupported series halt instead of converting unknown coils to false', () => {
    const c = mutableCircuit(minimalControlCircuit());
    const bad = settleCircuit(c, {}, { UNKNOWN: true });
    assert.equal(bad.status, 'halted');
    assert.ok(bad.diagnostics.some(d => d.code === 'INVALID_INPUT'));
    const series = { ...c, components: [...c.components, mutableClone(createTeachingComponent({ id: 'HL1', definitionId: 'lamp-white' }))],
        wires: [...c.wires.slice(0, 2), wire('series', ['MC1', 'A2'], ['HL1', '1']), wire('return', ['HL1', '2'], ['SUPPLY', 'N'])] };
    const r = settleCircuit(series, pressed);
    assert.equal(r.status, 'halted');
    assert.equal(r.reason, 'unsupported');
    assert.equal(r.evaluation, null);
    assert.equal(r.coils, null);
});
