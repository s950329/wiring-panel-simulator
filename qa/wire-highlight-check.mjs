import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {buildModel} from '../src/scene.js';
import {WiringController} from '../src/wiring/controller.js';
import {frontControls} from '../src/layout.ts';

globalThis.document ??= {createElement: () => ({getContext: () => ({fillRect() {}, strokeRect() {}, fillText() {}})})};
function make() {
  const model = buildModel(new T.Scene()); model.flap.rotation.x = Math.PI; model.world.updateMatrixWorld(true);
  const routing = new WiringController(model.world, model.components);
  routing.connect({component: 'TB1', terminal: '41B'}, {component: 'HL4', terminal: '1'});
  routing.connect({component: 'TB1', terminal: '42B'}, {component: 'HL4', terminal: '2'});
  return {...model, routing};
}
const material = (r, id) => r.group.children.find(m => m.userData.wireId === id).material;
const difference = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);

test('selected wire has a contrasting colour and pulses while other wires stay subdued', () => {
  const {routing: r} = make(); r.select('W01'); const selected = material(r, 'W01'), other = material(r, 'W02'), before = r.snapshot();
  assert.ok(difference(selected.color, other.color) > .7); assert.ok(other.opacity < .3);
  const unselected = other.color.getHex(), samples = [];
  for (const time of [0, 200, 400, 600, 800]) {r.animateSelection(time); samples.push(selected.color.getHex()); assert.equal(other.color.getHex(), unselected);}
  assert.ok(new Set(samples).size > 1); assert.ok(selected.opacity >= .6, 'selected wire stays visible throughout the pulse');
  assert.deepEqual(r.snapshot(), before, 'highlighting never moves or changes wire data');
  r.select(null); r.animateSelection(1000);
  assert.equal(selected.color.getHex(), other.color.getHex()); assert.equal(selected.opacity, 1); assert.equal(other.opacity, 1);
});

test('reduced motion, evidence tracing and selection changes leave no stale flashing wire', () => {
  const {routing: r} = make(); r.select('W01');
  r.animateSelection(0, true); const steady = material(r, 'W01').color.getHex();
  r.animateSelection(400, true); assert.equal(material(r, 'W01').color.getHex(), steady);
  r.select('W02'); const old = material(r, 'W01').color.getHex(); r.animateSelection(200); r.animateSelection(400);
  assert.equal(material(r, 'W01').color.getHex(), old); assert.ok(material(r, 'W01').opacity < .3);
  r.trace(['W01']); const evidence = material(r, 'W01').color.getHex(); r.animateSelection(600);
  assert.equal(r.selected, null); assert.equal(material(r, 'W01').color.getHex(), evidence);
});

test('selection pulsing uses replacement meshes after moving the panel and stops after deletion', () => {
  const model = make(), r = model.routing; r.select('W01'); const oldMesh = r.group.children.find(m => m.userData.wireId === 'W01');
  r.movePanel(() => {model.flap.rotation.x = 0; model.world.updateMatrixWorld(true);},
    () => {model.flap.rotation.x = Math.PI; model.world.updateMatrixWorld(true);}, new Set(frontControls.map(c => c.id)));
  assert.equal(r.selected, 'W01'); assert.notEqual(r.group.children.find(m => m.userData.wireId === 'W01'), oldMesh);
  const samples = [];
  for (const t of [0, 200, 400]) {r.animateSelection(t); samples.push(material(r, 'W01').color.getHex());}
  assert.ok(new Set(samples).size > 1);
  r.remove('W01'); assert.equal(r.selected, null); r.animateSelection(800); assert.equal(material(r, 'W02').opacity, 1);
});
