import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {buildModel} from '../src/scene.js';
import {SimulationController} from '../src/application/simulation.ts';

globalThis.document ??= {createElement: () => ({getContext: () => ({fillRect() {}, strokeRect() {}, fillText() {}})})};
const luminance = color => .2126 * color.r + .7152 * color.g + .0722 * color.b;
const sample = c => {const m = c.parts.color; return {color: m.color.toArray(), emissive: m.emissive.toArray(),
  intensity: m.emissiveIntensity, roughness: m.roughness, clearcoat: m.clearcoat, environment: m.envMapIntensity};};

test('scene environment is bound to actual lamp materials so the renderer uses each lamp reflection intensity', () => {
  const scene = new T.Scene(); scene.environment = new T.Texture(); scene.environment.mapping = T.CubeUVReflectionMapping;
  scene.environment.isRenderTargetTexture = true; scene.environmentIntensity = .65;
  const {components} = buildModel(scene);
  for (const id of ['HL1', 'HL2', 'HL3', 'HL4']) {
    const c = components.get(id), material = c.parts.color;
    assert.equal(material.envMap, scene.environment, `${id} must not fall back to scene.environmentIntensity`);
    const off = material.envMapIntensity; c.dispatch({type: 'lamp'}); c.updateView(undefined, true);
    assert.ok(material.envMapIntensity > off); assert.equal(material.envMap, scene.environment);
  }
  assert.equal(components.get('PB1').parts.color.envMap, null, 'pushbutton material keeps the existing shared scene lighting');
});

test('each actual lamp lens is dark when idle and much brighter than all unlit neighbours when tested', () => {
  const {components} = buildModel(new T.Scene());
  const lamps = ['HL1', 'HL2', 'HL3', 'HL4'].map(id => components.get(id));
  const idle = lamps.map(sample);
  for (const c of lamps) {
    const m = c.parts.color, base = new T.Color(c.definition.color);
    assert.ok(luminance(m.color) < luminance(base) * .1, `${c.id} starts with a dark lens`);
    assert.equal(m.emissiveIntensity, 0); assert.ok(m.envMapIntensity < .25, 'room reflections cannot make an idle lens look lit');
    const meshes = []; c.root.traverse(o => {if (o.isMesh && o.material === m) meshes.push(o);}); assert.ok(meshes.length >= 2);
    c.dispatch({type: 'lamp'}); c.updateView(undefined, true);
    assert.ok(Math.max(m.color.r, m.color.g, m.color.b) >= .9, `${c.id} restores a vivid lit colour`);
    const light = luminance(m.color) + luminance(m.emissive) * m.emissiveIntensity;
    for (const neighbour of lamps.filter(other => other !== c)) {
      assert.deepEqual(sample(neighbour), idle[lamps.indexOf(neighbour)], 'testing one lamp leaves its neighbours dark');
      assert.ok(light > 10 * luminance(neighbour.parts.color.color), `${c.id} clearly exceeds ${neighbour.id}'s unlit material brightness`);
    }
    c.dispatch({type: 'lamp'}); c.updateView(undefined, true); assert.deepEqual(sample(c), idle[lamps.indexOf(c)]);
  }
});

test('a powered red lamp uses the bright style while yellow and green remain dark, then fully darkens on source loss', () => {
  const {components} = buildModel(new T.Scene()), simulation = new SimulationController(components, () => []);
  const red = components.get('HL3'), yellow = components.get('HL2'), green = components.get('HL4');
  const before = [red, yellow, green].map(sample);
  simulation.connectExternal({component: 'CONTROL', terminal: 'L'}, {component: 'HL3', terminal: '1'});
  simulation.connectExternal({component: 'CONTROL', terminal: 'N'}, {component: 'HL3', terminal: '2'});
  simulation.start(); for (const c of components.values()) c.updateView(undefined, true);
  assert.ok(red.parts.color.emissiveIntensity > 1.7); assert.equal(red.state.on, false);
  assert.deepEqual(sample(yellow), before[1]); assert.deepEqual(sample(green), before[2]);
  simulation.setPower('control', false); red.updateView(undefined, true); assert.deepEqual(sample(red), before[0]);
});
