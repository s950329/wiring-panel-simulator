import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as T from 'three';
import {modelSnapshot} from './model-snapshot.mjs';
import {createComponent} from '../src/components.ts';
import {placements, frontPlacements} from '../src/layout.ts';
import {resolvePlacements} from '../src/catalog/resolve.ts';
import {MomentaryOperations, interactionAction, operate} from '../src/core/interactions.ts';
import {bindHoldControl} from '../src/views/inspector.ts';
import {describeTerminal} from '../src/wiring/terminals.ts';
const {buildModel} = await import('../src/scene.js');
const {world, components, flap} = buildModel(new T.Scene());
const c = id => components.get(id);
const act = (id, type, value) => c(id).dispatch(value === undefined ? {type} : {type, value});

// Captured before any refactor. A mesh reorder, missing terminal, or coordinate change is visible here.
test('original geometry and terminal transforms match the baseline after documented pose normalization', async () => {
  assert.deepEqual(await modelSnapshot(), JSON.parse(fs.readFileSync(new URL('./fixtures/model-baseline.json', import.meta.url), 'utf8')));
});
test('definitions are reusable, instances are independent, and state cannot be mutated', () => {
  const source = frontPlacements.find(p => p.id === 'PB1');
  const a = createComponent({...source, id: 'PB-A'}), b = createComponent({...source, id: 'PB-B'});
  assert.equal(a.definition, b.definition);
  const injected = createComponent({...source, behavior: 'lamp', color: 0, name: 'overridden'});
  assert.equal(injected.definition.behavior, 'button'); assert.equal(injected.def.color, a.def.color);
  assert.equal(injected.def.name, a.def.name);
  a.dispatch({type: 'press'});
  assert.equal(a.pressed, true); assert.equal(b.pressed, false);
  assert.throws(() => {a.state.pressed = false;}, TypeError);
  const before = a.serialize(); assert.equal(a.dispatch({type: 'trip'}).accepted, false);
  assert.deepEqual(a.serialize(), before);
  assert.equal(c('HL1').dispatch({type: 'press'}).accepted, false);
  assert.equal(c('SO1').dispatch({type: 'toggle'}).accepted, false);
  assert.equal(c('BZ1').dispatch({type: 'press'}).accepted, false);
});
test('product/placement serialization round trips and invalid references fail early', () => {
  const data = JSON.parse(JSON.stringify([...placements, ...frontPlacements]));
  assert.equal(resolvePlacements(data).length, 22);
  assert.equal(createComponent(data.find(p => p.id === 'MC1')).terminalDefinitions.length, 16);
  assert.throws(() => resolvePlacements([data[0], data[0]]), /重複/);
  assert.throws(() => createComponent({...data[0], definitionId: 'constructor'}), /規格/);
  assert.throws(() => createComponent({...data[0], x: NaN}), /座標/);
  assert.throws(() => resolvePlacements([{...data[0], parentId: 'missing'}]), /父元件/);
  assert.throws(() => resolvePlacements([{...data[0], parentId: data[1].id}, {...data[1], parentId: data[0].id}]), /循環/);
  for (const component of components.values()) for (const t of component.terminalDefinitions) {
    assert.equal(t.localPosition.length, 3); assert.equal(t.exitDirection.length, 3);
    assert.ok(Math.hypot(...t.exitDirection) > 0);
    assert.deepEqual(JSON.parse(JSON.stringify(t)), t);
  }
});
test('press/release drives contactors and the attached auxiliary without shared state', () => {
  const original = c('MC1').parts.plunger.position.y;
  act('MC1', 'press'); c('MC1').updateView(undefined, true); c('AP1').updateView(c('MC1'), true);
  assert.equal(c('MC1').parts.plunger.position.y, original - 7);
  assert.equal(c('AP1').parts.bridge.position.y, -3); assert.equal(c('MC2').pressed, false);
  c('MC1').release(); c('MC1').updateView(undefined, true); c('AP1').updateView(c('MC1'), true);
  assert.equal(c('MC1').parts.plunger.position.y, original); assert.equal(c('AP1').parts.bridge.position.y, 0);
});
test('latching, selector positions, and overload limits use their own state', () => {
  act('ES1', 'emergency'); c('ES1').release(); c('ES1').updateView(undefined, true);
  assert.equal(c('ES1').state.latched, true); assert.equal(c('ES1').parts.cap.rotation.y, -.24);
  act('ES1', 'unlock'); assert.equal(c('ES1').state.latched, false);
  act('SA1', 'setPosition', 2); const start = c('SA1').position;
  act('SA1', 'setPosition', start + Math.round(-35 / 35)); assert.equal(c('SA1').position, 1);
  act('SA1', 'setPosition', 9); c('SA1').updateView(undefined, true);
  assert.equal(c('SA1').position, 2); assert.equal(c('SA1').parts.knob.rotation.y, Math.PI / 4);
  act('SA1', 'selector'); assert.equal(c('SA1').position, 0);
  for (const [value, expected] of [[-1, 12], [15.3, 15.5], [99, 18]]) {act('TH1', 'setCurrent', value); assert.equal(c('TH1').current, expected);}
  act('TH1', 'current'); assert.equal(c('TH1').current, 12);
  act('TH1', 'trip'); c('TH1').updateView(undefined, true);
  assert.equal(c('TH1').parts.test.position.y, 46); assert.equal(c('TH1').parts.reset.position.y, 56);
  act('TH1', 'reset'); assert.equal(c('TH1').current, 12);
  const state = c('TH1').state; assert.throws(() => act('TH1', 'setCurrent', NaN), /有限/); assert.equal(c('TH1').state, state);
});
test('breaker, cover synchronization, wire guard, and lamp view remain coherent', () => {
  act('QF1', 'toggle'); c('QF1').updateView(undefined, true); assert.equal(c('QF1').parts.lever.position.z, -10);
  const before = c('FU1').state;
  assert.equal(operate(c('FU1'), {type: 'fuseCover'}, {canMoveCover: () => false}).accepted, false);
  assert.equal(c('FU1').state, before);
  operate(c('FU1'), {type: 'fuseCover'}, {canMoveCover: () => true});
  c('FU1').syncRoutingPose();
  assert.equal(c('FU1').parts.cover1.rotation.x, -1.3); assert.equal(c('FU1').parts.cover2.rotation.x, -1.3);
  assert.deepEqual(c('FU1').state, {kind: 'cover', open: true});
  act('HL1', 'lamp'); c('HL1').updateView(undefined, true);
  assert.equal(c('HL1').parts.color.emissiveIntensity, 1.7);
  assert.deepEqual(c('AP1').parts.bridge.userData.routingMotion, {axis: 1, range: [-3, 0]});
  assert.deepEqual(c('QF1').parts.lever.userData.routingMotion, {axis: 2, range: [-10, 8]});
});
class Button extends EventTarget {setPointerCapture() {}}
const emit = (target, type, props = {}) => target.dispatchEvent(Object.assign(new Event(type, {cancelable: true}), props));
test('hold controls release on cancellation/capture loss/blur and ignore keyboard repeat', () => {
  const sound = [], session = new MomentaryOperations(on => sound.push(on));
  session.begin(c('PB1'), {type: 'release'}); session.begin(c('PB1'), {type: 'press'});
  assert.equal(c('PB1').pressed, true); session.cancel();
  const button = new Button();
  bindHoldControl(button, () => session.begin(c('BZ1'), {type: 'buzzer'}), () => session.end(c('BZ1')));
  for (const cancel of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) {
    emit(button, 'pointerdown', {button: 0, pointerId: 1}); assert.equal(c('BZ1').audible, true);
    emit(button, cancel); assert.equal(c('BZ1').audible, false); assert.equal(sound.at(-1), false);
  }
  emit(button, 'keydown', {code: 'Space', repeat: false}); const count = sound.length;
  emit(button, 'keydown', {code: 'Space', repeat: true}); assert.equal(sound.length, count);
  emit(button, 'keyup', {code: 'KeyX'}); assert.equal(c('BZ1').pressed, true);
  emit(button, 'keyup', {code: 'Space'}); assert.equal(c('BZ1').pressed, false);
  act('ES1', 'emergency'); session.begin(c('PB1'), {type: 'press'}); session.begin(c('MC1'), {type: 'press'});
  session.begin(c('BZ1'), {type: 'buzzer'}); session.cancel();
  assert.ok(['PB1','MC1','BZ1'].every(id => !c(id).pressed)); assert.equal(c('ES1').state.latched, true);
});
test('terminal routing directions remain local and transformed endpoints follow assemblies', () => {
  flap.rotation.x = Math.PI; world.updateMatrixWorld(true);
  assert.deepEqual(c('SO1').terminals.find(t => t.id === '11').definition.exitDirection, [-1,0,0]);
  const endpoint = {component: 'PB1', terminal: '1'};
  const before = describeTerminal(world, components, endpoint);
  flap.rotation.x = 0;
  const after = describeTerminal(world, components, endpoint);
  assert.notDeepEqual(after.position, before.position); assert.notDeepEqual(after.heading, before.heading);
  assert.throws(() => describeTerminal(world, components, {component: 'MC1', terminal: 'missing'}), /找不到端子/);
  assert.equal(interactionAction('setCurrent', NaN), undefined); assert.equal(interactionAction('unknown'), undefined);
});
