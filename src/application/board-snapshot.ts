import type {Object3D} from 'three';
import type {ComponentRuntime, Vec3} from '../core/contracts.ts';
import type {Endpoint, Wire} from '../electrical/contracts.ts';
import type {SimulationController} from './simulation.ts';
import {board, ducts, rails, panelGateway, placements, frontPlacements} from '../layout.ts';
import {MODEL_REVISION} from '../revision.js';

export interface RoutedWire extends Wire {readonly points: readonly Vec3[]; readonly viaDucts: readonly number[]; readonly radius: number}
export interface Transform {readonly position: readonly number[]; readonly quaternion: readonly number[]; readonly scale: readonly number[]}
export interface BoardViewState {
  readonly page: 'board' | 'component'; readonly selectedComponent: string | null; readonly selectedTerminal: string | null;
  readonly operationPanelOpen: boolean; readonly attachmentsShown: boolean; readonly gridVisible: boolean;
  readonly camera: {readonly azimuth: number; readonly elevation: number; readonly radius: number; readonly target: readonly number[]};
  readonly worldTransform: Transform; readonly panelAngle: number;
}
export interface WiringSessionState {
  readonly mode: 'connect' | 'operate'; readonly pending: Endpoint | null; readonly busy: boolean;
  readonly selectedWireId: string | null; readonly evidenceIds: readonly string[]; readonly undoOrder: readonly string[];
  readonly lastAttempt: {readonly from: Endpoint; readonly to: Endpoint; readonly status: 'routing' | 'connected' | 'failed';
    readonly error: string | null; readonly wireId: string | null} | null;
}
const transform = (object: Object3D): Transform => ({position: object.position.toArray(), quaternion: object.quaternion.toArray(), scale: object.scale.toArray()});

/** Versioned plain data, with both editable inputs and derived evidence. No scene objects or browser/account data. */
export function createBoardSnapshot(input: {components: ReadonlyMap<string, ComponentRuntime>; physicalWires: readonly RoutedWire[];
  simulation: SimulationController | null; view: BoardViewState; wiringSession: WiringSessionState | null}, now = new Date()) {
  const simulation = input.simulation?.snapshot() ?? null;
  return structuredClone({format: 'wiring-panel-snapshot' as const, schemaVersion: 1 as const, revision: MODEL_REVISION,
    exportedAt: now.toISOString(), units: {coordinates: 'scene-units', angles: 'radians'},
    configuration: {board, ducts, rails, panelGateway, placements, frontPlacements},
    components: [...input.components.values()].map(c => ({id: c.id, definition: c.definition, ...c.serialize(),
      terminals: c.terminalDefinitions, electricalOutput: c.electricalOutput,
      transform: {...transform(c.root), parent: c.placement.parentId ?? (c.root.parent?.userData.operationPanel ? 'operation-panel' : 'board'), visible: c.root.visible},
      mechanisms: Object.fromEntries((['bridge', 'plunger', 'cap', 'knob', 'dial', 'test', 'reset', 'lever', 'cover1', 'cover2'] as const)
        .flatMap(key => {const part = c.parts[key]; return part ? [[key, transform(part)]] : [];})),
      ...(c.parts.color ? {material: {color: `#${c.parts.color.color.getHexString()}`, emissive: `#${c.parts.color.emissive.getHexString()}`,
        emissiveIntensity: c.parts.color.emissiveIntensity}} : {})})),
    wiring: {physical: input.physicalWires, external: simulation?.externalWires ?? [], fixed: simulation?.fixedWires ?? [], session: input.wiringSession},
    simulation: simulation ? {...simulation, circuit: input.simulation!.circuit()} : null,
    view: input.view});
}

export function snapshotDownload(snapshot: ReturnType<typeof createBoardSnapshot>) {
  return {filename: `wiring-panel-${snapshot.revision}-${snapshot.exportedAt.replace(/[:.]/g, '-')}.json`,
    mimeType: 'application/json', content: `${JSON.stringify(snapshot, null, 2)}\n`};
}
