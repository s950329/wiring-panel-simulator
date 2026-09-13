import type {ComponentDefinition, ComponentPlacement, ResolvedComponent} from '../core/contracts.ts';
import {componentDefinitions} from './definitions.ts';

export function getDefinition(id: string): ComponentDefinition {
  const definition = Object.hasOwn(componentDefinitions, id) ? componentDefinitions[id] : undefined;
  if (!definition) throw new Error(`找不到元件規格：${id}`);
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
  if (d.viewType === 'terminalStrip' && (!Number.isInteger(d.count) || !d.count || d.count < 1 || !d.pitch || d.pitch <= 0))
    throw new Error(`${d.id} 的端子數量或間距無效`);
  const placement: ComponentPlacement = {id: p.id, definitionId: p.definitionId, x: p.x, z: p.z, rotation: p.rotation,
    ...(p.y === undefined ? {} : {y: p.y}), ...(p.parentId === undefined ? {} : {parentId: p.parentId})};
  return Object.freeze({...d, ...placement, type: d.viewType});
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
