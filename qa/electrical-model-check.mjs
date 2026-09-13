import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {buildModel} from '../src/scene.js';
import {placements, frontPlacements} from '../src/layout.ts';
import {createTeachingComponent, minimalControlCircuit} from '../src/electrical/catalog.ts';
import {evaluateCircuit} from '../src/electrical/solver.ts';
import {describeTerminal} from '../src/wiring/terminals.ts';

// Match the existing geometry-test canvas stub; no WebGL or browser is involved.
globalThis.document ??= {createElement: () => ({width: 256, height: 256,
  getContext: () => ({fillRect() {}, strokeRect() {}, fillText() {}})})};

test('electrical terminal inventories match all actual models and panel pose is not electrical state', () => {
  const {world, components, flap} = buildModel(new T.Scene());
  for (const placement of [...placements, ...frontPlacements]) {
    const electrical = createTeachingComponent(placement);
    assert.deepEqual([...electrical.terminals].sort(), components.get(placement.id).terminalDefinitions.map(t => t.id).sort(), placement.id);
  }
  const c = minimalControlCircuit(), endpoint = {component: 'PB1', terminal: '1'};
  const before = describeTerminal(world, components, endpoint).position;
  const result = evaluateCircuit(c, {inputs: {PB1: {pressed: true}}});
  flap.rotation.x = Math.PI; world.updateMatrixWorld(true);
  const after = describeTerminal(world, components, endpoint).position;
  assert.notDeepEqual(after, before);
  components.get('MC1').dispatch({type: 'press'});
  components.get('HL1').dispatch({type: 'lamp'});
  assert.deepEqual(evaluateCircuit(c, {inputs: {PB1: {pressed: true}}}), result);
});
