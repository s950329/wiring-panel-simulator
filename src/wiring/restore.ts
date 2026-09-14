import {Group, Vector3} from 'three';
import type {ComponentRuntime} from '../core/contracts.ts';
import type {RoutedWire} from '../application/board-snapshot.ts';
import {describeTerminal, validateSelf} from './router.js';
import {CollisionWorld, distance} from './collision.js';
import {collectSolids} from './solids.js';
import {wireMesh} from './controller.js';
import {panelGateway} from '../layout.ts';

/** Validate saved geometry before creating a replacement group; never reroute silently. */
export function prepareWireRestore(world: Group, components: ReadonlyMap<string, ComponentRuntime>, wires: readonly RoutedWire[]) {
  const solids = collectSolids(world), accepted: RoutedWire[] = [];
  for (const w of wires) {
    const a = describeTerminal(world, components, w.from), b = describeTerminal(world, components, w.to);
    if (!a.anchors.some(p => distance(p, w.points[0]) < .002) || !b.anchors.some(p => distance(p, w.points.at(-1)!) < .002))
      throw new Error(`${w.id} 的路徑未連到指定端子`);
    if (!validateSelf(w.points) || !new CollisionWorld(solids, accepted).validate(w.points)) throw new Error(`${w.id} 的路徑與元件或其他電線碰撞`);
    const panelSide = (info: typeof a) => info.c.root.parent?.userData.operationPanel || (info.endpoint.component === panelGateway.component && info.endpoint.terminal.endsWith(panelGateway.side));
    if (panelSide(a) && panelSide(b)) {
      const gateway = components.get(panelGateway.component)!;
      const matrix = world.matrixWorld.clone().invert().multiply(gateway.root.matrixWorld);
      const origin = new Vector3().applyMatrix4(matrix), normal = new Vector3(0, 0, 1).transformDirection(matrix);
      if (w.viaDucts.length || w.points.some(p => new Vector3(...p).sub(origin).dot(normal) < -1e-6)) throw new Error(`${w.id} 離開操作板側走線範圍`);
    }
    accepted.push(w);
  }
  const group = new Group(); group.name = 'user-wires'; group.userData.wireGroup = true;
  try {for (const wire of wires) group.add(wireMesh(wire));}
  catch (error) {disposeWireGroup(group); throw error;}
  return {group, wires: structuredClone(wires)};
}
export function disposeWireGroup(group: Group): void {
  for (const object of group.children) {const mesh = object as ReturnType<typeof wireMesh>; mesh.geometry.dispose(); mesh.material.dispose();}
  group.removeFromParent(); group.clear();
}
