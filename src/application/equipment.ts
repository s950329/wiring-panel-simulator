import type {ComponentRuntime} from '../core/contracts.ts';
import type {Component, Wire} from '../electrical/contracts.ts';
import {createTeachingComponent} from '../electrical/catalog.ts';

export interface EquipmentDescriptor {id: string; definitionId: string; label: string; terminals: readonly string[]; enabled?: boolean}
export const externalEquipment = [
  {id: 'CONTROL', definitionId: 'teaching-source', label: '控制電源', terminals: ['L', 'N']},
  {id: 'MAIN', definitionId: 'teaching-three-phase-source', label: '三相主電源', terminals: ['L1', 'L2', 'L3']},
  {id: 'M1', definitionId: 'teaching-motor', label: '馬達供電', terminals: ['U', 'V', 'W']},
] as const;
export const isExternalEquipment = (id: string): boolean => externalEquipment.some(e => e.id === id);

/** Explicit teaching assembly declaration, based on authored placements, never meshes. */
export function assemblyWires(components: ReadonlyMap<string, ComponentRuntime>): Wire[] {
  return [...components.values()].flatMap(c => {
    const parent = c.placement.parentId ? components.get(c.placement.parentId) : undefined;
    if (c.definition.id !== 'shihlin-th20' || parent?.definition.id !== 'shihlin-sp16') return [];
    return [['2T1', '1/L1'], ['4T2', '3/L2'], ['6T3', '5/L3']].map(([a, b], i) => ({
      id: `assembly:${parent.id}:${c.id}:${i + 1}`, from: {component: parent.id, terminal: a}, to: {component: c.id, terminal: b},
    }));
  });
}
export function electricalComponents(components: ReadonlyMap<string, ComponentRuntime>, equipment: readonly EquipmentDescriptor[] = externalEquipment): Component[] {
  return [...components.values()].map(c => {
    try {return createTeachingComponent(c.placement);}
    catch {return {id: c.id, terminals: c.terminalDefinitions.map(t => t.id), ...(c.placement.parentId ? {parentId: c.placement.parentId} : {})};}
  }).concat(equipment.map(createTeachingComponent));
}
