import type {Vec3} from '../core/contracts.ts';
import type {Endpoint} from '../electrical/contracts.ts';

export interface FreePlacement {mountId: string; position: Vec3; rotationY: number}
export interface AttachedPlacement {assemblyId: string; slot: 'auxiliary' | 'overload'}
export type Placement = FreePlacement | AttachedPlacement | null;
export type Inputs = Record<string, boolean | number>;
export interface ProjectComponent {
  id: string; definitionId: string; definitionVersion: 1;
  placement: Placement; parameters?: Inputs; state?: Inputs;
}
export interface Assembly {id: string; definitionId: 'shihlin-sp16-accessories'; definitionVersion: 1; hostId: string}
export interface Board {id: string; width: number; depth: number; thickness: number}
export interface OperationPanel {
  id: string; definitionId: 'hinged-operation-panel'; definitionVersion: 1;
  position: Vec3; rotationY: number; width: number; depth: number; thickness: number; skirtHeight: number;
  state: {open: boolean};
}
export interface Channel extends FreePlacement {id: string; length: number; width: number}
export interface Gateway {panelId: string; component: string; boardSide: 'A' | 'B'; panelSide: 'A' | 'B'}
export interface ProjectConfiguration {
  units: {position: 'scene-units'; rotation: 'degrees'};
  board: Board; operationPanel: OperationPanel | null;
  rails: Channel[]; ducts: Channel[]; components: ProjectComponent[]; assemblies: Assembly[];
  panelGateway: Gateway | null;
}
export interface Connection {from: Endpoint; to: Endpoint}
export interface ProjectDocument {
  format: 'wiring-panel-project'; schemaVersion: 1; name?: string;
  configuration: ProjectConfiguration; connections: Connection[];
}
export interface ResolvedMount {
  id: string; mountId: string; parentId?: string;
  localPosition: Vec3; localRotationY: number;
  boardPosition: Vec3; boardRotationY: number;
}
export interface ProjectProgress {phase: 'validate' | 'build' | 'route' | 'panel' | 'ready'; completed: number; total: number; detail: string}
export const PROJECT_LIMITS = Object.freeze({bytes: 10 * 1024 * 1024, components: 128, terminals: 8192,
  connections: 512, channels: 64, referenceDepth: 16, id: 100, name: 200, coordinate: 10000});
