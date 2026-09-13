import type {Circuit, Diagnostic, Endpoint, Evaluation, EvaluationState, LoadResult} from './contracts.ts';
import {buildNetlist, compare, endpointKey, sortedDiagnostics} from './netlist.ts';
import {loadPaths} from './load-paths.ts';

/** One simultaneous evaluation. Stateful feedback and convergence belong to Phase 2. */
export function evaluateCircuit(circuit: Circuit, state: EvaluationState = {}): Evaluation {
  const graph = buildNetlist(circuit, state), diagnostics: Diagnostic[] = [...graph.diagnostics];
  const byEndpoint = new Map(graph.nets.flatMap(n => n.endpoints.map(e => [endpointKey(e), n.id] as const)));
  const net = (e: Endpoint): string => byEndpoint.get(endpointKey(e)) ?? endpointKey(e);
  const sources = [...circuit.sources].sort((a, b) => compare(a.id, b.id));
  const live = sources.filter(s => s.enabled), invalid = diagnostics.some(d => d.severity === 'error');
  const add = (code: Diagnostic['code'], severity: Diagnostic['severity'], subject: string, endpoints: readonly Endpoint[]) =>
    diagnostics.push({code, severity, subject, endpoints});
  let fault = false;
  if (!invalid) {
    for (const source of live) if (net(source.a) === net(source.b)) {
      fault = true; add('SOURCE_SHORT', 'error', source.id, [source.a, source.b]);
    }
    // Shared live rails require a source-combination model, outside this two-pole solver.
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      if ([net(a.a), net(a.b)].some(n => n === net(b.a) || n === net(b.b))) {
        fault = true; add('SOURCE_CONFLICT', 'error', JSON.stringify([a.id, b.id]), [a.a, a.b, b.a, b.b]);
      }
    }
  }
  const loads = circuit.components.flatMap(c => (c.model?.loads ?? []).map(l => ({component: c.id, load: l,
    a: {component: c.id, terminal: l.a}, b: {component: c.id, terminal: l.b}})))
    .sort((a, b) => compare(JSON.stringify([a.component, a.load.id]), JSON.stringify([b.component, b.load.id])));
  const loadEdges = loads.map(l => [net(l.a), net(l.b)] as const);
  const sourcePairs = live.map(s => [net(s.a), net(s.b)] as const);
  const paths = !invalid && !fault ? loadPaths(loadEdges, sourcePairs) : new Set<number>();
  // Sources are edges ONLY for detecting unsupported combined-source loops;
  // they never become ideal conducting edges or participate in net union.
  const combinedPaths = !invalid && !fault && live.length > 1
    ? loadPaths([...loadEdges, ...sourcePairs], sourcePairs) : new Set<number>();
  const results: LoadResult[] = loads.map(({component, load, a, b}, i) => {
    const na = net(a), nb = net(b), base = {component, id: load.id, kind: load.kind, nets: [na, nb] as const};
    const finish = (state: LoadResult['state'], reason: LoadResult['reason'], sourceIds: readonly string[] = []): LoadResult => ({...base, state, reason, sourceIds});
    if (invalid) return finish('unknown', 'invalid-circuit');
    if (fault) return finish('fault', 'source-fault');
    if (na === nb) return finish('unpowered', 'same-potential');
    const direct = live.filter(s => (net(s.a) === na && net(s.b) === nb) || (net(s.a) === nb && net(s.b) === na));
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
    return finish('unpowered', live.length ? 'open' : 'source-off');
  });
  return {...graph, diagnostics: sortedDiagnostics(diagnostics), loads: results,
    status: fault ? 'fault' : invalid || results.some(l => l.state === 'unknown') ? 'unknown' : 'ok'};
}
