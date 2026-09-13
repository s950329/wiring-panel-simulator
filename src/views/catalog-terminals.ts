import type {CatalogTerminalDefinition, ModelContext, TerminalView, Vec3} from '../core/contracts.ts';
import {terminal} from '../primitives.js';

const extendableFrontCategories = new Set(['pushButton', 'selector']);
const samePosition = (a: Vec3, b: Vec3): boolean => a.every((n, i) => Math.abs(n - b[i]) < 1e-9);

function applyAuthoredTerminal(view: TerminalView, spec: CatalogTerminalDefinition): void {
  if (!samePosition(view.local, spec.position))
    throw new Error(`${view.id} 的 Catalog 端子位置與 3D 模型不一致`);
  view.local = spec.position;
  view.displayName = spec.displayName;
  view.group = spec.group;
  view.definition = spec;
}

/**
 * Boundary between catalog-authored terminal topology and legacy JS geometry builders.
 * Catalog data is authoritative; builders only materialize the verified geometry.
 */
export function applyCatalogTerminals(model: ModelContext): ModelContext {
  const authored = model.def.terminals;
  const byId = new Map(model.terminals.map(view => [view.id, view]));

  for (const spec of authored) {
    let view = byId.get(spec.id);
    if (!view) {
      if (!extendableFrontCategories.has(model.def.category))
        throw new Error(`${model.def.id} 的 3D 模型缺少 Catalog 端子：${spec.id}`);
      const object = terminal(model.root, model.terminals, spec.id, ...spec.position, {scale: .7});
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
