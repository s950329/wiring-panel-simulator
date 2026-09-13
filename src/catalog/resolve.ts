import type {ComponentDefinition, ComponentPlacement, ResolvedComponent, Vec3} from '../core/contracts.ts';
import {componentDefinitions} from './definitions.ts';

const validVector = (value: Vec3): boolean => value.length === 3 && value.every(n => Number.isFinite(n));

function validateDefinition(d: ComponentDefinition): void {
  if (!d.id.trim()) throw new Error('元件規格 ID 不可為空');
  if (!d.category || !d.behavior) throw new Error(`${d.id} 缺少 category 或 behavior`);
  if (!d.visual?.model?.trim()) throw new Error(`${d.id} 缺少 visual.model`);
  if (!validVector(d.size)) throw new Error(`${d.id} 的尺寸無效`);
  if (!d.terminals.length) throw new Error(`${d.id} 缺少 Catalog 端子規格`);
  if (d.category === 'terminalBlock' && (!Number.isInteger(d.count) || !d.count || d.count < 1 || !d.pitch || d.pitch <= 0))
    throw new Error(`${d.id} 的端子數量或間距無效`);

  const terminalIds = new Set<string>();
  for (const terminal of d.terminals) {
    if (!terminal.id.trim() || terminalIds.has(terminal.id)) throw new Error(`${d.id} 的端子 ID 重複或無效：${terminal.id}`);
    terminalIds.add(terminal.id);
    if (!validVector(terminal.position) || !validVector(terminal.exitDirection) || Math.hypot(...terminal.exitDirection) === 0)
      throw new Error(`${d.id}:${terminal.id} 的端子位置或出線方向無效`);
    for (const point of terminal.escapePath ?? []) if (!validVector(point)) throw new Error(`${d.id}:${terminal.id} 的逃逸路徑無效`);
  }

  const requireTerminal = (id: string): void => {
    if (!terminalIds.has(id)) throw new Error(`${d.id} 的電氣定義引用不存在端子：${id}`);
  };
  if (d.electrical?.coil) for (const id of d.electrical.coil.terminals) requireTerminal(id);
  for (const contact of d.electrical?.contacts ?? []) for (const id of contact.terminals) requireTerminal(id);
}

export function getDefinition(id: string): ComponentDefinition {
  const definition = Object.hasOwn(componentDefinitions, id) ? componentDefinitions[id] : undefined;
  if (!definition) throw new Error(`找不到元件規格：${id}`);
  validateDefinition(definition);
  return definition;
}
export function resolvePlacement(p: ComponentPlacement): ResolvedComponent {
  if (!p || typeof p.id !== 'string' || !p.id.trim()) throw new Error('元件實例必須有 ID');
  if (typeof p.definitionId !== 'string') throw new Error(`${p.id} 缺少規格 ID`);
  if (![p.x, p.z, p.rotation, p.y ?? 0].every(n => typeof n === 'number' && Number.isFinite(n)))
    throw new Error(`${p.id} 的座標或旋轉無效`);
  if (p.parentId !== undefined && (typeof p.parentId !== 'string' || !p.parentId.trim())) throw new Error(`${p.id} 的父元件 ID 無效`);
  if (p.parentId === p.id) throw new Error(`${p.id} 不可附掛在自己身上`);
  const d = getDefinition(p.definitionId);
  const placement: ComponentPlacement = {id: p.id, definitionId: p.definitionId, x: p.x, z: p.z, rotation: p.rotation,
    ...(p.y === undefined ? {} : {y: p.y}), ...(p.parentId === undefined ? {} : {parentId: p.parentId})};
  return Object.freeze({...d, ...placement, type: d.visual.model});
}
export function resolvePlacements(placements: readonly ComponentPlacement[]): ResolvedComponent[] {
  const ids = new Set<string>();
  const byId = new Map(placements.map(p => [p.id, p]));
  for (const p of placements) {
    if (ids.has(p.id)) throw new Error(`重複元件 ID：${p.id}`);
    ids.add(p.id);
    const ancestors = new Set([p.id]);
    let parent = p.parentId;
    while (parent) {
      if (ancestors.has(parent)) throw new Error(`附掛關係形成循環：${p.id}`);
      ancestors.add(parent);
      const owner = byId.get(parent);
      if (!owner) throw new Error(`${p.id} 的父元件不存在：${parent}`);
      parent = owner.parentId;
    }
  }
  return placements.map(resolvePlacement);
}
