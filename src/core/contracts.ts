import type { Group, Object3D, Mesh, MeshPhysicalMaterial } from 'three';

/** Board-proportion units, not measured millimetres. All vectors are component-local. */
export type Vec3 = readonly [number, number, number];
export type ViewType = 'breaker' | 'fuse' | 'contactorSP' | 'contactorSC' | 'contactorCN' |
  'auxiliary' | 'overload' | 'socket' | 'terminalStrip' | 'buzzer' | 'emergency' | 'selector' | 'button' | 'lamp';
export type BehaviorKind = 'button' | 'contactor' | 'breaker' | 'fuse' | 'auxiliary' | 'overload' |
  'socket' | 'terminalStrip' | 'buzzer' | 'emergency' | 'selector' | 'lamp';

export interface ComponentDefinition {
  readonly id: string;
  readonly viewType: ViewType;
  readonly behavior: BehaviorKind;
  readonly name: string;
  readonly model: string;
  readonly size: Vec3;
  readonly hint: string;
  readonly photo?: string;
  readonly color?: number;
  readonly sticker?: boolean;
  readonly count?: number;
  readonly pitch?: number;
}
export interface ComponentPlacement {
  readonly id: string;
  readonly definitionId: string;
  readonly x: number;
  readonly z: number;
  readonly y?: number;
  readonly rotation: number;
  readonly parentId?: string;
}
/** Compatibility projection for the existing geometry builders; never stored as a model definition. */
export type ResolvedComponent = ComponentPlacement & Omit<ComponentDefinition, 'id'> & { readonly type: ViewType };
export interface TerminalDefinition {
  readonly id: string;
  readonly displayName?: string;
  readonly group?: string;
  readonly localPosition: Vec3;
  /** Relative to the COMPONENT, not the screw's rotated frame. */
  readonly exitDirection: Vec3;
  /** Reserved for a future authored corridor. The current router does not consume this field. */
  readonly escapePath?: readonly Vec3[];
  readonly electricalRole: 'unverified' | 'coil' | 'power' | 'contact';
}
export interface TerminalView {
  id: string;
  object: Group;
  hit: Mesh;
  local: Vec3;
  scale: number;
  displayName?: string;
  group?: string;
  definition: TerminalDefinition;
}
export interface ModelParts {
  bridge?: Object3D; plunger?: Object3D; cap?: Object3D; knob?: Object3D;
  dial?: Object3D; test?: Object3D; reset?: Object3D; lever?: Object3D;
  cover1?: Object3D; cover2?: Object3D; factoryLinks?: Group;
  color?: MeshPhysicalMaterial;
}
export interface ModelContext {
  root: Group;
  terminals: TerminalView[];
  parts: ModelParts;
  def: ResolvedComponent;
}
export type ModelBuilder = (context: ModelContext) => ModelContext;

export type MomentaryState = Readonly<{kind: 'momentary'; pressed: boolean}>;
export type EmergencyState = Readonly<{kind: 'emergency'; latched: boolean}>;
export type SelectorState = Readonly<{kind: 'selector'; position: 0 | 1 | 2}>;
export type OverloadState = Readonly<{kind: 'overload'; trip: boolean; current: number}>;
export type ToggleState = Readonly<{kind: 'toggle'; on: boolean}>;
export type CoverState = Readonly<{kind: 'cover'; open: boolean}>;
export type PassiveState = Readonly<{kind: 'passive'}>;
export type ComponentState = MomentaryState | EmergencyState | SelectorState | OverloadState | ToggleState | CoverState | PassiveState;
export type ComponentAction =
  | {type: 'press' | 'release' | 'buzzer' | 'toggle' | 'lamp' | 'fuseCover' | 'trip' | 'reset' | 'current' | 'emergency' | 'unlock' | 'selector'}
  | {type: 'setPosition'; value: number}
  | {type: 'setCurrent'; value: number};
export type ActionOf<T extends ComponentAction['type']> =
  T extends 'setPosition' ? {type: T; value: number} :
  T extends 'setCurrent' ? {type: T; value: number} : {type: T};
export type Control =
  | {kind: 'button'; label: string; action: ComponentAction; tone?: 'danger' | 'outline'}
  | {kind: 'hold'; label: string; press: ActionOf<'press' | 'buzzer'>; release: ActionOf<'release'>}
  | {kind: 'choice'; options: readonly {label: string; action: ComponentAction; selected: boolean}[]}
  | {kind: 'range'; label: string; action: 'setCurrent'; min: number; max: number; step: number; value: number; unit: string};
export interface StatusContext { readonly connections: number }
export interface Presentation { status: string; alert: boolean; controls: readonly Control[] }
export interface ActionResult { accepted: boolean; message?: string }
export interface ComponentBehavior<S extends ComponentState, A extends ComponentAction> {
  createState(): S;
  accepts(action: ComponentAction): action is A;
  applyAction(state: S, action: A): S;
  present(state: S, context: StatusContext): Presentation;
  message?(state: S, action: A, id: string): string | undefined;
  audible?(state: S): boolean;
}
export interface ViewContext { readonly parentPressed: boolean }
export interface ComponentView<S extends ComponentState> {
  readonly root: Group;
  readonly parts: ModelParts;
  readonly terminals: TerminalView[];
  update(state: S, context: ViewContext, instant?: boolean): void;
  syncRoutingPose(state: S): void;
}
export interface ComponentRuntime {
  readonly id: string;
  readonly definition: ComponentDefinition;
  readonly placement: ComponentPlacement;
  readonly def: ResolvedComponent;
  readonly state: ComponentState;
  readonly root: Group;
  readonly parts: ModelParts;
  readonly terminals: TerminalView[];
  readonly terminalDefinitions: readonly TerminalDefinition[];
  readonly pressed: boolean;
  readonly audible: boolean;
  readonly position: number;
  readonly current: number;
  dispatch(action: ComponentAction): ActionResult;
  release(): void;
  present(context?: StatusContext): Presentation;
  updateView(parent?: ComponentRuntime, instant?: boolean): void;
  syncRoutingPose(): void;
  serialize(): {placement: ComponentPlacement; state: ComponentState};
}
