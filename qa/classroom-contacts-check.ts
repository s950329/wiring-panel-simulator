import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import * as T from 'three';
import {HemisphereCamera} from '../src/camera.ts';
import {createTeachingComponent} from '../src/electrical/catalog.ts';
import type {Diagnostic, Netlist} from '../src/electrical/contracts.ts';
import {buildNetlist} from '../src/electrical/netlist.ts';
import {settleCircuit} from '../src/electrical/simulator.ts';
import type {ProjectDocument} from '../src/project/contracts.ts';
import {createProjectRuntime} from '../src/project/runtime.ts';
import {mutableCircuit, mutableClone, required} from './helpers/fixture-types.ts';
if (!globalThis.document) Object.defineProperty(globalThis, 'document', {configurable: true, writable: true, value: { createElement: () => ({ getContext: () => ({ fillRect() { }, strokeRect() { }, fillText() { } }) }) }});
const board: ProjectDocument = JSON.parse(readFileSync(new URL('./fixtures/board-024-classroom.project.json', import.meta.url), 'utf8'));
const part = (id: string, definitionId: string) => mutableClone(createTeachingComponent({ id, definitionId }));
const same = (r: Netlist, id: string, a: string, b: string) => r.nets.some((n) => n.endpoints.some((e) => e.component === id && e.terminal === a) && n.endpoints.some((e) => e.component === id && e.terminal === b));
test('each APS-11 lower pair closes with its own coil, upper pair opens, and the four contact circuits remain isolated', () => {
    for (const active of [false, true]) {
        const c = { components: [part('K', 'shihlin-sp16')], wires: [], sources: [] };
        const r = buildNetlist(c, { coils: { K: active } });
        for (const side of ['L', 'R']) {
            assert.equal(same(r, 'K', `${side}-B-L`, `${side}-F-L`), active);
            assert.equal(same(r, 'K', `${side}-B-U`, `${side}-F-U`), !active);
            assert.equal(same(r, 'K', `${side}-B-U`, `${side}-B-L`), false);
        }
        assert.equal(same(r, 'K', 'L-B-L', 'R-B-L'), false);
        assert.equal(same(r, 'K', 'L-B-U', 'R-B-U'), false);
    }
});
test('all classroom button variants use same-side NO 2/3 and NC 1/4, with no diagonal conducting pair', () => {
    for (const color of ['yellow', 'teal', 'green', 'red-sticker', 'red'])
        for (const pressed of [false, true]) {
            const r = buildNetlist({ components: [part('renamed', `button-${color}`)], wires: [], sources: [] }, { inputs: { renamed: { pressed } } });
            assert.equal(same(r, 'renamed', '2', '3'), pressed, color);
            assert.equal(same(r, 'renamed', '1', '4'), !pressed, color);
            assert.equal(same(r, 'renamed', '1', '2'), false);
            assert.equal(same(r, 'renamed', '3', '4'), false);
        }
});
test('reset-view left/right button terminals carry the matching electrical labels without moving the original wire endpoints', () => {
    const runtime = createProjectRuntime(board);
    try {
        required(runtime.flap).rotation.x = Math.PI;
        runtime.world.updateMatrixWorld(true);
        const camera = new T.PerspectiveCamera(40, 1, 1, 5000), orbit = new HemisphereCamera(camera);
        orbit.preset('perspective');
        for (const id of ['PB3', 'PB5']) {
            const terms = required(runtime.components.get(id)).terminals.map(t => ({ ...t, sx: t.object.getWorldPosition(new T.Vector3()).project(camera).x }));
            const middle = terms.reduce((s, t) => s + t.sx, 0) / 4;
            const left = terms.filter(t => t.sx < middle), right = terms.filter(t => t.sx > middle);
            assert.deepEqual(left.map(t => t.id).sort(), ['2', '3']);
            assert.deepEqual(right.map(t => t.id).sort(), ['1', '4']);
            assert.ok(left.every(t => t.group === 'NO' && required(t.displayName).includes('常開')));
            assert.ok(right.every(t => t.group === 'NC' && required(t.displayName).includes('常閉')));
        }
    }
    finally {
        runtime.dispose();
    }
});
test('original classroom control wires start, hold, stop and trip through MC1 sides without AP1 or automatic supply', () => {
    const runtime = createProjectRuntime(board);
    let c;
    try {
        c = mutableCircuit(runtime.simulation.circuit());
    }
    finally {
        runtime.dispose();
    }
    c.wires = [...board.connections.map((w, i) => ({ ...w, id: `original-${i}` })), ...c.wires];
    for (const s of required(c.threePhaseSources))
        s.enabled = true;
    assert.equal(board.connections.length, 22);
    assert.equal(c.wires.some(w => [w.from, w.to].some(e => e.component === 'AP1')), false);
    const inputs = { QF1: { on: true }, PB3: { pressed: false }, PB5: { pressed: false }, TH1: { tripped: false } };
    const run = (patch = {}, previous = {}) => { const r = settleCircuit(c, { ...inputs, ...patch }, previous); assert.equal(r.status, 'stable', JSON.stringify(r.diagnostics)); return r; };
    const missingSupply = run({ PB3: { pressed: true } });
    assert.equal(missingSupply.coils.MC1, false);
    for (const phase of ['L1', 'L2', 'L3'])
        c.wires.push({ id: `supply-${phase}`, from: { component: 'MAIN', terminal: phase }, to: { component: 'QF1', terminal: phase } });
    const lit = (r: ReturnType<typeof run>, id: string) => required(required(r.evaluation).loads.find(l => l.component === id)).state === 'energized';
    const idle = run(), start = run({ PB3: { pressed: true } }), hold = run({}, start.coils);
    const stop = run({ PB5: { pressed: true } }, hold.coils), both = run({ PB3: { pressed: true }, PB5: { pressed: true } }, hold.coils);
    const trip = run({ TH1: { tripped: true } }, hold.coils), reset = run({}, trip.coils);
    const powerOff = run({ QF1: { on: false } }, hold.coils), powerRestored = run({}, powerOff.coils);
    for (const r of [start, hold]) {
        assert.equal(r.coils.MC1, true);
        assert.equal(lit(r, 'HL4'), true);
        assert.equal(lit(r, 'HL3'), false);
        assert.equal(lit(r, 'BZ1'), false);
    }
    for (const r of [idle, stop, both, trip, reset, powerOff, powerRestored]) {
        assert.equal(r.coils.MC1, false);
        assert.equal(lit(r, 'HL4'), false);
    }
    assert.equal(lit(trip, 'HL3'), true);
    assert.equal(lit(trip, 'BZ1'), true);
});
test('classroom project imports all original control endpoints, remains stopped and drives the actual controller with its fixed supply', async () => {
    const { buildProject } = await import('../src/project/session.ts');
    const source = readFileSync(new URL('../examples/board-024-classroom.project.json', import.meta.url), 'utf8');
    const p = JSON.parse(source);
    assert.deepEqual(p.connections.slice(0, 22), board.connections);
    assert.equal(p.connections.length, 22);
    assert.equal(p.configuration.fixedConnections.length, 3);
    const { runtime } = await buildProject(source);
    try {
        assert.equal(runtime.panelOpen, false);
        assert.equal(runtime.simulation.mode, 'off');
        assert.deepEqual(runtime.exportProject().connections, p.connections);
        assert.equal(runtime.simulation.start().status, 'stable');
        const lit = (id: string) => required(required(required(runtime.simulation.snapshot().result).evaluation).loads.find(l => l.component === id)).state === 'energized';
        const operate = (id: string, type: 'toggle' | 'press' | 'release' | 'trip' | 'reset') => assert.equal(runtime.simulation.operate(id, { type }).accepted, true);
        assert.equal(lit('HL4'), false);
        operate('QF1', 'toggle');
        assert.equal(lit('HL4'), false);
        operate('PB3', 'press');
        assert.equal(lit('HL4'), true);
        operate('PB3', 'release');
        assert.equal(lit('HL4'), true);
        operate('PB5', 'press');
        assert.equal(lit('HL4'), false);
        operate('PB5', 'release');
        assert.equal(lit('HL4'), false);
        operate('PB3', 'press');
        operate('PB3', 'release');
        operate('TH1', 'trip');
        assert.equal(lit('HL4'), false);
        assert.equal(lit('HL3'), true);
        assert.equal(lit('BZ1'), true);
        operate('TH1', 'reset');
        assert.equal(lit('HL4'), false);
        assert.equal(lit('HL3'), false);
        assert.equal(lit('BZ1'), false);
        operate('PB3', 'press');
        operate('PB3', 'release');
        operate('QF1', 'toggle');
        assert.equal(lit('HL4'), false);
        operate('QF1', 'toggle');
        assert.equal(lit('HL4'), false);
    }
    finally {
        runtime.dispose();
    }
});
