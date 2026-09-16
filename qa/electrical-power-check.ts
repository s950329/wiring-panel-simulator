import assert from 'node:assert/strict';
import test from 'node:test';
import {createTeachingComponent} from '../src/electrical/catalog.ts';
import type {Evaluation} from '../src/electrical/contracts.ts';
import {settleCircuit} from '../src/electrical/simulator.ts';
import {evaluateCircuit} from '../src/electrical/solver.ts';
import {mutableClone, required} from './helpers/fixture-types.ts';
const ep = (component: string, terminal: string) => ({ component, terminal });
const wire = (id: string, a: readonly [string, string], b: readonly [string, string]) => ({ id, from: ep(...a), to: ep(...b) });
const baseModel = () => required(mutableClone(createTeachingComponent({ id: 'S', definitionId: 'teaching-source' })).model);
const mainSource = (id: string) => ({ id, terminals: ['L1', 'L2', 'L3'], model: baseModel() });
const phases = (id: string): import('./helpers/fixture-types.ts').Mutable<import('../src/electrical/contracts.ts').ThreePhaseSource> => ({ id, phases: [ep(id,'L1'), ep(id,'L2'), ep(id,'L3')], profile: 'teaching-three-phase-v1', enabled: true });
function circuit(): ReturnType<typeof import('./helpers/fixture-types.ts').mutableCircuit> {
    return { components: [mainSource('MAIN'), { id: 'M1', terminals: ['U', 'V', 'W'], model: { ...baseModel(),
                    motors: [{ id: 'motor', terminals: ['U', 'V', 'W'], profile: 'teaching-three-phase-v1' }] } }], sources: [],
        threePhaseSources: [phases('MAIN')], wires: [wire('U', ['MAIN', 'L1'], ['M1', 'U']),
            wire('V', ['MAIN', 'L2'], ['M1', 'V']), wire('W', ['MAIN', 'L3'], ['M1', 'W'])] };
}
const motor = (r: Evaluation) => r.motors?.find((m: { component: string; }) => m.component === 'M1');
const has = (r: Evaluation, code: string) => r.diagnostics.some((d) => d.code === code);
test('motor requires three distinct compatible phases and reports terminal phase order', () => {
    const c = circuit(), before = structuredClone(c);
    const r = evaluateCircuit(c);
    assert.equal(r.status, 'ok');
    assert.equal(motor(r)?.state, 'powered');
    assert.deepEqual(required(motor(r)).phaseOrder, [0, 1, 2]);
    assert.deepEqual(required(motor(r)).sourceIds, ['MAIN']);
    assert.ok(has(r, 'RATING_UNVERIFIED'));
    assert.equal(has(r, 'SOURCE_SHORT'), false);
    for (const order of [[0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
        const reversed = { ...c, wires: c.wires.map((w, i) => ({ ...w, from: ep('MAIN', `L${order[i] + 1}`) })) };
        assert.equal(required(motor(evaluateCircuit(reversed))).state, 'powered');
        assert.deepEqual(required(motor(evaluateCircuit(reversed))).phaseOrder, order);
    }
    assert.deepEqual(c, before);
});
test('missing phase, duplicate phase, open motor and disabled source remain unpowered', () => {
    const c = circuit();
    const missing = evaluateCircuit({ ...c, wires: c.wires.slice(0, 2) });
    assert.equal(motor(missing)?.state, 'unpowered');
    assert.equal(required(motor(missing)).reason, 'missing-phase');
    assert.equal(missing.status, 'ok');
    assert.ok(has(missing, 'MOTOR_MISSING_PHASE'));
    const duplicate = evaluateCircuit({ ...c, wires: c.wires.map((w, i) => i === 1 ? { ...w, from: ep('MAIN', 'L1') } : w) });
    assert.equal(required(motor(duplicate)).reason, 'duplicate-phase');
    assert.ok(has(duplicate, 'MOTOR_DUPLICATE_PHASE'));
    assert.equal(has(duplicate, 'SOURCE_SHORT'), false);
    assert.equal(required(motor(evaluateCircuit({ ...c, wires: [] }))).reason, 'open');
    assert.equal(required(motor(evaluateCircuit({ ...c, threePhaseSources: [{ ...c.threePhaseSources[0], enabled: false }] }))).reason, 'source-off');
});
test('motor supply from multiple sources or a mismatched profile is not accepted', () => {
    const c = circuit();
    const mixed = { ...c, components: [...c.components, mainSource('SECOND')], threePhaseSources: [...c.threePhaseSources, phases('SECOND')],
        wires: c.wires.map(w => w.id === 'W' ? { ...w, from: ep('SECOND', 'L3') } : w) };
    const r = evaluateCircuit(mixed);
    assert.equal(r.status, 'unknown');
    assert.equal(required(motor(r)).reason, 'mixed-sources');
    const incompatible = evaluateCircuit({ ...c, threePhaseSources: [{ ...c.threePhaseSources[0], profile: 'other' }] });
    assert.equal(incompatible.status, 'unknown');
    assert.equal(required(motor(incompatible)).reason, 'incompatible-supply');
});
test('phase shorts and cross-source ideal-rail connections stop the whole evaluation', () => {
    const c = circuit();
    const shorted = evaluateCircuit({ ...c, wires: [...c.wires, wire('short', ['MAIN', 'L1'], ['MAIN', 'L2'])] });
    assert.equal(shorted.status, 'fault');
    assert.ok(has(shorted, 'SOURCE_SHORT'));
    assert.equal(required(motor(shorted)).state, 'fault');
    const conflict = evaluateCircuit({ ...c, components: [...c.components, mainSource('SECOND')],
        threePhaseSources: [...c.threePhaseSources, phases('SECOND')], wires: [...c.wires, wire('cross', ['MAIN', 'L1'], ['SECOND', 'L1'])] });
    assert.equal(conflict.status, 'fault');
    assert.ok(has(conflict, 'SOURCE_CONFLICT'));
    const control = mutableClone(createTeachingComponent({ id: 'CONTROL', definitionId: 'teaching-source' }));
    const overlap = evaluateCircuit({ ...c, components: [...c.components, control], sources: [{ id: 'CONTROL', a: ep('MAIN', 'L1'),
                b: ep('CONTROL', 'N'), profile: 'teaching-control-v1', enabled: true }] });
    assert.equal(overlap.status, 'fault');
    assert.ok(has(overlap, 'SOURCE_CONFLICT'));
});
test('a lamp in a motor phase is unsupported, not treated as a wire or an ordinary missing phase', () => {
    const c = circuit();
    const series = evaluateCircuit({ ...c, components: [...c.components, mutableClone(createTeachingComponent({ id: 'HL1', definitionId: 'lamp-white' }))],
        wires: [...c.wires.slice(0, 2), wire('phase-in', ['MAIN', 'L3'], ['HL1', '1']), wire('phase-out', ['HL1', '2'], ['M1', 'W'])] });
    assert.equal(series.status, 'unknown');
    assert.equal(required(motor(series)).reason, 'unsupported-series');
    assert.equal(series.loads[0].state, 'unknown');
    assert.equal(has(series, 'SOURCE_SHORT'), false);
});
test('two-terminal loads on undeclared phase-to-phase supplies are explicitly unsupported', () => {
    const c = circuit(), lamp = mutableClone(createTeachingComponent({ id: 'HL1', definitionId: 'lamp-white' }));
    const r = evaluateCircuit({ ...c, components: [...c.components, lamp], wires: [...c.wires,
            wire('a', ['MAIN', 'L1'], ['HL1', '1']), wire('b', ['MAIN', 'L2'], ['HL1', '2'])] });
    assert.equal(r.status, 'unknown');
    assert.equal(r.loads[0].state, 'unknown');
    assert.ok(has(r, 'UNSUPPORTED_SOURCE_NETWORK'));
});
test('an independently powered motor cannot turn a dangling same-rail branch into a series fault', () => {
    const c = circuit(), lamp = mutableClone(createTeachingComponent({ id: 'HL1', definitionId: 'lamp-white' }));
    const dangling = { ...c, components: [...c.components, lamp], wires: [c.wires[0],
            wire('lamp-in', ['MAIN', 'L1'], ['HL1', '1']), wire('lamp-out', ['HL1', '2'], ['M1', 'V'])] };
    const before = evaluateCircuit(dangling);
    assert.equal(before.status, 'ok');
    assert.equal(required(motor(before)).reason, 'missing-phase');
    const parallel = { ...dangling, components: [...dangling.components, { ...structuredClone(c.components[1]), id: 'M2' }],
        wires: [...dangling.wires, ...c.wires.map(w => ({ ...w, id: `parallel-${w.id}`, to: { ...w.to, component: 'M2' } }))] };
    const r = evaluateCircuit(parallel);
    assert.equal(r.status, 'ok');
    assert.deepEqual(motor(r), motor(before));
    assert.equal(required(r.motors.find(m => m.component === 'M2')).state, 'powered');
    assert.equal(r.loads[0].reason, 'open');
    assert.equal(settleCircuit(parallel).status, 'stable');
});
test('load-mediated motor connections between independent sources remain open without a return loop', () => {
    const c = circuit();
    const open = { ...c, components: [...c.components, mainSource('SECOND'),
            ...['HL1', 'HL2'].map(id => mutableClone(createTeachingComponent({ id, definitionId: 'lamp-white' })))],
        threePhaseSources: [...c.threePhaseSources, phases('SECOND')], wires: [
            wire('a-in', ['MAIN', 'L1'], ['HL1', '1']), wire('a-out', ['HL1', '2'], ['M1', 'U']),
            wire('b-in', ['SECOND', 'L1'], ['HL2', '1']), wire('b-out', ['HL2', '2'], ['M1', 'V'])
        ] };
    const r = evaluateCircuit(open);
    assert.equal(r.status, 'ok');
    assert.equal(required(motor(r)).reason, 'open');
    assert.ok(r.loads.every(l => l.reason === 'open'));
    assert.equal(settleCircuit(open).status, 'stable');
    // A second source-to-source branch really closes the unsupported multi-source loop.
    const closed = { ...open, components: [...open.components, mutableClone(createTeachingComponent({ id: 'HL3', definitionId: 'lamp-white' }))],
        wires: [...open.wires, wire('return-a', ['MAIN', 'L2'], ['HL3', '1']), wire('return-b', ['SECOND', 'L2'], ['HL3', '2'])] };
    assert.equal(evaluateCircuit(closed).status, 'unknown');
    assert.equal(required(motor(evaluateCircuit(closed))).reason, 'unsupported-series');
    assert.equal(settleCircuit(closed).status, 'halted');
});
test('two motors sharing an unsupplied terminal expose a genuine load-mediated path', () => {
    const c = circuit();
    const coupled = { ...c, components: [...c.components, { ...structuredClone(c.components[1]), id: 'M2' }],
        wires: [...c.wires.slice(0, 2), wire('parallel-U', ['MAIN', 'L1'], ['M2', 'U']),
            wire('parallel-V', ['MAIN', 'L2'], ['M2', 'V']), wire('floating-link', ['M1', 'W'], ['M2', 'W'])] };
    const r = evaluateCircuit(coupled);
    assert.equal(r.status, 'unknown');
    assert.ok(r.motors.every(m => m.reason === 'unsupported-series'));
    assert.equal(has(r, 'SOURCE_SHORT'), false);
    assert.equal(settleCircuit(coupled).status, 'halted');
});
test('three-phase declarations and motor terminal IDs are validated before power is reported', () => {
    const c = circuit();
    assert.equal(evaluateCircuit({ ...c, threePhaseSources: [{ ...c.threePhaseSources[0], phases: [ep('MAIN', 'L1'), ep('MAIN', 'L2'), ep('MAIN', 'missing')] }] }).status, 'unknown');
    assert.ok(has(evaluateCircuit({ ...c, threePhaseSources: [c.threePhaseSources[0], c.threePhaseSources[0]] }), 'DUPLICATE_ID'));
    const bad = structuredClone(c);
    required(required(bad.components[1].model).motors)[0].terminals[2] = 'missing';
    assert.ok(has(evaluateCircuit(bad), 'INVALID_ENDPOINT'));
    const repeated = structuredClone(c);
    required(required(repeated.components[1].model).motors)[0].terminals[2] = 'U';
    assert.ok(has(evaluateCircuit(repeated), 'INVALID_DEFINITION'));
});
test('phase results and diagnostics do not depend on component/wire order or direction', () => {
    const c = circuit();
    assert.deepEqual(evaluateCircuit({ ...c, components: [...c.components].reverse(), wires: [...c.wires].reverse().map(w => ({ ...w, from: w.to, to: w.from })) }), evaluateCircuit(c));
});
