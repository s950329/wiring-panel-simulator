import assert from 'node:assert/strict';
import * as T from 'three';
import type {ComponentRuntime, TerminalView} from '../src/core/contracts.ts';
import {required} from './helpers/fixture-types.ts';
Object.defineProperty(globalThis, 'document', {configurable: true, writable: true, value: { createElement: () => ({ width: 256, height: 256, getContext: () => ({ fillRect() { }, strokeRect() { }, fillText() { } }) }) }});
const { buildModel } = await import('../src/scene.ts');
const { ducts } = await import('../src/layout.ts');
const scene = new T.Scene();
const { world, components } = buildModel(scene);
scene.updateMatrixWorld(true);
const mc = components.get('MC1'), th = components.get('TH1'), sides = required(mc).terminals.filter(t => t.group === 'side');
assert.equal(sides.length, 8);
assert.equal(required(mc).terminals.length, 16);
for (const side of ['L', 'R']) {
    assert.equal(sides.filter(t => t.side === side).length, 4);
    for (const end of ['F', 'B']) {
        const pair = sides.filter(t => t.side === side && t.end === end);
        assert.equal(pair.length, 2);
        const upper = pair.find(t => t.level === 'U'), lower = pair.find(t => t.level === 'L');
        assert.ok(required(upper).local[1] > required(lower).local[1]);
        assert.ok(Math.abs(required(lower).local[2]) > Math.abs(required(upper).local[2]));
    }
}
assert.deepEqual(required(mc).terminals.filter(t => t.group === 'rear-lower').map(t => t.id), ['A1', 'A2']);
const isolated = buildModel(new T.Scene(), { inspectMC1: true });
assert.deepEqual([...isolated.components.keys()], ['MC1', 'AP1', 'TH1']);
for (const t of required(mc).terminals) {
    const other = required(isolated.components.get('MC1')).terminals.find(q => q.id === t.id);
    assert.deepEqual(required(other).local, t.local);
}
const control = required(th).terminals.filter(t => t.group === 'overload-contact');
assert.deepEqual(control.map(t => t.id).sort(), ['TA', 'TB', 'TC']);
for (const obsolete of ['95', '96', '97', '98'])
    assert.ok(!required(th).terminals.some(t => t.id === obsolete));
const byId = Object.fromEntries(control.map(t => [t.id, t]));
assert.ok(byId.TC.local[1] > byId.TA.local[1] && byId.TC.local[1] > byId.TB.local[1]);
assert.ok(byId.TA.local[0] < byId.TB.local[0]);
assert.ok(byId.TC.local[2] < byId.TA.local[2]);
// Check the complete TH geometry, not just terminal center points, against the duct's inner lip.
const bounds = new T.Box3().setFromObject(required(th).root);
const duct = ducts[0], innerEdge = duct.x + duct.width / 2 + 1.5 - 400;
const clearance = bounds.min.x - innerEdge;
assert.ok(clearance >= 4, `TH1 intrudes into duct: clearance ${clearance}`);
const ray = new T.Raycaster();
function reachable(comp: ComponentRuntime | undefined, t: TerminalView) {
    const target = t.hit.getWorldPosition(new T.Vector3());
    target.y += 1;
    let hits = 0;
    for (let az = 0; az < 16; az++)
        for (const e of [.22, .45, .70, 1.0, 1.35, Math.PI / 2]) {
            const phi = az * Math.PI / 8, origin = target.clone().add(new T.Vector3(Math.cos(e) * Math.sin(phi), Math.sin(e), Math.cos(e) * Math.cos(phi)).multiplyScalar(260));
            ray.set(origin, target.clone().sub(origin).normalize());
            const first = ray.intersectObjects(world.children, true)[0];
            if (first?.object.userData.componentId === required(comp).def.id && first.object.userData.terminal === t.id)
                hits++;
        }
    return hits;
}
for (const [comp, list] of [[mc, [...sides, ...required(mc).terminals.filter(t => t.group === 'rear-lower')]], [th, control]] as const)
    for (const t of required(list)) {
        const hits = reachable(comp, t);
        assert.ok(hits > 0, `${required(comp).def.id}:${t.id} is occluded from all upper-hemisphere samples`);
        console.log(`${required(comp).def.id}:${t.id} reachable ${hits}/96`);
    }
// Attached TH and its independent terminal geometry follow the MC assembly.
const before = byId.TA.object.getWorldPosition(new T.Vector3());
required(mc).root.position.x += 20;
scene.updateMatrixWorld(true);
const after = byId.TA.object.getWorldPosition(new T.Vector3());
assert.ok(Math.abs(after.x - before.x - 20) < 1e-7);
console.log(`PASS: MC1 16 terminals including A1/A2; identical isolated/board coordinates; stepped TA/TB/TC, full TH1 duct clearance ${clearance.toFixed(2)} scene units, attachment and ray selection.`);
