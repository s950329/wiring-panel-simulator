import {createHash} from 'node:crypto';
import * as T from 'three';
import {required} from './helpers/fixture-types.ts';
// No WebGL required: capture geometry and terminal transforms from the real model.
if (!globalThis.document) Object.defineProperty(globalThis, 'document', {configurable: true, writable: true, value: { createElement: () => ({ width: 256, height: 256, getContext: () => ({ fillRect() { }, strokeRect() { }, fillText() { } }) }) }});
export async function modelSnapshot() {
    const { buildModel } = await import('../src/scene.ts');
    const { world, components, flap } = buildModel(new T.Scene());
    flap.position.y = 13;
    required(world.getObjectByName('operation-panel-hinges')).position.y = 0;
    required(required(components.get('QF1')).parts.lever).position.z = -10;
    world.updateMatrixWorld(true);
    const isBaselineExtension = (o: T.Object3D<T.Object3DEventMap>) => { for (let p: T.Object3D | null = o; p && p !== world; p = p.parent)
        if (p.userData.baselineExtension)
            return true; return false; };
    const hash = createHash('sha256');
    world.traverse(o => {
        if (!(o instanceof T.Mesh) || o.userData.panelSupport || isBaselineExtension(o))
            return;
        hash.update(JSON.stringify(o.matrixWorld.toArray().map(n => Math.round(n * 1e8) / 1e8)));
        for (const name of Object.keys(o.geometry.attributes).sort()) {
            const a = o.geometry.attributes[name].array;
            hash.update(name);
            hash.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
        }
        const index = o.geometry.index?.array;
        if (index)
            hash.update(Buffer.from(index.buffer, index.byteOffset, index.byteLength));
    });
    return { geometryHash: hash.digest('hex'), components: [...components].map(([id, c]) => ({ id, terminals: c.terminals.filter(t => !t.object.userData.baselineExtension).map(t => ({ id: t.id, local: t.local, world: t.object.getWorldPosition(new T.Vector3()).toArray() })) })) };
}
