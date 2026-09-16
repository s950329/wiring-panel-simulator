import {stateOf} from './helpers/fixture-types.ts';
import type {BoardViewState, WiringSessionState} from '../src/application/board-snapshot.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {createBoardSnapshot, snapshotDownload} from '../src/application/board-snapshot.ts';
import {SimulationController} from '../src/application/simulation.ts';
import {buildModel} from '../src/scene.ts';
import {WiringController} from '../src/wiring/controller.ts';
import {mutableClone, required} from './helpers/fixture-types.ts';
if (!globalThis.document) Object.defineProperty(globalThis, 'document', {configurable: true, writable: true, value: { createElement: () => ({ getContext: () => ({ fillRect() { }, strokeRect() { }, fillText() { } }) }) }});
const ep = (component: string, terminal: string) => ({ component, terminal });
const view: BoardViewState = { page: 'board', selectedComponent: 'HL4', selectedTerminal: '2', operationPanelOpen: true,
    attachmentsShown: true, gridVisible: true, camera: { azimuth: -1.5, elevation: .9, radius: 540, target: [120, 0, 150] },
    worldTransform: { position: [-400, 0, -320], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] }, panelAngle: Math.PI };
const session: WiringSessionState = { mode: 'connect', pending: ep('TB1', '42B'), busy: false, selectedWireId: null, evidenceIds: [], undoOrder: ['W01'],
    lastAttempt: { from: ep('TB1', '42B'), to: ep('HL4', '2'), status: 'failed', error: '找不到路徑', wireId: null } };
function make() {
    const model = buildModel(new T.Scene());
    model.flap.rotation.x = Math.PI;
    model.world.updateMatrixWorld(true);
    const routing = new WiringController(model.world, model.components), simulation = new SimulationController(model.components, () => routing.wires);
    return { ...model, routing, simulation };
}
const capture = (m: ReturnType<typeof make>, extras: Partial<Parameters<typeof createBoardSnapshot>[0]> = {}) => mutableClone(createBoardSnapshot({ components: m.components, physicalWires: m.routing.snapshot(),
    simulation: m.simulation, view, wiringSession: session, ...extras }, new Date('2026-09-13T15:30:00Z')));
test('snapshot JSON preserves physical routes, external links, actual component state and diagnostic UI context', () => {
    const m = make();
    m.routing.connect(ep('TB1', '41B'), ep('HL4', '1'));
    m.simulation.connectExternal(ep('CONTROL', 'N'), ep('TB1', '42A'));
    m.simulation.operate('ES1', { type: 'emergency' });
    m.simulation.operate('TH1', { type: 'trip' });
    m.simulation.setPower('main', false);
    const snapshot = capture(m);
    const decoded: ReturnType<typeof capture> = JSON.parse(JSON.stringify(snapshot));
    assert.equal(decoded.format, 'wiring-panel-snapshot');
    assert.equal(decoded.schemaVersion, 1);
    assert.deepEqual(decoded.wiring.physical, m.routing.snapshot());
    assert.deepEqual(decoded.wiring.external, m.simulation.snapshot().externalWires);
    assert.equal(decoded.wiring.fixed.length, 3);
    assert.deepEqual(required(required(decoded.wiring.session).lastAttempt).to, ep('HL4', '2'));
    assert.deepEqual(decoded.view.camera.target, [120, 0, 150]);
    assert.equal(decoded.view.operationPanelOpen, true);
    assert.equal(stateOf(required(decoded.components.find((c: { id: string; }) => c.id === 'ES1')), 'emergency').latched, true);
    assert.equal(stateOf(required(decoded.components.find((c: { id: string; }) => c.id === 'TH1')), 'overload').trip, true);
    const lamp = decoded.components.find((c: { id: string; }) => c.id === 'HL4');
    assert.equal(required(lamp).placement.definitionId, 'lamp-green');
    assert.equal(required(lamp).transform.parent, 'operation-panel');
    assert.deepEqual(required(lamp).terminals.map((t) => t.id), ['1', '2']);
    assert.equal(decoded.configuration.panelGateway.side, 'B');
    assert.equal(required(decoded.simulation).power.main, false);
    Object.assign(decoded.components[0].state, {on:true});
    decoded.wiring.physical[0].points.length = 0;
    assert.equal(stateOf(required(m.components.get('QF1')), 'toggle').on, false);
    assert.ok(m.routing.wires[0].points.length > 2);
    assert.deepEqual(snapshot, capture(m), 'capture has no effect on runtime state');
});
test('snapshot keeps energized and halted results separate from mechanical demonstration state', () => {
    const m = make();
    m.simulation.connectExternal(ep('CONTROL', 'L'), ep('HL4', '1'));
    m.simulation.connectExternal(ep('CONTROL', 'N'), ep('HL4', '2'));
    m.simulation.start();
    const powered = capture(m), lamp = powered.components.find(c => c.id === 'HL4');
    assert.equal(stateOf(required(lamp), 'toggle').on, false);
    assert.equal(required(lamp).electricalOutput.energized, true);
    assert.equal(required(required(powered.simulation).result).status, 'stable');
    assert.equal(required(required(powered.simulation).evaluatedCircuit).sources[0].enabled, true);
    m.simulation.stop();
    m.simulation.connectExternal(ep('CONTROL', 'L'), ep('CONTROL', 'N'));
    m.simulation.start();
    const halted = capture(m);
    assert.equal(required(halted.simulation).mode, 'halted');
    assert.equal(required(required(halted.simulation).result).evaluation, null);
    assert.ok(required(required(halted.simulation).result).diagnostics.some(d => d.code === 'SOURCE_SHORT'));
    assert.equal(required(required(halted.simulation).evaluatedCircuit).sources[0].enabled, true);
    assert.equal(required(halted.simulation).circuit.sources[0].enabled, false);
    assert.equal(required(halted.components.find(c => c.id === 'HL4')).electricalOutput.energized, null);
    m.simulation.stop();
    assert.equal(required(powered.simulation).mode, 'running');
    assert.equal(required(halted.simulation).mode, 'halted');
});
test('download payload is parseable JSON and supports an isolated component view without simulation', () => {
    const m = make();
    const snapshot = capture(m, { simulation: null, physicalWires: [], wiringSession: null, view: { ...view, page: 'component' } });
    const file = snapshotDownload(snapshot);
    assert.equal(file.mimeType, 'application/json');
    assert.match(file.filename, /^wiring-panel-WIRE-R\d+-2026-09-13T15-30-00-000Z\.json$/);
    assert.deepEqual(JSON.parse(file.content), snapshot);
    assert.equal(snapshot.simulation, null);
    assert.deepEqual(snapshot.wiring.external, []);
    assert.equal(snapshot.wiring.session, null);
});
