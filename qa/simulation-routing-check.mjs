import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {buildModel} from '../src/scene.js';
import {frontControls} from '../src/layout.ts';
import {WiringController} from '../src/wiring/controller.js';
import {SimulationController} from '../src/application/simulation.ts';
import {directOnLineCircuit} from '../src/electrical/exercises.ts';
globalThis.document ??= {createElement: () => ({width: 256, height: 256,
  getContext: () => ({fillRect() {}, strokeRect() {}, fillText() {}})})};

test('the complete teaching circuit routes on the actual board and edit guards preserve active topology', () => {
  const {world, components, flap} = buildModel(new T.Scene());
  const routing = new WiringController(world, components, {canEdit: () => s.canEdit});
  const s = new SimulationController(components, () => routing.wires);
  flap.rotation.x = Math.PI; world.updateMatrixWorld(true);
  for (const w of directOnLineCircuit().wires) {
    if (w.id.startsWith('contactor-')) continue;
    if (components.has(w.from.component) && components.has(w.to.component)) routing.connect(w.from, w.to);
    else s.connectExternal(w.from, w.to);
  }
  s.operate('QF1', {type: 'toggle'}); s.start(); s.operate('PB3', {type: 'press'}); s.operate('PB3', {type: 'release'});
  assert.equal(s.snapshot().result.evaluation.motors[0].state, 'powered');
  const topology = s.circuit().wires.map(w => ({id: w.id, from: w.from, to: w.to}));
  assert.throws(() => routing.remove(routing.wires[0].id), /停止/);
  assert.throws(() => routing.connect({component: 'PB1', terminal: '1'}, {component: 'PB2', terminal: '1'}), /停止/);
  routing.movePanel(() => {flap.rotation.x = 0; world.updateMatrixWorld(true);},
    () => {flap.rotation.x = Math.PI; world.updateMatrixWorld(true);}, new Set(frontControls.map(c => c.id)));
  s.refresh(); assert.equal(s.snapshot().result.evaluation.motors[0].state, 'powered');
  assert.deepEqual(s.circuit().wires.map(w => ({id: w.id, from: w.from, to: w.to})), topology);
  s.stop(); assert.equal(routing.remove(routing.wires[0].id), true);
});
