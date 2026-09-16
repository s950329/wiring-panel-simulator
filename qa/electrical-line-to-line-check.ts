import assert from 'node:assert/strict';
import test from 'node:test';
import {createTeachingComponent, TEACHING_PROFILE, THREE_PHASE_PROFILE} from '../src/electrical/catalog.ts';
import type {Evaluation} from '../src/electrical/contracts.ts';
import {explainSimulation} from '../src/electrical/explanation.ts';
import {settleCircuit} from '../src/electrical/simulator.ts';
import {evaluateCircuit} from '../src/electrical/solver.ts';
import {mutableClone, required} from './helpers/fixture-types.ts';
const ep = (component: string, terminal: string) => ({ component, terminal });
const wire = (id: string, from: readonly [string, string], to: readonly [string, string]) => ({ id, from: ep(...from), to: ep(...to) });
const pair = (a: number, b: number, profile = TEACHING_PROFILE): import('./helpers/fixture-types.ts').Mutable<import('../src/electrical/contracts.ts').LineToLineCapability> => ({ phaseIndices: [a, b], profile });
const component = (id: string, definitionId: string) => mutableClone(createTeachingComponent({ id, definitionId }));
function circuit(indices = [0, 2]): ReturnType<typeof import('./helpers/fixture-types.ts').mutableCircuit> {
    return { components: [component('FEED', 'teaching-three-phase-source'), component('LIGHT', 'lamp-green')], sources: [],
        threePhaseSources: [{ id: 'FEED-SUPPLY', phases: [ep('FEED','L1'), ep('FEED','L2'), ep('FEED','L3')], profile: THREE_PHASE_PROFILE, enabled: true,
                lineToLine: [pair(0, 1), pair(0, 2), pair(1, 2)] }],
        wires: indices.map((phase, i) => wire(`lamp-${i}`, ['FEED', `L${phase + 1}`], ['LIGHT', String(i + 1)])) };
}
const has = (r: Pick<Evaluation, 'diagnostics'>, code: string) => r.diagnostics.some((d) => d.code === code);
for (const indices of [[0, 1], [0, 2], [1, 2]])
    test(`E01 phase pair ${indices} powers a compatible load without a second source`, () => {
        const c = circuit(indices), before = structuredClone(c), r = evaluateCircuit(c);
        assert.equal(r.status, 'ok');
        assert.equal(r.loads[0].state, 'energized');
        assert.deepEqual(r.loads[0].sourceIds, ['FEED-SUPPLY']);
        assert.deepEqual(r.loads[0].supplyEvidence, { kind: 'line-to-line', sourceId: 'FEED-SUPPLY', phaseIndices: indices });
        assert.notEqual(r.loads[0].nets[0], r.loads[0].nets[1]);
        assert.equal(has(r, 'SOURCE_CONFLICT'), false);
        assert.deepEqual(c, before);
        const reverse = { ...c, wires: c.wires.map(w => ({ ...w, from: w.to, to: w.from })) };
        assert.deepEqual(evaluateCircuit(reverse), r);
        const swap = circuit([...indices].reverse());
        assert.equal(evaluateCircuit(swap).loads[0].state, 'energized');
    });
test('E02 no capability, empty capability or unlisted pair retains the unsupported behavior', () => {
    for (const declaration of [undefined, [], [pair(0, 1)]]) {
        const c = circuit();
        c.threePhaseSources[0].lineToLine = declaration;
        const r = evaluateCircuit(c);
        assert.equal(r.loads[0].state, 'unknown');
        assert.ok(has(r, 'UNSUPPORTED_SOURCE_NETWORK'));
    }
});
test('E03 malformed capabilities are rejected even when the source is disabled', () => {
    const invalid = [null, {}, 'all', [null], [{}], [{ phaseIndices: [0], profile: TEACHING_PROFILE }],
        [pair(0, 0)], [pair(0, 3)], [pair(-1, 1)], [pair(0, .5)], [pair(2, 0)],
        [pair(0, 1, '')], [pair(0, 1, '   ')], [pair(0, 1), pair(0, 1)],
        [pair(0, 1), pair(0, 2), pair(1, 2), pair(0, 1)]];
    for (const declaration of invalid)
        for (const enabled of [true, false]) {
            const c = circuit();
            Object.assign(c.threePhaseSources[0], { lineToLine: declaration, enabled });
            const r = evaluateCircuit(c);
            assert.equal(r.status, 'unknown', JSON.stringify(declaration));
            assert.ok(has(r, 'INVALID_DEFINITION'), JSON.stringify(declaration));
        }
});
test('E04 declared pair with incompatible profile is not energized', () => {
    const c = circuit();
    c.threePhaseSources[0].lineToLine = [pair(0, 2, 'different-voltage-profile')];
    const r = evaluateCircuit(c);
    assert.equal(r.loads[0].reason, 'incompatible-supply');
    assert.ok(has(r, 'INCOMPATIBLE_SUPPLY'));
});
test('E05 same phase on both load terminals is not a supply and creates no short by itself', () => {
    const r = evaluateCircuit(circuit([0, 0]));
    assert.equal(r.status, 'ok');
    assert.equal(r.loads[0].reason, 'same-potential');
    assert.equal(has(r, 'SOURCE_SHORT'), false);
});
test('E06 phase short halts rather than publishing partial energized output', () => {
    const c = circuit();
    c.wires.push(wire('short', ['FEED', 'L1'], ['FEED', 'L3']));
    const r = settleCircuit(c);
    assert.equal(r.status, 'halted');
    assert.equal(r.evaluation, null);
    assert.ok(has(r, 'SOURCE_SHORT'));
});
test('E07 independent source sharing any original rail is still a source conflict', () => {
    const c = circuit();
    c.components.push(component('OTHER', 'teaching-source'));
    c.sources.push({ id: 'OTHER-SUPPLY', a: ep('OTHER', 'L'), b: ep('OTHER', 'N'), profile: TEACHING_PROFILE, enabled: true });
    c.wires.push(wire('cross-source', ['FEED', 'L1'], ['OTHER', 'L']));
    const r = evaluateCircuit(c);
    assert.equal(r.status, 'fault');
    assert.ok(has(r, 'SOURCE_CONFLICT'));
});
test('E08 series phase-pair loads remain unsupported, dangling branches remain open', () => {
    const c = circuit();
    c.components.push(component('SECOND', 'lamp-red'));
    c.wires = [wire('feed', ['FEED', 'L1'], ['LIGHT', '1']), wire('series', ['LIGHT', '2'], ['SECOND', '1']), wire('return', ['SECOND', '2'], ['FEED', 'L3'])];
    const r = evaluateCircuit(c);
    assert.equal(r.status, 'unknown');
    assert.ok(has(r, 'UNSUPPORTED_SERIES'));
    c.wires.pop();
    const open = evaluateCircuit(c);
    assert.equal(open.status, 'ok');
    assert.ok(open.loads.every(l => l.state === 'unpowered'));
});
test('E09 a phase-pair lamp and three-phase motor retain one source and distinct motor phase requirements', () => {
    const c = circuit();
    c.components.push(component('MOTOR', 'teaching-motor'));
    c.wires.push(...['U', 'V', 'W'].map((t, i) => wire(`motor-${i}`, ['FEED', `L${i + 1}`], ['MOTOR', t])));
    const r = evaluateCircuit(c);
    assert.equal(r.status, 'ok');
    assert.equal(r.loads[0].state, 'energized');
    assert.equal(r.motors[0].state, 'powered');
    assert.deepEqual(r.motors[0].sourceIds, ['FEED-SUPPLY']);
    c.wires = c.wires.filter(w => w.id !== 'motor-1');
    const missing = evaluateCircuit(c);
    assert.equal(missing.loads[0].state, 'energized');
    assert.equal(missing.motors[0].reason, 'missing-phase');
});
test('phase capability inherits source availability without creating derived live sources', () => {
    const c = circuit();
    c.threePhaseSources[0].enabled = false;
    const r = evaluateCircuit(c);
    assert.equal(r.status, 'ok');
    assert.equal(r.loads[0].reason, 'source-off');
    assert.equal(r.loads[0].supplyEvidence, undefined);
});
test('phase evidence explains the actual source and pair without inventing CONTROL', () => {
    const c = circuit(), r = settleCircuit(c);
    assert.equal(r.status, 'stable');
    const e = explainSimulation(c, r).find(x => x.endpoints.some(p => p.component === 'LIGHT'));
    assert.match(required(e).detail, /FEED/);
    assert.match(required(e).detail, /L1.*L3/);
    assert.doesNotMatch(required(e).detail, /CONTROL/);
});
test('malformed sparse phase indices never become a partially defined supply pair', () => {
    const c = circuit();
    Object.assign(c.threePhaseSources[0], {lineToLine:[{phaseIndices:new Array(2),profile:TEACHING_PROFILE}]});
    const r = evaluateCircuit(c);
    assert.equal(r.status, 'unknown');
    assert.ok(has(r, 'INVALID_DEFINITION'));
});
