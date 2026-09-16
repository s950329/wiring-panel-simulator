import {stateOf} from './helpers/fixture-types.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {defaultProject} from '../src/project/default-project.ts';
import {validateProject} from '../src/project/validation.ts';
import {buildModel} from '../src/scene.ts';
import {collectSolids} from '../src/wiring/solids.ts';
import {required} from './helpers/fixture-types.ts';
import {ep, minimalProject, withAssembly} from './helpers/project-data.ts';
if (!globalThis.document) Object.defineProperty(globalThis, 'document', {configurable: true, writable: true, value: { createElement: () => ({ getContext: () => ({ fillRect() { }, strokeRect() { }, fillText() { } }) }) }});
const module = await import('../src/project/runtime.ts');
function make(p = minimalProject()) { assert.equal(typeof module.createProjectRuntime, 'function', 'dynamic runtime must exist'); return module.createProjectRuntime(p); }
function close(a: T.Vector3Tuple, b: number[]) { assert.ok(new T.Vector3(...a).distanceTo(new T.Vector3(...b)) < 1e-6, `${a} != ${b}`); }
test('default project rebuild retains every accepted terminal geometry with configured equipment', () => {
    const old = buildModel(new T.Scene()), m = make(defaultProject());
    m.world.updateMatrixWorld(true);
    assert.equal(m.components.size, 22);
    assert.equal(m.simulation.equipment.length, 2);
    for (const [id, c] of old.components) {
        const n = m.components.get(id);
        assert.deepEqual(required(n).terminalDefinitions, c.terminalDefinitions);
        for (const t of c.terminals)
            close(t.object.getWorldPosition(new T.Vector3()).toArray(), required(required(n).terminals.find(q => q.id === t.id)).object.getWorldPosition(new T.Vector3()).toArray());
    }
    const solids = (world: T.Group<T.Object3DEventMap>) => collectSolids(world).map(b => JSON.stringify([b.owner, ...b.min.map(n => +n.toFixed(5)), ...b.max.map(n => +n.toFixed(5))])).sort();
    assert.deepEqual(solids(m.world), solids(old.world), 'default physical obstacles retain the accepted geometry');
    m.dispose();
});
test('a smaller project has only its configured instances and no implicit sources or fixed conductors', () => {
    const m = make();
    assert.deepEqual([...m.components.keys()], ['breaker', 'coil']);
    assert.equal(m.flap, null);
    assert.equal(m.simulation.circuit().sources.length, 0);
    assert.equal(required(m.simulation.circuit().threePhaseSources).length, 0);
    assert.equal(m.simulation.snapshot().fixedWires.length, 0);
    assert.equal(m.simulation.circuit().components.length, 2);
    m.dispose();
});
test('renamed assembly host rotation sets attachment local poses and declared copper links only', () => {
    const p = withAssembly();
    p.configuration.components[1].placement = { mountId: 'base', position: [300, 7, 250], rotationY: 90 };
    const m = make(p);
    assert.equal(required(m.components.get('aux')).root.parent, required(m.components.get('coil')).root);
    close(required(m.components.get('thermal')).root.position.toArray(), [0, 0, 80]);
    m.world.updateMatrixWorld(true);
    close(m.world.worldToLocal(required(m.components.get('thermal')).root.getWorldPosition(new T.Vector3())).toArray(), [380, 7, 250]);
    assert.equal(m.simulation.snapshot().fixedWires.length, 3);
    assert.equal(m.simulation.snapshot().fixedWires[0].from.component, 'coil');
    m.dispose();
    p.configuration.components = p.configuration.components.filter(c => c.id !== 'aux');
    p.configuration.assemblies = [];
    required(p.configuration.components.find(c => c.id === 'thermal')).placement = { mountId: 'base', position: [380, 7, 250], rotationY: 90 };
    const free = make(p);
    assert.equal(free.simulation.snapshot().fixedWires.length, 0);
    free.dispose();
});
test('identical renamed hosts share a source but an actual branch contact controls only its wired load', () => {
    const p = minimalProject();
    p.configuration.components[0].state = { on: false };
    p.configuration.components.push({ ...p.configuration.components[1], id: 'second', placement: { mountId: 'base', position: [356, 7, 280], rotationY: -90 } }, { id: 'supply-X', definitionId: 'teaching-ac220-three-phase-source', definitionVersion: 1, placement: null });
    const m = make(p);
    m.connect(ep('supply-X', 'L1'), ep('coil', 'A1'));
    m.connect(ep('supply-X', 'L3'), ep('coil', 'A2'));
    m.connect(ep('supply-X', 'L1'), ep('breaker', 'L1'));
    m.connect(ep('breaker', 'T1'), ep('second', 'A1'));
    m.connect(ep('supply-X', 'L3'), ep('second', 'A2'));
    const r = m.simulation.start();
    assert.equal(r.status, 'stable');
    assert.equal(r.coils.coil, true);
    assert.equal(r.coils.second, false);
    m.simulation.operate('breaker', { type: 'toggle' });
    assert.equal(required(required(m.simulation.snapshot().result).coils).second, true);
    m.simulation.operate('breaker', { type: 'toggle' });
    assert.equal(required(required(m.simulation.snapshot().result).coils).coil, true);
    assert.equal(required(required(m.simulation.snapshot().result).coils).second, false);
    m.dispose();
});
test('export saves persistent inputs and ordered endpoint pairs without modifying live demonstration state', () => {
    const m = make(withAssembly());
    required(m.components.get('coil')).dispatch({ type: 'press' });
    required(m.components.get('thermal')).dispatch({ type: 'setCurrent', value: 16.5 });
    required(m.components.get('thermal')).dispatch({ type: 'trip' });
    const p = m.exportProject();
    assert.equal(required(p.configuration.components.find(c => c.id === 'coil')).state, undefined);
    assert.deepEqual(required(p.configuration.components.find(c => c.id === 'thermal')).parameters, { current: 16.5 });
    assert.deepEqual(required(p.configuration.components.find(c => c.id === 'thermal')).state, { trip: true });
    assert.equal(stateOf(required(m.components.get('coil')), 'momentary').pressed, true);
    const s = JSON.stringify(p);
    for (const forbidden of ['points', 'viaDucts', 'localPosition', 'material', 'electricalOutput', 'evaluatedCircuit', 'revision', 'exportedAt'])
        assert.equal(s.includes(`"${forbidden}"`), false);
    assert.deepEqual(validateProject(p), p);
    m.dispose();
});
test('disposing one runtime does not dispose geometry or materials shared by another', () => {
    const a = make(), b = make();
    let sharedDisposed = 0, ownedDisposed = 0;
    const shared: T.Mesh[] = [];
    b.world.traverse(o => { if (o instanceof T.Mesh)
        shared.push(o); });
    let selected: T.Mesh | undefined;
    a.world.traverse(o => { if (o instanceof T.Mesh && shared.some(q => q.geometry === o.geometry))
        selected = o; });
    assert.ok(selected);
    selected.geometry.addEventListener('dispose', () => sharedDisposed++);
    const owned = a.routing.group;
    owned.add(new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial()));
    owned.children[0].geometry.addEventListener('dispose', () => ownedDisposed++);
    a.dispose();
    a.dispose();
    assert.equal(sharedDisposed, 0);
    assert.equal(ownedDisposed, 1);
    assert.throws(() => a.connect(ep('breaker', 'T1'), ep('coil', '1L1')), /disposed|釋放/);
    b.dispose();
});
