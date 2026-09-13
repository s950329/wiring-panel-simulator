/** Pure data: these contracts intentionally have no view/runtime dependencies. */
export interface Endpoint { readonly component: string; readonly terminal: string }
export interface Wire { readonly id: string; readonly from: Endpoint; readonly to: Endpoint }
export type InputValue = boolean | 0 | 1 | 2;
export interface InputDefinition { readonly initial: InputValue; readonly values: readonly InputValue[] }
export type Condition =
  | { readonly kind: 'input'; readonly key: string; readonly equals: InputValue }
  | { readonly kind: 'coil'; readonly owner: 'self' | 'parent'; readonly equals: boolean };
export interface Link { readonly id: string; readonly a: string; readonly b: string }
export interface Contact extends Link { readonly when: Condition }
export interface Load extends Link { readonly kind: 'coil' | 'lamp' | 'buzzer'; readonly profile: string }
export interface Motor {
  readonly id: string;
  readonly terminals: readonly [string, string, string];
  readonly profile: string;
}
export interface Provenance {
  readonly level: 'manufacturer' | 'user-confirmed' | 'teaching-assumption';
  readonly reference: string;
}
export interface ElectricalModel {
  readonly provenance: Provenance;
  readonly fixed: readonly Link[];
  readonly contacts: readonly Contact[];
  readonly loads: readonly Load[];
  readonly motors?: readonly Motor[];
  readonly inputs: Readonly<Record<string, InputDefinition>>;
  /** These terminals exist in the model, but their internal connections are unknown. */
  readonly unsupportedTerminals?: readonly string[];
}
export interface Component {
  readonly id: string;
  readonly terminals: readonly string[];
  readonly parentId?: string;
  readonly model?: ElectricalModel;
}
/** One explicitly configured two-pole source. profile expresses teaching compatibility, not volts. */
export interface Source {
  readonly id: string;
  readonly a: Endpoint;
  readonly b: Endpoint;
  readonly profile: string;
  readonly enabled: boolean;
}
/** Three named phase poles of ONE source; no neutral or implicit two-pole supply. */
export interface ThreePhaseSource {
  readonly id: string;
  readonly phases: readonly [Endpoint, Endpoint, Endpoint];
  readonly profile: string;
  readonly enabled: boolean;
}
export interface Circuit {
  readonly components: readonly Component[];
  readonly wires: readonly Wire[];
  readonly sources: readonly Source[];
  readonly threePhaseSources?: readonly ThreePhaseSource[];
}
export interface EvaluationState {
  readonly inputs?: Readonly<Record<string, Readonly<Record<string, InputValue>>>>;
  /** Prior coil snapshot, supplied explicitly. Manual component pressed is never read. */
  readonly coils?: Readonly<Record<string, boolean>>;
}
export type DiagnosticCode = 'INVALID_ENDPOINT' | 'INVALID_DEFINITION' | 'INVALID_INPUT' |
  'DUPLICATE_ID' | 'MISSING_MODEL' | 'SOURCE_SHORT' | 'SOURCE_CONFLICT' |
  'UNSUPPORTED_SERIES' | 'UNSUPPORTED_SOURCE_NETWORK' | 'INCOMPATIBLE_SUPPLY' | 'RATING_UNVERIFIED' |
  'OSCILLATION' | 'ITERATION_LIMIT' | 'MOTOR_MISSING_PHASE' | 'MOTOR_DUPLICATE_PHASE' | 'MOTOR_MIXED_SOURCES';
export interface Diagnostic {
  readonly code: DiagnosticCode;
  readonly severity: 'error' | 'warning';
  readonly subject: string;
  readonly endpoints: readonly Endpoint[];
}
export interface ConductingEdge {
  readonly id: string;
  readonly kind: 'wire' | 'fixed' | 'contact';
  readonly from: Endpoint;
  readonly to: Endpoint;
}
export interface ContactResult { readonly component: string; readonly id: string; readonly closed: boolean }
export interface Net { readonly id: string; readonly endpoints: readonly Endpoint[] }
export interface Netlist {
  readonly nets: readonly Net[];
  readonly edges: readonly ConductingEdge[];
  readonly contacts: readonly ContactResult[];
  readonly diagnostics: readonly Diagnostic[];
}
export interface LoadResult {
  readonly component: string;
  readonly id: string;
  readonly kind: Load['kind'];
  readonly state: 'energized' | 'unpowered' | 'unknown' | 'fault';
  readonly reason: 'supply' | 'open' | 'same-potential' | 'source-off' |
    'unsupported-series' | 'unsupported-source-network' | 'incompatible-supply' | 'invalid-circuit' | 'source-fault';
  readonly nets: readonly [string, string];
  readonly sourceIds: readonly string[];
}
export interface Evaluation extends Netlist {
  readonly status: 'ok' | 'unknown' | 'fault';
  readonly loads: readonly LoadResult[];
  readonly motors: readonly MotorResult[];
}
export interface MotorResult {
  readonly component: string;
  readonly id: string;
  readonly state: 'powered' | 'unpowered' | 'unknown' | 'fault';
  readonly reason: 'supply' | 'source-off' | 'open' | 'missing-phase' | 'duplicate-phase' |
    'mixed-sources' | 'incompatible-supply' | 'unsupported-series' | 'invalid-circuit' | 'source-fault';
  readonly nets: readonly [string, string, string];
  /** Source phase indices at U/V/W, not a claim about mechanical rotation. */
  readonly phaseOrder: readonly [number | null, number | null, number | null];
  readonly sourceIds: readonly string[];
}
