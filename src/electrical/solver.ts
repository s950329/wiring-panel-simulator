import type {Circuit, Diagnostic, Endpoint, Evaluation, EvaluationState, LoadResult} from './contracts.ts';
import {buildNetlist, compare, endpointKey, sortedDiagnostics} from './netlist.ts';
import {loadPaths} from './load-paths.ts';
import {describeSupplies, evaluateMotors, loadKey, motorLoadEdges, railPairs} from './power.ts';

/** One simultaneous evaluation. Stateful feedback and convergence belong to Phase 2. */
export function evaluateCircuit(circuit: Circuit, state: EvaluationState = {}): Evaluation {
  const graph = buildNetlist(circuit, state), diagnostics: Diagnostic[] = [...graph.diagnostics];
  const byEndpoint = new Map(graph.nets.flatMap(n => n.endpoints.map(e => [endpointKey(e), n.id] as const)));
  const net = (e: Endpoint): string => byEndpoint.get(endpointKey(e)) ?? endpointKey(e);
  const invalid = diagnostics.some(d => d.severity === 'error');
  const {supplies, diagnostics: sourceDiagnostics} = describeSupplies(circuit, net);
  const live = supplies.filter(s => s.kind === 'two-pole');
  const add = (code: Diagnostic['code'], severity: Diagnostic['severity'], subject: string, endpoints: readonly Endpoint[]) =>
    diagnostics.push({code, severity, subject, endpoints});
  const fault = !invalid && sourceDiagnostics.length > 0;
  if (!invalid) diagnostics.push(...sourceDiagnostics);
  const loads = circuit.components.flatMap(c => (c.model?.loads ?? []).map(l => ({component: c.id, load: l,
    a: {component: c.id, terminal: l.a}, b: {component: c.id, terminal: l.b}})))
    .sort((a, b) => compare(JSON.stringify([a.component, a.load.id]), JSON.stringify([b.component, b.load.id])));
  const opaqueEdges = [...loads.map(l => ({owner: loadKey(l.component, l.load.id), ends: [net(l.a), net(l.b)] as const})), ...motorLoadEdges(circuit, net)];
  const loadEdges = opaqueEdges.map(e => e.ends);
  const sourcePairs = railPairs(live), allSourcePairs = railPairs(supplies);
  const paths = !invalid && !fault ? loadPaths(loadEdges, sourcePairs) : new Set<number>();
  // Sources are edges ONLY for detecting unsupported combined-source loops;
  // they never become ideal conducting edges or participate in net union.
  const combinedPaths = !invalid && !fault
    ? loadPaths([...loadEdges, ...allSourcePairs], allSourcePairs) : new Set<number>();
  const results: LoadResult[] = loads.map(({component, load, a, b}, i) => {
    const na = net(a), nb = net(b), base = {component, id: load.id, kind: load.kind, nets: [na, nb] as const};
    const finish = (state: LoadResult['state'], reason: LoadResult['reason'], sourceIds: readonly string[] = []): LoadResult => ({...base, state, reason, sourceIds});
    if (invalid) return finish('unknown', 'invalid-circuit');
    if (fault) return finish('fault', 'source-fault');
    if (na === nb) return finish('unpowered', 'same-potential');
    const direct = live.filter(s => (s.rails[0].net === na && s.rails[1].net === nb) || (s.rails[0].net === nb && s.rails[1].net === na));
    if (direct.length) {
      if (direct.some(s => s.profile !== load.profile)) {
        add('INCOMPATIBLE_SUPPLY', 'error', `${component}/${load.id}`, [a, b]);
        return finish('unknown', 'incompatible-supply', direct.map(s => s.id));
      }
      add('RATING_UNVERIFIED', 'warning', `${component}/${load.id}`, [a, b]);
      return finish('energized', 'supply', direct.map(s => s.id));
    }
    if (paths.has(i)) {
      add('UNSUPPORTED_SERIES', 'error', `${component}/${load.id}`, [a, b]);
      return finish('unknown', 'unsupported-series');
    }
    if (combinedPaths.has(i)) {
      add('UNSUPPORTED_SOURCE_NETWORK', 'error', `${component}/${load.id}`, [a, b]);
      return finish('unknown', 'unsupported-source-network');
    }
    return finish('unpowered', supplies.length ? 'open' : 'source-off');
  });
  const motorEvaluation = evaluateMotors(circuit, net, supplies, opaqueEdges, combinedPaths, invalid ? 'invalid' : fault ? 'fault' : undefined);
  diagnostics.push(...motorEvaluation.diagnostics);
  return {...graph, diagnostics: sortedDiagnostics(diagnostics), loads: results, motors: motorEvaluation.motors,
    status: fault ? 'fault' : invalid || results.some(l => l.state === 'unknown') || motorEvaluation.motors.some(m => m.state === 'unknown') ? 'unknown' : 'ok'};
}
