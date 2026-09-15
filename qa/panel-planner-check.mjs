import assert from 'node:assert/strict';
import test from 'node:test';
import {panelBacksideGeometry} from './helpers/panel-space-oracle.mjs';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {createProjectRuntime} from '../src/project/runtime.ts';
import {buildProject} from '../src/project/session.ts';
import {readProject} from '../src/project/legacy.ts';
import {defaultProject} from '../src/project/default-project.ts';
import {collectSolids} from '../src/wiring/solids.js';
import {CollisionWorld} from '../src/wiring/collision.js';
import {describeTerminal, routeWire, validateSelf} from '../src/wiring/router.js';
globalThis.document ??= {createElement: () => ({getContext: () => ({fillRect() {}, strokeRect() {}, fillText() {}})})};

const endpoint = (component, terminal) => ({component, terminal});
const connection = ([a, at, b, bt]) => ({from: endpoint(a, at), to: endpoint(b, bt)});
const uploaded = JSON.parse(readFileSync(new URL('./fixtures/panel-closure-11.project.json', import.meta.url), 'utf8'));
const classroom = JSON.parse(readFileSync(new URL('../examples/board-024-classroom.project.json', import.meta.url), 'utf8'));
const r8 = defaultProject();
r8.configuration.operationPanel.state.open = true;
r8.connections = [
  ['PB4','3','TB1','12B'], ['TB1','44B','BZ1','1'], ['PB2','1','TB1','27B'], ['BZ1','2','TB1','19B'],
  ['TB1','7B','ES1','1'], ['PB1','2','TB1','13B'], ['PB2','4','TB1','45B'], ['PB4','2','TB1','17B'],
  ['PB1','3','TB1','43B'], ['PB3','4','TB1','31B'], ['TB1','13B','PB4','2'], ['TB1','5B','PB1','1'],
  ['PB2','4','TB1','36B'], ['HL1','2','TB1','14B'], ['PB3','3','TB1','35B'], ['TB1','21B','BZ1','1'],
  ['HL4','2','TB1','31B'], ['SA1','1','TB1','23B'], ['HL1','2','TB1','45B'], ['SA1','1','TB1','11B'],
  ['HL2','2','TB1','41B'], ['ES1','2','TB1','32B'], ['TB1','42B','HL4','2'],
].map(connection);

function fresh(source) {
  const project = readProject(JSON.stringify(source)).project;
  project.connections = [];
  project.configuration.operationPanel.state.open = true;
  return createProjectRuntime(project);
}

function geometry(runtime, label = '') {
  panelBacksideGeometry(runtime,label);
  const solids = collectSolids(runtime.world), accepted = [];
  for (const wire of runtime.routing.wires) {
    assert.ok(validateSelf(wire.points), `${label}: ${wire.id} intersects itself`);
    assert.ok(new CollisionWorld(solids, accepted).validate(wire.points), `${label}: ${wire.id} violates physical clearance`);
    for (const [end, point] of [[wire.from, wire.points[0]], [wire.to, wire.points.at(-1)]]) {
      const anchors = describeTerminal(runtime.world, runtime.components, end).anchors;
      assert.ok(anchors.some(p => Math.hypot(...p.map((n, i) => n - point[i])) < .002), `${label}: ${wire.id} detached from ${end.component}:${end.terminal}`);
    }
    // This fixture uses the stock B-side gateway for every panel/cabinet link.
    if (runtime.front.has(wire.from.component) || runtime.front.has(wire.to.component)) {
      assert.deepEqual(wire.viaDucts, [], `${label}: ${wire.id} crosses into cabinet ducts`);
      assert.ok(wire.points.every(p => p[2] >= 517 - 1e-6), `${label}: ${wire.id} leaves the panel side`);
    }
    accepted.push(wire);
  }
  assert.equal(runtime.routing.group.children.length, runtime.routing.wires.length, `${label}: mesh count`);
  assert.deepEqual(new Set(runtime.routing.group.children.map(m => m.userData.wireId)), new Set(runtime.routing.wires.map(w => w.id)), `${label}: mesh IDs`);
}

function identities(runtime) {
  return runtime.routing.wires.map(({id, from, to}) => ({id, from, to}));
}

function poses(runtime, label) {
  const topology = identities(runtime), exported = runtime.exportProject().connections;
  const selected = runtime.routing.selected, sequence = runtime.routing.sequence;
  for (const open of [false, true]) {
    runtime.movePanel(open);
    assert.equal(runtime.panelOpen, open, label);
    assert.equal(runtime.flap.rotation.x, open ? Math.PI : 0, label);
    geometry(runtime, `${label}/${open ? 'open' : 'closed'}`);
    assert.deepEqual(identities(runtime), topology, `${label}: preserve wire identity and endpoint direction`);
    assert.deepEqual(runtime.exportProject().connections, exported, `${label}: preserve exported insertion order`);
    assert.equal(runtime.routing.selected, selected, `${label}: preserve selection`);
    assert.equal(runtime.routing.sequence, sequence, `${label}: preserve sequence`);
  }
}

const variants = {
  original: wires => structuredClone(wires),
  reverse: wires => structuredClone(wires).reverse(),
  // Deterministic permutation plus both terminal directions. No random CI cases.
  interleaved: wires => [...wires.filter((_, i) => i % 2), ...wires.filter((_, i) => !(i % 2))]
    .map(({from, to}, i) => i % 2 ? {from: {...from}, to: {...to}} : {from: {...to}, to: {...from}}),
};

for (const [name, source] of [['uploaded-11', uploaded], ['classroom-22', classroom], ['R8-full-23', r8]]) {
  for (const [order, permute] of Object.entries(variants)) {
    test(`${name} ${order}: every accepted prefix operates in both poses`, () => {
      const runtime = fresh(source), wires = permute(source.connections), expected = [];
      try {
        for (const [index, wire] of wires.entries()) {
          runtime.connect(wire.from, wire.to);
          expected.push(wire);
          assert.deepEqual(runtime.exportProject().connections, expected);
          poses(runtime, `${name}/${order}/prefix-${index + 1}`);
        }
      } finally {runtime.dispose();}
    });
  }

  test(`${name}: repeated cycles, delete/reconnect and closed project round trip retain the full topology`, async () => {
    const runtime = fresh(source);
    let restored;
    try {
      for (const wire of source.connections) runtime.connect(wire.from, wire.to);
      for (let cycle = 0; cycle < 3; cycle++) poses(runtime, `${name}/cycle-${cycle}`);
      // Exercise a shared panel terminal, not an unrelated last cabinet lead.
      const selected = runtime.routing.wires.find(w => [w.from, w.to].some(e => e.component === (name === 'R8-full-23' ? 'PB2' : 'PB5')));
      assert.ok(selected);
      const oldIds = identities(runtime).filter(w => w.id !== selected.id);
      assert.equal(runtime.remove(selected.id), true);
      poses(runtime, `${name}/deleted`);
      const replacement = runtime.connect(selected.to, selected.from);
      assert.notEqual(replacement.id, selected.id);
      assert.deepEqual(identities(runtime).filter(w => w.id !== replacement.id), oldIds);
      poses(runtime, `${name}/reconnected`);
      runtime.movePanel(false);
      const exported = runtime.exportProject();
      ({runtime: restored} = await buildProject(JSON.stringify(exported)));
      assert.deepEqual(restored.exportProject(), exported);
      geometry(restored, `${name}/restored-closed`);
      poses(restored, `${name}/restored`);
    } finally {restored?.dispose(); runtime.dispose();}
  });
}

function blockedTerminal() {
  // Closed PB5:1 is [486,13,599]; opened PB5:1 is [486,91,675].
  // Cover every closed anchor without obstructing the opened counterpart.
  const box = new T.Mesh(new T.BoxGeometry(50, 50, 50), new T.MeshBasicMaterial());
  box.position.set(486, 13, 599);
  return box;
}

test('a new wire that cannot operate in the opposite pose is rejected atomically', () => {
  const runtime = fresh(uploaded), obstacle = blockedTerminal();
  try {
    const existing = runtime.connect(endpoint('QF1','T1'), endpoint('FU1','F1-IN'));
    poses(runtime, 'existing cabinet wire');
    runtime.routing.select(existing.id);
    const before = runtime.routing.snapshot(), exported = runtime.exportProject();
    const meshes = [...runtime.routing.group.children], sequence = runtime.routing.sequence;
    runtime.world.add(obstacle);
    assert.throws(() => runtime.connect(endpoint('PB5','1'), endpoint('TB1','45B')), /淨空|路徑|規劃|搜尋/);
    assert.equal(runtime.panelOpen, true);
    assert.equal(runtime.flap.rotation.x, Math.PI);
    assert.deepEqual(runtime.routing.snapshot(), before);
    assert.deepEqual(runtime.exportProject(), exported);
    assert.deepEqual(runtime.routing.group.children, meshes);
    assert.equal(runtime.routing.sequence, sequence);
    assert.equal(runtime.routing.selected, existing.id);
    runtime.world.remove(obstacle);
    runtime.connect(endpoint('PB5','1'), endpoint('TB1','45B'));
    poses(runtime, 'accepted after real obstruction removed');
  } finally {runtime.world.remove(obstacle); obstacle.geometry.dispose(); obstacle.material.dispose(); runtime.dispose();}
});

test('cached feasible poses are revalidated against new physical obstacles, with full movement rollback', () => {
  const runtime = fresh(uploaded), obstacle = blockedTerminal();
  try {
    for (const wire of uploaded.connections) runtime.connect(wire.from, wire.to);
    poses(runtime, 'prime both feasible poses');
    const before = runtime.routing.snapshot(), exported = runtime.exportProject();
    const meshes = [...runtime.routing.group.children], sequence = runtime.routing.sequence, selected = runtime.routing.selected;
    runtime.world.add(obstacle);
    assert.throws(() => runtime.movePanel(false), /淨空|路徑|規劃|搜尋/);
    assert.equal(runtime.flap.rotation.x, Math.PI);
    assert.equal(runtime.panelOpen, true);
    assert.deepEqual(runtime.routing.snapshot(), before);
    assert.deepEqual(runtime.exportProject(), exported);
    assert.deepEqual(runtime.routing.group.children, meshes);
    assert.equal(runtime.routing.sequence, sequence);
    assert.equal(runtime.routing.selected, selected);
    runtime.world.remove(obstacle);
    poses(runtime, 'removed obstacle invalidates failed plan');
  } finally {runtime.world.remove(obstacle); obstacle.geometry.dispose(); obstacle.material.dispose(); runtime.dispose();}
});

test('an unrelated cabinet wire does not change an unoccupied panel route candidate', () => {
  const runtime = fresh(uploaded);
  try {
    const ends = [endpoint('TB1','46B'), endpoint('HL3','2')];
    const empty = routeWire(runtime.world, runtime.components, ...ends, []);
    const cabinet = routeWire(runtime.world, runtime.components, endpoint('QF1','T1'), endpoint('FU1','F1-IN'), []);
    assert.ok(new CollisionWorld([], [cabinet]).validate(empty.points), 'cabinet wire is physically independent');
    const after = routeWire(runtime.world, runtime.components, ...ends, [cabinet]);
    assert.deepEqual(after.points, empty.points, 'candidate elevation must depend on actual local occupation, not total wire count');
    const emptyRecords=Array.from({length:4},(_,i)=>({...cabinet,id:`empty-${i}`,points:[]}));
    assert.deepEqual(routeWire(runtime.world,runtime.components,...ends,emptyRecords).points,empty.points,
      'records with no physical segments cannot allocate height or lane slots');
  } finally {runtime.dispose();}
});
