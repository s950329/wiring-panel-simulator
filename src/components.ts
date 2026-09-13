import {Group} from 'three';
import type {ComponentAction, ComponentBehavior, ComponentPlacement, ComponentRuntime, ComponentState, ModelBuilder, ResolvedComponent} from './core/contracts.ts';
import {ComponentInstance} from './core/component.ts';
import {EmergencyBehavior, FuseBehavior, MomentaryBehavior, OverloadBehavior, PassiveBehavior, SelectorBehavior, ToggleBehavior} from './core/behaviors.ts';
import {ThreeComponentView} from './views/component-view.ts';
import {modelBuilders} from './views/models.js';
import {applyCatalogTerminals} from './views/catalog-terminals.ts';
import {getDefinition, resolvePlacement} from './catalog/resolve.ts';

/** Visual model registry. Product/category growth no longer requires changing a closed ViewType union. */
export const componentRegistry: Readonly<Record<string, ModelBuilder>> = Object.freeze(modelBuilders);

function assemble<S extends ComponentState, A extends ComponentAction>(def: ResolvedComponent, behavior: ComponentBehavior<S, A>): ComponentInstance<S, A> {
  const root = new Group(); root.name = def.id; root.userData.componentId = def.id;
  const builder = componentRegistry[def.visual.model];
  if (!builder) throw new Error(`找不到 3D 模型：${def.visual.model}`);
  const model = applyCatalogTerminals(builder({root, terminals: [], parts: {}, def}));
  const {parts} = model;
  if (parts.cap) parts.cap.userData.action = def.category === 'emergencyStop' ? 'emergency' : 'press';
  if (parts.knob) parts.knob.userData.action = 'selector';
  if (parts.dial) parts.dial.userData.action = 'current';
  if (parts.plunger) parts.plunger.userData.action = 'press';
  root.rotation.y = def.rotation * Math.PI / 180;
  root.traverse(o => { o.userData.componentId = def.id; });
  const placement: ComponentPlacement = {id: def.id, definitionId: def.definitionId, x: def.x, z: def.z, rotation: def.rotation,
    ...(def.y === undefined ? {} : {y: def.y}), ...(def.parentId ? {parentId: def.parentId} : {})};
  return new ComponentInstance<S, A>(getDefinition(def.definitionId), placement, def, behavior, new ThreeComponentView(model));
}
export function createComponent(placement: ComponentPlacement): ComponentRuntime {
  const def = resolvePlacement(placement);
  switch (def.behavior) {
    case 'button': case 'contactor': return assemble(def, new MomentaryBehavior('press'));
    case 'buzzer': return assemble(def, new MomentaryBehavior('buzzer'));
    case 'emergency': return assemble(def, new EmergencyBehavior());
    case 'selector': return assemble(def, new SelectorBehavior());
    case 'overload': return assemble(def, new OverloadBehavior());
    case 'breaker': return assemble(def, new ToggleBehavior());
    case 'lamp': return assemble(def, new ToggleBehavior(true));
    case 'fuse': return assemble(def, new FuseBehavior());
    case 'auxiliary': return assemble(def, new PassiveBehavior('隨接觸器連動'));
    case 'socket': return assemble(def, new PassiveBehavior('空插座'));
    case 'terminalStrip': return assemble(def, new PassiveBehavior('未接線', true));
  }
}
