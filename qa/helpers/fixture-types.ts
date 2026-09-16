import assert from 'node:assert/strict';
import type {ComponentRuntime, ComponentState} from '../../src/core/contracts.ts';
import type {Circuit, ThreePhaseSource} from '../../src/electrical/contracts.ts';

/** Test data is deliberately editable; production contracts remain readonly. */
export type Mutable<T> = T extends readonly unknown[]
  ? {-readonly [K in keyof T]: Mutable<T[K]>}
  : T extends object ? {-readonly [K in keyof T]: Mutable<T[K]>} : T;
export function mutableClone<T>(value: T): Mutable<T> {
  return structuredClone(value) as Mutable<T>;
}
/** Electrical factory fixtures have a complete, mutable set of collection fields. */
export function mutableCircuit(value: Circuit): Mutable<Circuit> & {threePhaseSources: Mutable<ThreePhaseSource[]>} {
  const copy = mutableClone(value);
  return {...copy, threePhaseSources: copy.threePhaseSources ?? []};
}
export function required<T>(value: T | null | undefined, message = 'Expected fixture value to exist'): T {
  assert.ok(value !== undefined && value !== null, message);
  return value;
}
export function stateOf<K extends ComponentState['kind']>(component: Pick<ComponentRuntime, 'id' | 'state'>, kind: K): Extract<ComponentState, {kind: K}> {
  const state = component.state;
  assert.equal(state.kind, kind, `Unexpected state for ${component.id}`);
  return state as Extract<ComponentState, {kind: K}>;
}
