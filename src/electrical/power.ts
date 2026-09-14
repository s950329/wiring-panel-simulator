import {validLineToLine} from './line-to-line.ts';
import type {Circuit, Diagnostic, Endpoint, MotorResult, LineToLineCapability, LineToLineEvidence} from './contracts.ts';
import {compare} from './netlist.ts';

type NetOf = (endpoint: Endpoint) => string;
export interface SupplyRail { readonly source: string; readonly index: number; readonly net: string; readonly endpoint: Endpoint }
export interface Supply {
  readonly lineToLine?: readonly LineToLineCapability[];
  readonly id: string;
  readonly kind: 'two-pole' | 'three-phase';
  readonly profile: string;
  readonly rails: readonly SupplyRail[];
}
export interface OpaqueLoadEdge { readonly owner: string; readonly ends: readonly [string, string] }
export const loadKey = (component: string, id: string): string => JSON.stringify([component, id]);
export function railPairs(supplies: readonly Pick<Supply, 'rails'>[]): (readonly [string, string])[] {
  return supplies.flatMap(s => s.rails.flatMap((a, i) => s.rails.slice(i + 1).map(b => [a.net, b.net] as const)));
}

/** Recognizes source identity before evaluating loads. Phase poles are not independent sources. */
export function describeSupplies(circuit: Circuit, net: NetOf): {supplies: Supply[]; diagnostics: Diagnostic[]} {
  const raw = [
    ...circuit.sources.map(s => ({...s, kind: 'two-pole' as const, poles: [s.a, s.b]})),
    ...(circuit.threePhaseSources ?? []).map(s => ({...s, kind: 'three-phase' as const, poles: s.phases})),
  ].filter(s => s.enabled).sort((a, b) => compare(a.id, b.id));
  const supplies: Supply[] = raw.map(s => ({id: s.id, kind: s.kind, profile: s.profile,
    ...('lineToLine' in s && validLineToLine(s.lineToLine) && s.lineToLine ? {lineToLine: s.lineToLine} : {}),
    rails: s.poles.map((endpoint, index) => ({source: s.id, index, endpoint, net: net(endpoint)}))}));
  const diagnostics: Diagnostic[] = [];
  for (const s of supplies) if (new Set(s.rails.map(r => r.net)).size < s.rails.length) diagnostics.push({
    code: 'SOURCE_SHORT', severity: 'error', subject: s.id, endpoints: s.rails.map(r => r.endpoint)});
  for (let i = 0; i < supplies.length; i++) for (let j = i + 1; j < supplies.length; j++) {
    const a = supplies[i], b = supplies[j];
    if (a.rails.some(ra => b.rails.some(rb => ra.net === rb.net))) diagnostics.push({code: 'SOURCE_CONFLICT', severity: 'error',
      subject: JSON.stringify([a.id, b.id]), endpoints: [...a.rails, ...b.rails].map(r => r.endpoint)});
  }
  return {supplies, diagnostics};
}

/** A diagnostic hub preserves each terminal's path membership without making a free
 * phase look connected through the motor itself. It does NOT specify a winding/star
 * connection and never enters the conducting netlist. Its three-item key cannot
 * collide with the two-item endpoint keys used for real nets. */
export function motorLoadEdges(circuit: Circuit, net: NetOf): OpaqueLoadEdge[] {
  return circuit.components.flatMap(c => (c.model?.motors ?? []).flatMap(m => m.terminals.map(terminal => ({
    owner: loadKey(c.id, m.id), ends: [net({component: c.id, terminal}), JSON.stringify(['motor-path', c.id, m.id])] as const}))));
}

export function evaluateMotors(circuit: Circuit, net: NetOf, supplies: readonly Supply[], edges: readonly OpaqueLoadEdge[],
  suppliedPaths: ReadonlySet<number>, blocking: 'invalid' | 'fault' | undefined): {motors: MotorResult[]; diagnostics: Diagnostic[]} {
  const rails = supplies.flatMap(s => s.rails), byNet = new Map(rails.map(r => [r.net, r]));
  const bySource = new Map(supplies.map(s => [s.id, s])), diagnostics: Diagnostic[] = [];
  const declarations = circuit.components.flatMap(c => (c.model?.motors ?? []).map(m => ({component: c.id, motor: m})))
    .sort((a, b) => compare(loadKey(a.component, a.motor.id), loadKey(b.component, b.motor.id)));
  const motors = declarations.map(({component, motor}): MotorResult => {
    const endpoints = motor.terminals.map(terminal => ({component, terminal}));
    const nets = endpoints.map(net) as [string, string, string];
    const direct = nets.map(n => byNet.get(n));
    const sourceIds = [...new Set(direct.flatMap(r => r ? [r.source] : []))].sort(compare);
    const base = {component, id: motor.id, nets, sourceIds,
      phaseOrder: direct.map(r => r?.index ?? null) as [number | null, number | null, number | null]};
    const finish = (state: MotorResult['state'], reason: MotorResult['reason']): MotorResult => ({...base, state, reason});
    const add = (code: Diagnostic['code'], severity: Diagnostic['severity'] = 'error') =>
      diagnostics.push({code, severity, subject: `${component}/${motor.id}`, endpoints});
    if (blocking) return finish(blocking === 'fault' ? 'fault' : 'unknown', blocking === 'fault' ? 'source-fault' : 'invalid-circuit');
    // Only an indirectly supplied terminal on a simple source-pair path is
    // unsupported. Reachability alone would mistake dangling branches for loops.
    if (edges.some((edge, i) => edge.owner === loadKey(component, motor.id) &&
      !byNet.has(edge.ends[0]) && suppliedPaths.has(i))) {
      add('UNSUPPORTED_SERIES'); return finish('unknown', 'unsupported-series');
    }
    if (sourceIds.length > 1) {add('MOTOR_MIXED_SOURCES'); return finish('unknown', 'mixed-sources');}
    const source = sourceIds.length ? bySource.get(sourceIds[0]) : undefined;
    if (source && (source.kind !== 'three-phase' || source.profile !== motor.profile)) {
      add('INCOMPATIBLE_SUPPLY'); return finish('unknown', 'incompatible-supply');
    }
    const connected = direct.filter(r => r !== undefined);
    if (new Set(connected.map(r => r.net)).size < connected.length) {
      add('MOTOR_DUPLICATE_PHASE', 'warning'); return finish('unpowered', 'duplicate-phase');
    }
    if (connected.length === 3) {add('RATING_UNVERIFIED', 'warning'); return finish('powered', 'supply');}
    if (connected.length) {add('MOTOR_MISSING_PHASE', 'warning'); return finish('unpowered', 'missing-phase');}
    return finish('unpowered', supplies.some(s => s.kind === 'three-phase') ? 'open' : 'source-off');
  });
  return {motors, diagnostics};
}


export interface TwoTerminalSupply {
  readonly id: string;
  readonly profile: string;
  readonly rails: readonly [SupplyRail, SupplyRail];
  readonly evidence?: LineToLineEvidence;
}
/** Load matching candidates only. Not sources, not conducting edges, not motor phase rails. */
export function twoTerminalSupplies(supplies: readonly Supply[]): TwoTerminalSupply[] {
  return supplies.flatMap((source): TwoTerminalSupply[] => {
    if (source.kind === 'two-pole') return [{id: source.id, profile: source.profile, rails: [source.rails[0], source.rails[1]]}];
    return (source.lineToLine ?? []).map(({phaseIndices, profile}) => ({
      id: source.id, profile, rails: [source.rails[phaseIndices[0]], source.rails[phaseIndices[1]]],
      evidence: {kind: 'line-to-line', sourceId: source.id, phaseIndices: [...phaseIndices]},
    }));
  });
}
