import {Group} from 'three';
import type {ComponentAction, ComponentBehavior, ComponentPlacement, ComponentRuntime, ComponentState, ModelBuilder, ModelContext, ResolvedComponent, TerminalView, ViewType} from './core/contracts.ts';
import {ComponentInstance} from './core/component.ts';
import {EmergencyBehavior, FuseBehavior, MomentaryBehavior, OverloadBehavior, PassiveBehavior, SelectorBehavior, ToggleBehavior} from './core/behaviors.ts';
import {ThreeComponentView} from './views/component-view.ts';
import {modelBuilders} from './views/models.ts';
import {terminal} from './primitives.ts';
import {getDefinition, resolvePlacement} from './catalog/resolve.ts';

export const componentRegistry: Readonly<Record<ViewType, ModelBuilder>> = Object.freeze(modelBuilders);

function decorateFrontTerminal(t: TerminalView, displayName: string, group: string): void {
  t.displayName = displayName;
  t.group = group;
  t.definition = {...t.definition, electricalRole: 'contact'};
}
function addFrontTerminal(model: ModelContext, id: string, displayName: string, group: string, x: number, z: number): void {
  const object = terminal(model.root, model.terminals, id, x, -41, z, {scale: .7});
  object.rotation.x = Math.PI;
  object.userData.baselineExtension = true;
  decorateFrontTerminal(model.terminals.at(-1)!, displayName, group);
}
function configureFrontTerminals(model: ModelContext, def: ResolvedComponent): void {
  const [a, b] = model.terminals;
  if (!a || !b) return;
  if (def.type === 'button') {
    // Keep physical IDs/positions stable; label the same-side contacts used in class.
    decorateFrontTerminal(a, '1 · 常閉 NC', 'NC');
    decorateFrontTerminal(b, '2 · 常開 NO', 'NO');
    addFrontTerminal(model, '3', '3 · 常開 NO', 'NO', -9, 6);
    addFrontTerminal(model, '4', '4 · 常閉 NC', 'NC', 9, -6);
  } else if (def.type === 'selector') {
    decorateFrontTerminal(a, '13 · 接點 A', 'selector-A');
    decorateFrontTerminal(b, '14 · 接點 A', 'selector-A');
    addFrontTerminal(model, '3', '23 · 接點 B', 'selector-B', -9, 6);
    addFrontTerminal(model, '4', '24 · 接點 B', 'selector-B', 9, -6);
  } else if (def.type === 'emergency') {
    decorateFrontTerminal(a, '21 · 常閉 NC', 'NC');
    decorateFrontTerminal(b, '22 · 常閉 NC', 'NC');
  }
}
function assemble<S extends ComponentState, A extends ComponentAction>(def: ResolvedComponent, behavior: ComponentBehavior<S, A>): ComponentInstance<S, A> {
  const root = new Group(); root.name = def.id; root.userData.componentId = def.id;
  const model = componentRegistry[def.type]({root, terminals: [], parts: {}, def});
  configureFrontTerminals(model, def);
  const {parts} = model;
  if (parts.cap) parts.cap.userData.action = def.type === 'emergency' ? 'emergency' : 'press';
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
