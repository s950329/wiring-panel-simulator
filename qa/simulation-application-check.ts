import {stateOf} from './helpers/fixture-types.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {locateEvidence} from '../src/application/evidence.ts';
import {SimulationController} from '../src/application/simulation.ts';
import {MomentaryOperations} from '../src/core/interactions.ts';
import {directOnLineCircuit} from '../src/electrical/exercises.ts';
import {traceEndpoint} from '../src/electrical/explanation.ts';
import {buildModel} from '../src/scene.ts';
import {mutableCircuit, required} from './helpers/fixture-types.ts';
if (!globalThis.document) Object.defineProperty(globalThis, 'document', {configurable: true, writable: true, value: { createElement: () => ({ width: 256, height: 256,
        getContext: () => ({ fillRect() { }, strokeRect() { }, fillText() { } }) }) }});
const external = new Set(['MAIN', 'CONTROL', 'M1']);
function make() {
    const model = buildModel(new T.Scene()), example = mutableCircuit(directOnLineCircuit());
    const wires = example.wires.filter(w => !external.has(w.from.component) && !external.has(w.to.component) && !w.id.startsWith('contactor-'));
    const simulation = new SimulationController(model.components, () => wires);
    for (const w of example.wires.filter(w => external.has(w.from.component) || external.has(w.to.component)))
        simulation.connectExternal(w.from, w.to);
    return { ...model, simulation, wires };
}
const motor = (s: SimulationController) => required(required(s.snapshot().result).evaluation).motors.find((m: { component: string; }) => m.component === 'M1');
const command = (s: SimulationController, id: string, type: Exclude<import('../src/core/contracts.ts').ComponentAction['type'], 'setPosition' | 'setCurrent'>) => { assert.equal(s.operate(id, { type }).accepted, true); };
test('actual component inputs drive settled views without changing manual coil state', () => {
    const { simulation: s, components } = make();
    command(s, 'QF1', 'toggle');
    assert.equal(s.start().status, 'stable');
    assert.equal(required(components.get('MC1')).pressed, false);
    command(s, 'PB3', 'press');
    assert.equal(required(components.get('MC1')).pressed, true);
    assert.equal(stateOf(required(components.get('MC1')), 'momentary').pressed, false);
    assert.equal(required(motor(s)).state, 'powered');
    required(components.get('HL4')).updateView(undefined, true);
    assert.ok(required(required(components.get('HL4')).parts.color).emissiveIntensity > 0);
    required(components.get('AP1')).updateView(components.get('MC1'), true);
    assert.equal(required(required(components.get('AP1')).parts.bridge).position.y, -3);
    command(s, 'PB3', 'release');
    assert.equal(required(components.get('MC1')).pressed, true);
    command(s, 'PB5', 'press');
    assert.equal(required(components.get('MC1')).pressed, false);
    assert.equal(required(motor(s)).state, 'unpowered');
});
test('starting clears demonstrations and stopping preserves wiring and latched controls', () => {
    const { simulation: s, components } = make();
    command(s, 'MC1', 'press');
    command(s, 'HL4', 'lamp');
    command(s, 'BZ1', 'buzzer');
    command(s, 'ES1', 'emergency');
    command(s, 'TH1', 'trip');
    const wires = s.circuit().wires;
    s.start();
    assert.equal(stateOf(required(components.get('MC1')), 'momentary').pressed, false);
    assert.equal(stateOf(required(components.get('HL4')), 'toggle').on, false);
    assert.equal(required(components.get('BZ1')).audible, false);
    for (const [id, type] of [['MC1', 'press'], ['HL4', 'lamp'], ['BZ1', 'buzzer']] as const) {
        assert.equal(s.operate(id, { type }).accepted, false);
        assert.equal(required(components.get(id)).present().controls.length, 0);
    }
    assert.ok(required(components.get('PB3')).present().controls.length);
    s.stop();
    assert.deepEqual(s.circuit().wires, wires);
    assert.equal(stateOf(required(components.get('ES1')), 'emergency').latched, true);
    assert.equal(stateOf(required(components.get('TH1')), 'overload').trip, true);
    assert.equal(required(components.get('MC1')).pressed, false);
    assert.ok(required(components.get('MC1')).present().controls.length);
});
test('external edits validate endpoints and lock until an active or halted session stops', () => {
    const { simulation: s } = make();
    const a = { component: 'CONTROL', terminal: 'L' }, b = { component: 'CONTROL', terminal: 'N' };
    assert.throws(() => s.connectExternal(a, a), /相同/);
    assert.throws(() => s.connectExternal(a, { component: 'PB3', terminal: 'missing' }), /端子/);
    const short = s.connectExternal(a, b);
    assert.throws(() => s.connectExternal(b, a), /已有/);
    assert.equal(s.start().status, 'halted');
    assert.equal(s.snapshot().mode, 'halted');
    assert.throws(() => s.removeExternal(short.id), /停止/);
    assert.throws(() => s.connectExternal(a, b), /停止/);
    assert.equal(s.start().status, 'halted');
    s.stop();
    assert.equal(s.removeExternal(short.id), true);
    assert.equal(s.start().status, 'stable');
});
test('source loss, emergency and overload reset retain real self-hold semantics', () => {
    const { simulation: s, components } = make();
    command(s, 'QF1', 'toggle');
    s.start();
    const start = () => { command(s, 'PB3', 'press'); command(s, 'PB3', 'release'); assert.equal(required(components.get('MC1')).pressed, true); };
    start();
    s.setPower('main', false);
    assert.equal(required(components.get('MC1')).pressed, true);
    assert.equal(required(motor(s)).state, 'unpowered');
    s.setPower('main', true);
    assert.equal(required(motor(s)).state, 'powered');
    s.setPower('control', false);
    s.setPower('control', true);
    assert.equal(required(components.get('MC1')).pressed, false);
    start();
    command(s, 'ES1', 'emergency');
    command(s, 'ES1', 'unlock');
    assert.equal(required(components.get('MC1')).pressed, false);
    start();
    command(s, 'TH1', 'trip');
    command(s, 'TH1', 'reset');
    assert.equal(required(components.get('MC1')).pressed, false);
});
test('assembly links are explicit and missing hold or motor phase is not hidden by the adapter', () => {
    const { simulation: s, components, wires } = make();
    assert.equal(s.snapshot().fixedWires.length, 3);
    assert.deepEqual(s.snapshot().fixedWires.map(w => [w.from.terminal, w.to.terminal]), [['2T1', '1/L1'], ['4T2', '3/L2'], ['6T3', '5/L3']]);
    wires.splice(wires.findIndex(w => w.id === 'hold-out'), 1);
    const phase = s.snapshot().externalWires.find(w => w.to.component === 'M1' && w.to.terminal === 'W');
    s.removeExternal(required(phase).id);
    command(s, 'QF1', 'toggle');
    s.start();
    command(s, 'PB3', 'press');
    assert.equal(required(components.get('MC1')).pressed, true);
    assert.equal(required(motor(s)).reason, 'missing-phase');
    command(s, 'PB3', 'release');
    assert.equal(required(components.get('MC1')).pressed, false);
});
test('panel pose and returned snapshots cannot mutate the electrical session', () => {
    const { simulation: s, flap, world } = make();
    command(s, 'QF1', 'toggle');
    s.start();
    command(s, 'PB3', 'press');
    command(s, 'PB3', 'release');
    const before = s.snapshot();
    flap.rotation.x = Math.PI;
    world.updateMatrixWorld(true);
    s.refresh();
    assert.deepEqual(required(s.snapshot().result).evaluation, required(before.result).evaluation);
    Object.assign(required(required(before.result).coils), {MC1:false});
    Object.assign(before.externalWires, {length:0});
    assert.equal(required(required(s.snapshot().result).coils).MC1, true);
    assert.ok(s.snapshot().externalWires.length);
});
test('fault evidence retains the evaluated source configuration until stop/edit/retry', () => {
    const { simulation: s } = make();
    const wire = s.connectExternal({ component: 'CONTROL', terminal: 'L' }, { component: 'CONTROL', terminal: 'N' });
    s.start();
    const snapshot = s.snapshot();
    assert.equal(required(snapshot.evaluatedCircuit).sources[0].enabled, true);
    assert.equal(s.circuit().sources[0].enabled, false);
    Object.assign(required(snapshot.evaluatedCircuit).wires, {length:0});
    assert.ok(required(s.snapshot().evaluatedCircuit).wires.some(w => w.id === wire.id));
    s.stop();
    assert.equal(s.snapshot().evaluatedCircuit, null);
    s.removeExternal(wire.id);
    s.start();
    assert.equal(required(s.snapshot().result).status, 'stable');
    assert.equal(required(s.snapshot().evaluatedCircuit).wires.some(w => w.id === wire.id), false);
});
test('locating while releasing a held button discards changed contact evidence but keeps equivalent reevaluations', () => {
    for (const holding of [false, true]) {
        const { simulation: s, components, wires } = make();
        if (!holding)
            wires.splice(wires.findIndex(w => w.id === 'hold-out'), 1);
        const momentary = new MomentaryOperations(() => { }, (c, action) => s.operate(c.id, action));
        command(s, 'QF1', 'toggle');
        s.start();
        momentary.begin(required(components.get('PB3')), { type: 'press' });
        const snapshot = s.snapshot();
        const trace = traceEndpoint(required(snapshot.evaluatedCircuit), required(required(snapshot.result).evaluation), { component: 'MC1', terminal: 'A1' });
        let highlighted;
        const current = locateEvidence(s, trace.wireIds, () => momentary.cancel(), ids => { highlighted = ids; });
        assert.equal(current, false);
        assert.equal(required(components.get('MC1')).pressed, holding);
        assert.deepEqual(highlighted, []);
    }
    // Re-evaluation can change iteration count without changing the evidence.
    const { simulation: s, components } = make();
    command(s, 'QF1', 'toggle');
    s.start();
    command(s, 'PB3', 'press');
    assert.equal(required(s.snapshot().result).iterations, 2);
    assert.equal(locateEvidence(s, ['start-coil'], () => s.refresh(), () => { }), true);
    assert.equal(required(s.snapshot().result).iterations, 1);
    assert.equal(required(components.get('MC1')).pressed, true);
});
test('all four lamps update the actual rendered lens material for manual, powered and source-off states', () => {
    const model = buildModel(new T.Scene()), s = new SimulationController(model.components, () => []);
    const lamps = ['HL1', 'HL2', 'HL3', 'HL4'].map(id => model.components.get(id));
    for (const c of lamps) {
        const meshes = [];
        required(c).root.traverse(o => { if (o instanceof T.Mesh && o.material === required(c).parts.color)
            meshes.push(o); });
        assert.ok(meshes.length >= 2, `${required(c).id} lens and dome must use the material being updated`);
        required(c).updateView(undefined, true);
        assert.equal(required(required(c).parts.color).emissiveIntensity, 0);
        command(s, required(c).id, 'lamp');
        required(c).updateView(undefined, true);
        assert.ok(required(required(c).parts.color).emissiveIntensity > 0);
        command(s, required(c).id, 'lamp');
        required(c).updateView(undefined, true);
        assert.equal(required(required(c).parts.color).emissiveIntensity, 0);
        s.connectExternal({ component: 'CONTROL', terminal: 'L' }, { component: required(c).id, terminal: '1' });
        s.connectExternal({ component: 'CONTROL', terminal: 'N' }, { component: required(c).id, terminal: '2' });
    }
    s.start();
    for (const c of lamps) {
        required(c).updateView(undefined, true);
        assert.ok(required(required(c).parts.color).emissiveIntensity > 0);
        assert.match(required(c).present().status, /供電亮燈/);
    }
    s.setPower('control', false);
    for (const c of lamps) {
        required(c).updateView(undefined, true);
        assert.equal(required(required(c).parts.color).emissiveIntensity, 0);
        assert.equal(stateOf(required(c), 'toggle').on, false);
    }
});
