import {Object3D, type Group} from 'three';
import type {ComponentRuntime} from '../core/contracts.ts';
import type {BoardViewState} from './board-snapshot.ts';
import type {SimulationController} from './simulation.ts';
import type {WiringController} from '../wiring/controller.ts';
import {applyComponentState, parseBoardSnapshot} from './snapshot-validation.ts';
import {prepareWireRestore, disposeWireGroup} from '../wiring/restore.ts';

interface ImportTarget {
  world: Group; components: ReadonlyMap<string, ComponentRuntime>; routing?: WiringController;
  simulation: SimulationController | null; page: BoardViewState['page'];
}
/** Validate a complete file and stage geometry synchronously; no frame or callback sees the temporary pose. */
export function importBoardSnapshot(source: string, target: ImportTarget) {
  const {world, components, routing, simulation, page} = target;
  if (simulation && !simulation.canEdit) throw new Error('請先停止模擬再匯入盤面');
  routing?.assertEditable();
  const data = parseBoardSnapshot(source, components, page);
  if (page === 'board' && (!routing || !simulation)) throw new Error('盤面尚未準備完成');
  const restoreSimulation = simulation?.prepareRestore({externalWires: data.external, power: data.power}, data.physical);
  const flap = world.children.find(o => o.userData.operationPanel), oldAngle = flap?.rotation.x;
  const previous = [...components.values()].map(c => ({c, state: c.state, electrical: c.electricalOutput,
    parts: Object.values(c.parts).filter((p): p is Object3D => p instanceof Object3D).map(p => ({p, position: p.position.clone(), quaternion: p.quaternion.clone(), scale: p.scale.clone()})),
    material: c.parts.color ? {color: c.parts.color.color.clone(), emissive: c.parts.color.emissive.clone(), intensity: c.parts.color.emissiveIntensity,
      roughness: c.parts.color.roughness, metalness: c.parts.color.metalness, clearcoat: c.parts.color.clearcoat, envMapIntensity: c.parts.color.envMapIntensity} : null}));
  const apply = () => {
    for (const c of components.values()) {applyComponentState(c, data.states.get(c.id)!); c.setElectricalOutput({mode: 'off', energized: false});}
    for (const c of components.values()) {c.updateView(components.get(c.placement.parentId ?? ''), true); c.syncRoutingPose();}
    if (flap) flap.rotation.x = data.view.panelAngle;
    world.updateMatrixWorld(true);
  };
  const rollbackPose = () => {
    for (const {c, state, electrical, parts, material} of previous) {
      applyComponentState(c, state); c.setElectricalOutput(electrical);
      for (const {p, position, quaternion, scale} of parts) {p.position.copy(position); p.quaternion.copy(quaternion); p.scale.copy(scale);}
      if (material && c.parts.color) {
        c.parts.color.color.copy(material.color); c.parts.color.emissive.copy(material.emissive); c.parts.color.emissiveIntensity = material.intensity;
        c.parts.color.roughness = material.roughness; c.parts.color.metalness = material.metalness;
        c.parts.color.clearcoat = material.clearcoat; c.parts.color.envMapIntensity = material.envMapIntensity;
      }
    }
    if (flap && oldAngle !== undefined) flap.rotation.x = oldAngle;
    world.updateMatrixWorld(true);
  };
  let prepared: ReturnType<typeof prepareWireRestore> | undefined;
  try {apply(); if (routing) prepared = prepareWireRestore(world, components, data.physical);}
  finally {rollbackPose();}
  // All input validation, collision checks and mesh allocations have completed.
  try {apply(); if (routing && prepared) routing.replacePrepared(prepared);}
  catch (error) {rollbackPose(); if (prepared) disposeWireGroup(prepared.group); throw error;}
  const t = data.view.worldTransform;
  world.position.fromArray(t.position); world.quaternion.fromArray(t.quaternion); world.scale.fromArray(t.scale);
  if (page === 'component') {
    for (const id of ['AP1', 'TH1']) {const c = components.get(id); if (c) c.root.visible = data.view.attachmentsShown;}
    const links = components.get('MC1')?.parts.factoryLinks; if (links) links.visible = data.view.attachmentsShown;
  }
  world.updateMatrixWorld(true); restoreSimulation?.();
  return {view: data.view, session: data.session, previousMode: data.previousMode,
    wireCount: data.physical.length + data.external.length};
}
