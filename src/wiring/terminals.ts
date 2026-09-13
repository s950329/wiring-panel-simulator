import {Group, Vector3} from 'three';
import type {ComponentRuntime, Vec3} from '../core/contracts.ts';
export interface WireEndpoint { readonly component: string; readonly terminal: string }
const v = (a: Vec3) => new Vector3(...a);
const sides = ['front', 'back', 'right', 'left'] as const;
type Side = typeof sides[number];

/** Resolve stable endpoint IDs using the current model transforms, including the operation plate. */
export function describeTerminal(world: Group, components: ReadonlyMap<string, ComponentRuntime>, endpoint: WireEndpoint) {
  const c = components.get(endpoint.component);
  const t = c?.terminals.find(t => t.id === endpoint.terminal);
  if (!c || !t) throw new Error('找不到端子');
  world.updateMatrixWorld(true);
  const inv = world.matrixWorld.clone().invert();
  const matrix = inv.clone().multiply(t.object.matrixWorld);
  const rootMatrix = inv.clone().multiply(c.root.matrixWorld);
  const dir = t.definition.exitDirection;
  const heading = v(dir).transformDirection(rootMatrix).toArray();
  const position = v([0, 0, 0]).applyMatrix4(matrix).toArray();
  const scale = t.scale || 1;
  const localDir = v(dir).transformDirection(rootMatrix).transformDirection(matrix.clone().invert());
  const preferred: Side = Math.abs(localDir.x) > Math.abs(localDir.z)
    ? (localDir.x > 0 ? 'right' : 'left') : (localDir.z > 0 ? 'front' : 'back');
  const ordered: Side[] = [preferred, ...sides.filter(s => s !== preferred)];
  const anchors: Vec3[] = [];
  for (const side of ordered) for (const offset of [0, -3.7, 3.7]) {
    const x = side === 'right' ? 5.5 * scale + .3 : side === 'left' ? -5.5 * scale - .3 : offset * scale;
    const z = side === 'front' ? 6 * scale + .3 : side === 'back' ? -6 * scale - .3 : offset * scale;
    anchors.push(v([x, 1.25 * scale + .3, z]).applyMatrix4(matrix).toArray());
  }
  return {endpoint, c, t, position, heading, anchors};
}
