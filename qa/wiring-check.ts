import assert from 'node:assert/strict';
import * as T from 'three';
import {required} from './helpers/fixture-types.ts';
Object.defineProperty(globalThis, 'document', {configurable: true, writable: true, value: { createElement: () => ({ width: 256, height: 256, getContext: () => ({ fillRect() { }, strokeRect() { }, fillText() { } }) }) }});
const { buildModel } = await import('../src/scene.ts');
const { routeWire, describeTerminal, validateSelf } = await import('../src/wiring/router.ts');
const { WiringController } = await import('../src/wiring/controller.ts');
const { collectSolids } = await import('../src/wiring/solids.ts');
const { CollisionWorld, segmentBox, segmentDistance, segments } = await import('../src/wiring/collision.ts');
const { world, components, flap } = buildModel(new T.Scene());
flap.rotation.x = Math.PI;
world.updateMatrixWorld(true);
const solids = collectSolids(world), empty = new CollisionWorld(solids);
assert.ok(segmentBox([0, 0, 0], [10, 0, 0], { min: [4, -1, -1], max: [6, 1, 1] }, 0));
assert.equal(segmentDistance([0, 0, 0], [10, 0, 0], [5, 4, -5], [5, 4, 5]), 4);
assert.equal(validateSelf([[0, 0, 0], [10, 0, 0], [10, 1, 0], [0, 1, 0]]), false);
// Every rendered terminal has a real free clamp-edge anchor, without excluding its housing.
let terminals = 0;
for (const [id, c] of components)
    for (const t of c.terminals) {
        terminals++;
        const info = describeTerminal(world, components, { component: id, terminal: t.id });
        assert.ok(info.anchors.some(a => empty.clear(a)), `${id}:${t.id} has no physical anchor`);
    }
// Smoke-route all 216 endpoints through their preferred duct, including the tight ES1/TB1 turn.
for (const [component, c] of components)
    for (const t of c.terminals) {
        const w = routeWire(world, components, { component, terminal: t.id }, { component: component === 'TB1' ? 'TB2' : 'TB1', terminal: '1A' });
        assert.ok(empty.validate(w.points));
        assert.ok(validateSelf(w.points));
    }
const controller = new WiringController(world, components);
const sources = [...required(components.get('MC1')).terminals.map(t => ['MC1', t.id]), ...required(components.get('TH1')).terminals.map(t => ['TH1', t.id]), ['SO1', '1'], ['SO1', '11'], ['FU1', 'F1-IN'], ['MC3', '1L1'], ['PB1', '1'], ['BZ1', '1']];
for (const [component, terminal] of sources) {
    const existing = controller.snapshot(), w = controller.connect({ component, terminal }, { component: 'TB1', terminal: (controller.wires.length + 1) + 'A' });
    assert.ok(new CollisionWorld(solids, existing).validate(w.points));
    assert.ok(validateSelf(w.points));
    assert.deepEqual(controller.snapshot().slice(0, -1), existing, 'Adding a wire must preserve previous paths');
    assert.ok(w.viaDucts.length >= 1);
}
// Independently recheck every resulting segment against every primitive box.
for (const w of controller.wires)
    for (const s of segments(w.points))
        for (const box of solids)
            assert.equal(segmentBox(s.a, s.b, box, 1.25), false, `${w.id} intersects solid`);
for (let i = 0; i < controller.wires.length; i++)
    for (let j = i + 1; j < controller.wires.length; j++)
        for (const a of segments(controller.wires[i].points))
            for (const b of segments(controller.wires[j].points))
                assert.ok(segmentDistance(a.a, a.b, b.a, b.b) >= 3.5 - 1e-6, 'wires overlap');
const before = controller.snapshot();
assert.throws(() => controller.connect(before[0].from, before[0].to), /已經接線/);
assert.deepEqual(controller.snapshot(), before);
assert.throws(() => controller.connect(before[0].from, before[0].from), /另一個/);
assert.deepEqual(controller.snapshot(), before);
const last = controller.wires.at(-1);
assert.equal(controller.remove(required(last).id), true);
assert.equal(controller.group.children.length, controller.wires.length);
assert.ok(controller.connect(required(last).from, required(last).to));
// Multiple conductors at the same terminal must use distinct clamp-edge anchors.
const branch = routeWire(world, components, { component: 'MC1', terminal: 'A1' }, { component: 'TB2', terminal: '1B' }, controller.wires);
assert.ok(new CollisionWorld(solids, controller.wires).validate(branch.points));
// A blocked endpoint cannot mutate topology or create a straight-through fallback.
const obstruct = new T.Mesh(new T.BoxGeometry(100, 180, 180), new T.MeshBasicMaterial());
obstruct.position.set(352, 80, 178);
world.add(obstruct);
const stable = controller.snapshot();
assert.throws(() => controller.connect({ component: 'SO1', terminal: '2' }, { component: 'TB2', terminal: '2A' }));
assert.deepEqual(controller.snapshot(), stable);
world.remove(obstruct);
// A correctly raised, closed plate leaves an actual rear outlet for its wires.
flap.rotation.x = 0;
const closedRoute = routeWire(world, components, { component: 'PB2', terminal: '1' }, { component: 'TB1', terminal: '45B' }, []);
assert.ok(new CollisionWorld(collectSolids(world)).validate(closedRoute.points));
flap.rotation.x = Math.PI;
// Exercise the public behavior -> view path before checking operated clearances.
for (const id of ['MC1', 'MC2', 'MC3', 'PB1', 'PB2', 'PB3', 'PB4', 'PB5'])
    required(components.get(id)).dispatch({ type: 'press' });
required(components.get('ES1')).dispatch({ type: 'emergency' });
required(components.get('SA1')).dispatch({ type: 'setPosition', value: 2 });
required(components.get('TH1')).dispatch({ type: 'setCurrent', value: 18 });
required(components.get('TH1')).dispatch({ type: 'trip' });
required(components.get('QF1')).dispatch({ type: 'toggle' });
for (const c of components.values())
    c.updateView(components.get(c.def.parentId ?? ''), true);
const operated = new CollisionWorld(collectSolids(world, { reserveMotion: false }));
for (const w of controller.wires)
    assert.ok(operated.validate(w.points), `${w.id} clashes with operated mechanism`);
console.log(`PASS: ${terminals} clamp anchors and single routes; ${controller.wires.length} simultaneous routes; all solids and pairwise wire gaps; duplicate/self/blocked rejection; branch; delete/reconnect; closed flap; operated mechanisms.`);
