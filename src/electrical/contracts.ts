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
export interface Provenance {
  readonly level: 'manufacturer' | 'user-confirmed' | 'teaching-assumption';
  readonly reference: string;
}
export interface ElectricalModel {
  readonly provenance: Provenance;
  readonly fixed: readonly Link[];
  readonly contacts: readonly Contact[];
  readonly loads: readonly Load[];
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
export interface Circuit {
  readonly components: readonly Component[];
  readonly wires: readonly Wire[];
  readonly sources: readonly Source[];
}
export interface EvaluationState {
  readonly inputs?: Readonly<Record<string, Readonly<Record<string, InputValue>>>>;
  /** Prior coil snapshot, supplied explicitly. Manual component pressed is never read. */
  readonly coils?: Readonly<Record<string, boolean>>;
}
export type DiagnosticCode = 'INVALID_ENDPOINT' | 'INVALID_DEFINITION' | 'INVALID_INPUT' |
  'DUPLICATE_ID' | 'MISSING_MODEL' | 'SOURCE_SHORT' | 'SOURCE_CONFLICT' |
  'UNSUPPORTED_SERIES' | 'UNSUPPORTED_SOURCE_NETWORK' | 'INCOMPATIBLE_SUPPLY' | 'RATING_UNVERIFIED';
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
}
