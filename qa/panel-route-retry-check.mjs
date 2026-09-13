import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {buildModel} from '../src/scene.js';
import {WiringController} from '../src/wiring/controller.js';
import {frontControls} from '../src/layout.ts';
import {describeTerminal, validateSelf} from '../src/wiring/router.js';
import {CollisionWorld} from '../src/wiring/collision.js';
import {collectSolids} from '../src/wiring/solids.js';

globalThis.document ??= {createElement: () => ({getContext: () => ({fillRect() {}, strokeRect() {}, fillText() {}})})};
const endpoint = (component, terminal) => ({component, terminal});
const front = new Set(frontControls.map(c => c.id));
function make() {
  const model = buildModel(new T.Scene()); model.flap.rotation.x = Math.PI; model.world.updateMatrixWorld(true);
  return {...model, routing: new WiringController(model.world, model.components)};
}
function assertClear(model) {
  const solids = collectSolids(model.world);
  for (const wire of model.routing.wires) {
    assert.ok(validateSelf(wire.points), `${wire.id} must not fold back onto itself`);
    assert.ok(new CollisionWorld(solids, model.routing.wires.filter(w => w !== wire)).validate(wire.points), `${wire.id} must clear solids and other wires`);
    assert.deepEqual(wire.viaDucts, []); assert.ok(wire.points.every(p => p[2] >= 517));
    for (const [end, point] of [[wire.from, wire.points[0]], [wire.to, wire.points.at(-1)]])
      assert.ok(describeTerminal(model.world, model.components, end).anchors.some(p => Math.hypot(...p.map((v, i) => v - point[i])) < .002));
  }
}
function move(model, open) {
  const previous = model.flap.rotation.x;
  model.routing.movePanel(() => {model.flap.rotation.x = open ? Math.PI : 0; model.world.updateMatrixWorld(true);},
    () => {model.flap.rotation.x = previous; model.world.updateMatrixWorld(true);}, front);
}

test('different-height panel terminals try another turn instead of folding onto their own lead', () => {
  for (const reverse of [false, true]) {
    const model = make(), ends = [endpoint('BZ1', '2'), endpoint('HL4', '2')];
    const wire = model.routing.connect(...(reverse ? ends.reverse() : ends)); assertClear(model);
    for (const open of [false, true]) {move(model, open); assertClear(model);}
    assert.deepEqual(model.routing.wires[0].from, wire.from); assert.deepEqual(model.routing.wires[0].to, wire.to);
  }
});

// Reproduces the reported generic route failure with 42B still unused and a single existing HL4:2 lead.
const surrounding = [
  ['PB4','3','TB1','12B'], ['TB1','44B','BZ1','1'], ['PB2','1','TB1','27B'], ['BZ1','2','TB1','19B'],
  ['TB1','7B','ES1','1'], ['PB1','2','TB1','13B'], ['PB2','4','TB1','45B'], ['PB4','2','TB1','17B'],
  ['PB1','3','TB1','43B'], ['PB3','4','TB1','31B'], ['TB1','13B','PB4','2'], ['TB1','5B','PB1','1'],
  ['PB2','4','TB1','36B'], ['HL1','2','TB1','14B'], ['PB3','3','TB1','35B'], ['TB1','21B','BZ1','1'],
  ['HL4','2','TB1','31B'], ['SA1','1','TB1','23B'], ['HL1','2','TB1','45B'], ['SA1','1','TB1','11B'],
  ['HL2','2','TB1','41B'], ['ES1','2','TB1','32B'],
];
test('unused TB1:42B connects to HL4:2 amid existing panel wiring without rerouting other wires', () => {
  const model = make();
  for (const [a, at, b, bt] of surrounding) model.routing.connect(endpoint(a, at), endpoint(b, bt));
  const before = model.routing.snapshot(); assertClear(model);
  assert.equal(before.some(w => [w.from, w.to].some(e => e.component === 'TB1' && e.terminal === '42B')), false);
  const target = model.routing.connect(endpoint('TB1', '42B'), endpoint('HL4', '2'));
  assert.deepEqual(model.routing.snapshot().slice(0, -1), before); assertClear(model);
  assert.equal(model.routing.remove(target.id), true);
  model.routing.connect(target.to, target.from); assertClear(model);
});

test('TB1:42B to HL4:2 keeps its shared terminal connections when the panel moves', () => {
  const model = make();
  model.routing.connect(endpoint('HL4', '2'), endpoint('TB1', '31B'));
  model.routing.connect(endpoint('TB1', '42B'), endpoint('HL4', '2')); assertClear(model);
  const topology = model.routing.wires.map(w => ({id: w.id, from: w.from, to: w.to}));
  for (const open of [false, true]) {move(model, open); assertClear(model);}
  assert.deepEqual(model.routing.wires.map(w => ({id: w.id, from: w.from, to: w.to})), topology);
});
