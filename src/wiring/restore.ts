import {Group, Vector3} from 'three';
import type {ComponentRuntime} from '../core/contracts.ts';
import type {RoutedWire} from '../application/board-snapshot.ts';
import {describeTerminal, validateSelf, panelSide, panelCollision} from './router.ts';
import {getRoutingContext} from './context.ts';
import {CollisionWorld, distance} from './collision.ts';
import {collectSolids} from './solids.ts';
import {wireMesh, type WireGroup} from './controller.ts';
import {createPanelRegion} from './panel-region.ts';


/** Validate saved geometry before creating a replacement group; never reroute silently. */
export function prepareWireRestore(world: Group, components: ReadonlyMap<string, ComponentRuntime>, wires: readonly RoutedWire[]) {
  const context=getRoutingContext(world);
  const solids = collectSolids(world), accepted: RoutedWire[] = [],region=createPanelRegion(world,components,context);
  for (const w of wires) {
    const a = describeTerminal(world, components, w.from), b = describeTerminal(world, components, w.to);
    if (!a.anchors.some(p => distance(p, w.points[0]) < .002) || !b.anchors.some(p => distance(p, w.points.at(-1)!) < .002))
      throw new Error(`${w.id} 的路徑未連到指定端子`);
    if (!validateSelf(w.points) || !new CollisionWorld(solids, accepted).validate(w.points)) throw new Error(`${w.id} 的路徑與元件或其他電線碰撞`);
    if(region&&[a,b].some(info=>info.c.root.parent===region.panel)&&!w.points.slice(1).every((p,i)=>region.frontClear(w.points[i],p)))throw new Error(`${w.id} 的路徑越過操作板正面`);
    if (panelSide(a,context) && panelSide(b,context)) {
      if (w.viaDucts.length || !panelCollision(world,components,new CollisionWorld(solids,accepted),context,[a,b]).validate(w.points))
        throw new Error(`${w.id} 離開操作板側走線範圍`);
    }
    accepted.push(w);
  }
  const group = new Group() as WireGroup; group.name = 'user-wires'; group.userData.wireGroup = true;
  try {for (const wire of wires) group.add(wireMesh(wire));}
  catch (error) {disposeWireGroup(group); throw error;}
  return {group, wires: structuredClone([...wires])};
}
export function disposeWireGroup(group: Group): void {
  for (const object of group.children) {const mesh = object as ReturnType<typeof wireMesh>; mesh.geometry.dispose(); mesh.material.dispose();}
  group.removeFromParent(); group.clear();
}
