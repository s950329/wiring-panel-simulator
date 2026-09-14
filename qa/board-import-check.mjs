import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {buildModel} from '../src/scene.js';
import {WiringController} from '../src/wiring/controller.js';
import {SimulationController} from '../src/application/simulation.ts';
import {createBoardSnapshot} from '../src/application/board-snapshot.ts';
import {importBoardSnapshot} from '../src/application/board-import.ts';

globalThis.document ??= {createElement: () => ({getContext: () => ({fillRect() {}, strokeRect() {}, fillText() {}})})};
const ep = (component, terminal) => ({component, terminal});
function make(inspectMC1 = false) {
  const m = buildModel(new T.Scene(), {inspectMC1});
  const routing = new WiringController(m.world, m.components);
  const simulation = inspectMC1 ? null : new SimulationController(m.components, () => routing.wires);
  return {...m, routing, simulation, page: inspectMC1 ? 'component' : 'board'};
}
function capture(m) {
  return createBoardSnapshot({components: m.components, physicalWires: m.routing.snapshot(), simulation: m.simulation,
    wiringSession: m.simulation ? {mode: 'connect', pending: null, busy: false, selectedWireId: m.routing.selected,
      evidenceIds: [], undoOrder: [...m.routing.wires.map(w => w.id), ...m.simulation.snapshot().externalWires.map(w => w.id)], lastAttempt: null} : null,
    view: {page: m.page, selectedComponent: 'MC1', selectedTerminal: 'A1', operationPanelOpen: m.flap.rotation.x > 1,
      attachmentsShown: true, gridVisible: true, camera: {azimuth: -.6, elevation: .8, radius: 680, target: [4, 0, 20]},
      worldTransform: {position: m.world.position.toArray(), quaternion: m.world.quaternion.toArray(), scale: m.world.scale.toArray()},
      panelAngle: m.flap.rotation.x}}, new Date('2026-09-13T16:00:00Z'));
}
const load = (snapshot, target) => importBoardSnapshot(JSON.stringify(snapshot), target);

test('exported board restores exact routes, IDs, persistent controls and source options, then remains editable', () => {
  const m = make(); m.flap.rotation.x = Math.PI;
  const first = m.routing.connect(ep('TB1', '41B'), ep('HL4', '1'));
  m.routing.connect(ep('TB1', '42B'), ep('HL4', '2')); m.routing.remove(first.id);
  m.simulation.connectExternal(ep('CONTROL', 'L'), ep('TB1', '41A'));
  m.simulation.connectExternal(ep('CONTROL', 'N'), ep('TB1', '42A')); m.simulation.removeExternal('E1');
  for (const [id, action] of [['QF1', {type: 'toggle'}], ['ES1', {type: 'emergency'}], ['TH1', {type: 'trip'}],
    ['TH1', {type: 'setCurrent', value: 16.5}], ['SA1', {type: 'setPosition', value: 2}], ['HL1', {type: 'lamp'}]]) m.components.get(id).dispatch(action);
  const snapshot = capture(m); snapshot.revision = 'WIRE-R8';
  snapshot.simulation.power.main = false;
  const target = make(); target.routing.connect(ep('MC1', 'A1'), ep('TB2', '1A'));
  const result = load(snapshot, target);
  assert.deepEqual(target.routing.snapshot(), snapshot.wiring.physical);
  assert.deepEqual(target.simulation.snapshot().externalWires, snapshot.wiring.external);
  assert.equal(target.components.get('ES1').state.latched, true);
  assert.equal(target.components.get('QF1').state.on, true);
  assert.equal(target.components.get('TH1').state.current, 16.5);
  assert.equal(target.components.get('TH1').state.trip, true);
  assert.equal(target.components.get('SA1').state.position, 2);
  assert.equal(target.components.get('HL1').parts.color.emissiveIntensity, 1.7);
  assert.equal(target.simulation.snapshot().power.main, false);
  assert.equal(target.flap.rotation.x, Math.PI); assert.deepEqual(result.view.camera.target, [4, 0, 20]);
  assert.equal(target.routing.connect(ep('TB1', '43B'), ep('HL3', '2')).id, 'W03');
  assert.equal(target.simulation.connectExternal(ep('CONTROL', 'L'), ep('TB1', '43A')).id, 'E3');
});

test('running and halted snapshots import stopped without replaying outputs or held inputs', () => {
  const m = make(); m.simulation.connectExternal(ep('CONTROL', 'L'), ep('HL4', '1'));
  m.simulation.connectExternal(ep('CONTROL', 'N'), ep('HL4', '2')); m.simulation.start();
  m.simulation.operate('PB1', {type: 'press'});
  const powered = capture(m), target = make(); load(powered, target);
  assert.equal(target.simulation.mode, 'off'); assert.equal(target.simulation.snapshot().result, null);
  assert.equal(target.components.get('HL4').electricalOutput.mode, 'off');
  assert.equal(target.components.get('HL4').parts.color.emissiveIntensity, 0);
  assert.equal(target.components.get('PB1').state.pressed, false);
  target.simulation.start(); assert.equal(target.components.get('HL4').electricalOutput.energized, true);
  target.simulation.stop(); m.simulation.stop(); m.simulation.connectExternal(ep('CONTROL', 'L'), ep('CONTROL', 'N')); m.simulation.start();
  load(capture(m), target); assert.equal(target.simulation.mode, 'off');
  assert.equal(target.simulation.start().status, 'halted');
});

test('invalid files and geometry failures preserve old state, routes, pose, mesh and electrical data', () => {
  const target = make(); target.routing.connect(ep('MC1', 'A1'), ep('TB2', '1A'));
  target.components.get('ES1').dispatch({type: 'emergency'});
  const source = make(); source.flap.rotation.x = Math.PI; source.routing.connect(ep('TB1', '42B'), ep('HL4', '2'));
  const snapshot = capture(source), before = capture(target), mesh = target.routing.group.children[0];
  const cases = [s => {s.schemaVersion = 99;}, s => {s.revision = 'WIRE-R999';}, s => {s.configuration.board.width = 999;},
    s => {s.components.pop();}, s => {s.components[0].placement.x += 1;}, s => {s.components[0].state.on = 'yes';},
    s => {s.wiring.physical[0].from.terminal = '999B';}, s => {s.wiring.physical.push(s.wiring.physical[0]);},
    s => {s.wiring.physical[0].points[0][1] += 3;}, s => {s.wiring.physical[0].points.splice(1, 0, [0, 0, 0]);},
    s => {s.wiring.physical[0].points[1][1] = 1e300;}, s => {s.view.camera.radius = -4;},
    s => {s.wiring.external = [{id: 'E1', from: ep('CONTROL', 'BAD'), to: ep('HL4', '1')}];}];
  for (const corrupt of cases) {
    const bad = structuredClone(snapshot); corrupt(bad); assert.throws(() => load(bad, target));
    assert.deepEqual(capture(target), before); assert.equal(target.routing.group.children[0], mesh);
  }
  assert.throws(() => importBoardSnapshot('{broken', target)); assert.deepEqual(capture(target), before);
});

test('import protects an active destination and rejects a different page while accepting an isolated snapshot', () => {
  const target = make(), snapshot = capture(target); target.simulation.start(); const before = capture(target);
  assert.throws(() => load(snapshot, target), /停止/); assert.deepEqual(capture(target), before);
  const isolated = make(true); isolated.components.get('TH1').dispatch({type: 'trip'});
  const single = capture(isolated), next = make(true); load(single, next);
  assert.equal(next.components.get('TH1').state.trip, true);
  target.simulation.stop(); assert.throws(() => load(single, target), /頁面|整盤|單獨/);
});

test('closed-panel geometry round trips and imported wires follow subsequent opening and closing', () => {
  const m = make(); m.flap.rotation.x = Math.PI;
  m.routing.connect(ep('TB1', '42B'), ep('HL4', '2'));
  const front = new Set([...m.components.values()].filter(c => c.root.parent === m.flap).map(c => c.id));
  m.routing.movePanel(() => {m.flap.rotation.x = 0;}, () => {m.flap.rotation.x = Math.PI;}, front);
  const snapshot = capture(m), target = make(); target.flap.rotation.x = Math.PI;
  load(snapshot, target);
  assert.equal(target.flap.rotation.x, 0); assert.deepEqual(target.routing.snapshot(), snapshot.wiring.physical);
  target.routing.movePanel(() => {target.flap.rotation.x = Math.PI;}, () => {target.flap.rotation.x = 0;}, front);
  target.routing.movePanel(() => {target.flap.rotation.x = 0;}, () => {target.flap.rotation.x = Math.PI;}, front);
  assert.equal(target.routing.wires[0].id, 'W01'); assert.deepEqual(target.routing.wires[0].to, ep('HL4', '2'));
});
