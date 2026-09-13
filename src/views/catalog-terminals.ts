import type {
  CatalogTerminalDefinition, ModelContext, TerminalDefinition, TerminalRole, TerminalView, Vec3,
} from '../core/contracts.ts';
import {terminal} from '../primitives.js';

const frontCategories = new Set(['pushButton', 'selector', 'emergencyStop', 'lamp', 'buzzer']);
const samePosition = (a: Vec3, b: Vec3): boolean => a.every((n, i) => Math.abs(n - b[i]) < 1e-9);

function runtimeDefinition(spec: CatalogTerminalDefinition): TerminalDefinition {
  return Object.freeze({...spec, localPosition: spec.position, electricalRole: spec.role});
}
function normalizeLegacyTerminal(view: TerminalView): void {
  const legacy = view.definition as Partial<TerminalDefinition>;
  const position = legacy.position ?? legacy.localPosition ?? view.local;
  const role: TerminalRole = legacy.role ?? legacy.electricalRole ?? 'unverified';
  const exitDirection: Vec3 = legacy.exitDirection ?? [0, 0, position[2] >= 0 ? 1 : -1];
  const definition: TerminalDefinition = {
    id: legacy.id ?? view.id,
    ...(legacy.displayName === undefined ? {} : {displayName: legacy.displayName}),
    ...(legacy.group === undefined ? {} : {group: legacy.group}),
    position,
    localPosition: position,
    exitDirection,
    ...(legacy.escapePath === undefined ? {} : {escapePath: legacy.escapePath}),
    role,
    electricalRole: role,
  };
  view.definition = Object.freeze(definition);
}
function applyAuthoredTerminal(view: TerminalView, spec: CatalogTerminalDefinition): void {
  if (!samePosition(view.local, spec.position))
    throw new Error(`${view.id} 的 Catalog 端子位置與 3D 模型不一致`);
  view.local = spec.position;
  view.displayName = spec.displayName;
  view.group = spec.group;
  view.definition = runtimeDefinition(spec);
}

/**
 * Migration boundary between catalog data and legacy JS model builders.
 * Authored topology is authoritative; legacy-only terminals are normalized so downstream code has one runtime shape.
 */
export function applyCatalogTerminals(model: ModelContext): ModelContext {
  const authored = model.def.terminals;
  if (!authored?.length) {
    for (const view of model.terminals) normalizeLegacyTerminal(view);
    return model;
  }

  const byId = new Map(model.terminals.map(view => [view.id, view]));
  for (const spec of authored) {
    let view = byId.get(spec.id);
    if (!view) {
      if (!frontCategories.has(model.def.category))
        throw new Error(`${model.def.id} 的 3D 模型缺少 Catalog 端子：${spec.id}`);
      const object = terminal(model.root, model.terminals, spec.id, ...spec.position, {scale: .7, exitDirection: spec.exitDirection});
      object.rotation.x = Math.PI;
      object.userData.baselineExtension = true;
      view = model.terminals.at(-1)!;
      byId.set(spec.id, view);
    }
    applyAuthoredTerminal(view, spec);
  }

  for (const view of model.terminals) {
    if (!authored.some(spec => spec.id === view.id))
      throw new Error(`${model.def.id} 的 3D 模型存在 Catalog 未宣告端子：${view.id}`);
  }
  return model;
}
