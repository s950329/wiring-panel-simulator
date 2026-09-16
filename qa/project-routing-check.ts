import type {Vec3} from '../src/core/contracts.ts';
import type {RoutingBox} from '../src/wiring/panel-region.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import {defaultProject} from '../src/project/default-project.ts';
import {createProjectRuntime} from '../src/project/runtime.ts';
import {CollisionWorld} from '../src/wiring/collision.ts';
import {validateSelf} from '../src/wiring/router.ts';
import {collectSolids} from '../src/wiring/solids.ts';
import {required} from './helpers/fixture-types.ts';
import {ep, minimalProject} from './helpers/project-data.ts';
if (!globalThis.document) Object.defineProperty(globalThis, 'document', {configurable: true, writable: true, value: { createElement: () => ({ getContext: () => ({ fillRect() { }, strokeRect() { }, fillText() { } }) }) }});
const network = await import('../src/wiring/duct-network.ts');
test('duct graph resolves a geometric chain with stable IDs and rejects disconnected channels', () => {
    assert.equal(typeof network.findDuctPath, 'function');
    const ds: import('../src/wiring/context.ts').RoutingDuct[] = [{ id: 'left', x: 100, y: .5, z: 130, length: 260, width: 40, rotation: 0 },
        { id: 'bridge', x: 220, y: .5, z: 260, length: 280, width: 40, rotation: 90 },
        { id: 'right', x: 340, y: .5, z: 130, length: 260, width: 40, rotation: 0 }];
    assert.deepEqual(network.findDuctPath(ds, 'left', 'right').map(d => d.id), ['left', 'bridge', 'right']);
    assert.deepEqual(network.findDuctPath([...ds].reverse(), 'left', 'right').map(d => d.id), ['left', 'bridge', 'right']);
    assert.throws(() => network.findDuctPath([ds[0], ds[2]], 'left', 'right'), /線槽|相連/);
});
test('native project route uses its own duct instead of the fixed BOARD 024 list', () => {
    const p = minimalProject();
    p.configuration.ducts[0].position = [540, .5, 208];
    const m = createProjectRuntime(p);
    m.connect(ep('breaker','T1'), ep('coil','1L1'));
    const w = required(m.routing.wires.at(-1));
    assert.deepEqual(w.viaDucts, ['main-duct']);
    assert.ok(w.points.some((p: readonly number[]) => Math.abs(p[0] - 540) < .01));
    assert.ok(new CollisionWorld(collectSolids(m.world)).validate(w.points));
    assert.ok(validateSelf(w.points));
    m.dispose();
});
test('reordering configured channels does not change the chosen native path', () => {
    const p = defaultProject();
    required(p.configuration.operationPanel).state.open = true;
    const a = createProjectRuntime(p), w = a.connect(ep('MC1', 'A1'), ep('TB2', '1A'));
    p.configuration.ducts.reverse();
    const b = createProjectRuntime(p), other = b.connect(ep('MC1', 'A1'), ep('TB2', '1A'));
    assert.deepEqual(other, w);
    a.dispose();
    b.dispose();
});
test('no-duct cabinet connection fails without publishing a wire; external connections still work', () => {
    const p = minimalProject();
    p.configuration.ducts = [];
    p.configuration.components.push({ id: 'feed', definitionId: 'teaching-ac220-three-phase-source', definitionVersion: 1, placement: null });
    const m = createProjectRuntime(p);
    assert.throws(() => m.connect(ep('breaker', 'T1'), ep('coil', '1L1')), /線槽/);
    assert.equal(m.routing.wires.length, 0);
    assert.equal(m.exportProject().connections.length, 0);
    m.connect(ep('feed', 'L1'), ep('coil', 'A1'));
    assert.equal(m.exportProject().connections.length, 1);
    m.dispose();
});
test('native routing checkpoints cancel before publishing any geometry', () => {
    const m = createProjectRuntime(minimalProject());
    assert.ok(m.world.userData.routingContext);
    m.world.userData.routingContext.checkpoint = () => { throw new Error('cancelled test'); };
    assert.throws(() => m.connect(ep('breaker', 'T1'), ep('coil', '1L1')), /cancelled test/);
    assert.equal(m.routing.wires.length, 0);
    m.dispose();
});
test('rotated and translated operation panel routes through its configured gateway and closes without lost anchors', () => {
    const p = defaultProject(), cfg = p.configuration;
    cfg.components = cfg.components.filter(c => ['TB1', 'PB3'].includes(c.id));
    cfg.assemblies = [];
    cfg.rails = [];
    cfg.ducts = [];
    cfg.fixedConnections = [];
    required(cfg.operationPanel).state.open = true;
    const turn = ([x, y, z]: Vec3): [number,number,number] => [400 + (z - 320), y, 320 - (x - 400)];
    required(cfg.operationPanel).position = turn(required(cfg.operationPanel).position);
    required(cfg.operationPanel).rotationY = 90;
    const terminal = cfg.components.find(c => c.id === 'TB1');
    const terminalPlacement = required(required(terminal).placement);
    assert.ok('position' in terminalPlacement);
    terminalPlacement.position = turn(terminalPlacement.position);
    terminalPlacement.rotationY = 90;
    const m = createProjectRuntime(p);
    m.connect(ep('TB1', '18B'), ep('PB3', '1'));
    m.connect(ep('TB1', '19B'), ep('PB3', '2'));
    for (const open of [false, true, false]) {
        m.movePanel(open);
        const solids = collectSolids(m.world);
        for (const w of m.routing.wires) {
            assert.deepEqual(w.viaDucts, []);
            assert.ok(validateSelf(w.points));
            assert.ok(new CollisionWorld(solids, m.routing.wires.filter(q => q.id !== w.id)).validate(w.points));
        }
    }
    m.dispose();
});
test('a panel-only circuit without a gateway still uses native panel-side routing', () => {
    const p = defaultProject(), c = p.configuration;
    c.components = c.components.filter(c => ['PB3', 'PB5'].includes(c.id));
    c.assemblies = [];
    c.panelGateway = null;
    c.rails = [];
    c.ducts = [];
    c.fixedConnections = [];
    required(c.operationPanel).state.open = true;
    const m = createProjectRuntime(p);
    m.connect(ep('PB3','1'), ep('PB5','3'));
    assert.deepEqual(required(m.routing.wires.at(-1)).viaDucts, []);
    m.movePanel(false);
    m.dispose();
});
