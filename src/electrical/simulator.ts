import type {Circuit, Diagnostic, Evaluation, EvaluationState} from './contracts.ts';
import {evaluateCircuit} from './solver.ts';
import {compare, sortedDiagnostics} from './netlist.ts';

export type CoilSnapshot = Readonly<Record<string, boolean>>;
export interface SimulationOptions { readonly maxIterations?: number }
export type SimulationResult =
  | { readonly status: 'stable'; readonly evaluation: Evaluation; readonly coils: CoilSnapshot;
      readonly iterations: number; readonly diagnostics: readonly Diagnostic[] }
  | { readonly status: 'halted'; readonly reason: 'circuit-fault' | 'unsupported' | 'oscillation' | 'iteration-limit';
      readonly evaluation: null; readonly coils: null; readonly iterations: number; readonly diagnostics: readonly Diagnostic[] };

export function settleCircuit(circuit: Circuit, inputs: EvaluationState['inputs'] = {},
  previousCoils: CoilSnapshot = {}, options: SimulationOptions = {}): SimulationResult {
  const maxIterations = options.maxIterations ?? 32;
  if (!Number.isSafeInteger(maxIterations) || maxIterations < 1) throw new RangeError('maxIterations must be a positive safe integer');
  const coilIds = circuit.components.filter(c => c.model?.loads.some(l => l.kind === 'coil')).map(c => c.id).sort(compare);
  // Keep extra supplied keys so the evaluator can reject invalid prior state.
  let coils: CoilSnapshot = {...Object.fromEntries(coilIds.map(id => [id, false])), ...previousCoils};
  const vector = (values: CoilSnapshot) => JSON.stringify(Object.entries(values).sort(([a], [b]) => compare(a, b)));
  let current = vector(coils);
  const seen = new Set([current]);
  const halted = (reason: Extract<SimulationResult, {status: 'halted'}>['reason'], iterations: number,
    diagnostics: readonly Diagnostic[]): SimulationResult => ({status: 'halted', reason, evaluation: null, coils: null,
    iterations, diagnostics: sortedDiagnostics(diagnostics)});
  const feedbackDiagnostic = (code: 'OSCILLATION' | 'ITERATION_LIMIT'): Diagnostic => ({code, severity: 'error', subject: 'simulation',
    endpoints: circuit.components.flatMap(c => (c.model?.loads ?? []).filter(l => l.kind === 'coil')
      .flatMap(l => [{component: c.id, terminal: l.a}, {component: c.id, terminal: l.b}]))});
  for (let iterations = 1; iterations <= maxIterations; iterations++) {
    const evaluation = evaluateCircuit(circuit, {inputs, coils});
    if (evaluation.status !== 'ok') return halted(evaluation.status === 'fault' ? 'circuit-fault' : 'unsupported', iterations, evaluation.diagnostics);
    const next = Object.fromEntries(evaluation.loads.filter(l => l.kind === 'coil').map(l => [l.component, l.state === 'energized']));
    const nextVector = vector(next);
    if (current === nextVector) return {status: 'stable', evaluation, coils: next, iterations, diagnostics: evaluation.diagnostics};
    if (seen.has(nextVector)) return halted('oscillation', iterations, [...evaluation.diagnostics, feedbackDiagnostic('OSCILLATION')]);
    if (iterations === maxIterations) return halted('iteration-limit', iterations, [...evaluation.diagnostics, feedbackDiagnostic('ITERATION_LIMIT')]);
    seen.add(nextVector); current = nextVector; coils = next;
  }
  // The positive bound and final-iteration return make this unreachable.
  throw new Error('Invalid simulation iteration state');
}

export class ElectricalSimulator {
  #coils: CoilSnapshot = {};
  #halted: Extract<SimulationResult, {status: 'halted'}> | undefined;
  readonly #options: SimulationOptions;
  constructor(options: SimulationOptions = {}) { this.#options = {...options}; }
  step(circuit: Circuit, inputs: EvaluationState['inputs'] = {}): SimulationResult {
    if (this.#halted) return structuredClone(this.#halted);
    const result = settleCircuit(circuit, inputs, this.#coils, this.#options);
    if (result.status === 'stable') this.#coils = {...result.coils};
    else {this.#coils = {}; this.#halted = structuredClone(result);}
    return result;
  }
  /** Stop/start boundary: input latches and wires remain owned by the caller. */
  reset(): void {this.#coils = {}; this.#halted = undefined;}
}
