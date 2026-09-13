import type {Circuit, Component, ConductingEdge, ContactResult, Diagnostic, Endpoint, EvaluationState, Netlist} from './contracts.ts';

export const endpointKey = (e: Endpoint): string => JSON.stringify([e.component, e.terminal]);
export const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
export function sortedDiagnostics(items: readonly Diagnostic[]): Diagnostic[] {
  const keyed = items.map(d => ({...d, endpoints: [...d.endpoints].sort((a, b) => compare(endpointKey(a), endpointKey(b)))}));
  return [...new Map(keyed.map(d => [JSON.stringify(d), d])).values()].sort((a, b) => compare(JSON.stringify(a), JSON.stringify(b)));
}

/** Only ideal conductors are unioned. Load endpoints remain separate vertices. */
export function buildNetlist(circuit: Circuit, state: EvaluationState = {}): Netlist {
  const diagnostics: Diagnostic[] = [], edges: ConductingEdge[] = [], contacts: ContactResult[] = [];
  const components = new Map<string, Component>(), endpoints = new Map<string, Endpoint>(), parents = new Map<string, string>();
  const error = (code: Diagnostic['code'], subject: string, points: readonly Endpoint[] = []) =>
    diagnostics.push({code, severity: 'error', subject, endpoints: points});
  function register(ids: Set<string>, id: string, subject: string) {
    if (!id || ids.has(id)) error('DUPLICATE_ID', subject);
    ids.add(id);
  }
  const componentIds = new Set<string>();
  for (const c of circuit.components) {
    register(componentIds, c.id, c.id); components.set(c.id, c);
    const ids = new Set<string>();
    for (const terminal of c.terminals) {
      register(ids, terminal, `${c.id}/${terminal}`);
      const e = {component: c.id, terminal}, key = endpointKey(e);
      endpoints.set(key, e); parents.set(key, key);
    }
  }
  const valid = (e: Endpoint, subject: string): boolean => {
    if (endpoints.has(endpointKey(e))) return true;
    error('INVALID_ENDPOINT', subject, [e]); return false;
  };
  function participating(e: Endpoint, subject: string) {
    if (!valid(e, subject)) return;
    const c = components.get(e.component)!;
    if (!c.model || c.model.unsupportedTerminals?.includes(e.terminal)) error('MISSING_MODEL', c.id, [e]);
  }
  function root(key: string): string {
    let r = key;
    while (parents.get(r)! !== r) r = parents.get(r)!;
    while (key !== r) {const next = parents.get(key)!; parents.set(key, r); key = next;}
    return r;
  }
  function addEdge(id: string, kind: ConductingEdge['kind'], a: Endpoint, b: Endpoint) {
    const goodA = valid(a, id), goodB = valid(b, id);
    if (!goodA || !goodB) return;
    const [from, to] = compare(endpointKey(a), endpointKey(b)) <= 0 ? [a, b] : [b, a];
    edges.push({id, kind, from, to});
    const ra = root(endpointKey(a)), rb = root(endpointKey(b));
    if (ra !== rb) parents.set(compare(ra, rb) < 0 ? rb : ra, compare(ra, rb) < 0 ? ra : rb);
  }
  const wireIds = new Set<string>();
  for (const w of circuit.wires) {
    register(wireIds, w.id, w.id); participating(w.from, w.id); participating(w.to, w.id);
    addEdge(JSON.stringify(['wire', w.id]), 'wire', w.from, w.to);
  }
  const sourceIds = new Set<string>();
  for (const s of circuit.sources) {
    register(sourceIds, s.id, s.id); participating(s.a, s.id); participating(s.b, s.id);
    if (!s.profile || typeof s.enabled !== 'boolean') error('INVALID_DEFINITION', s.id);
  }
  for (const s of circuit.threePhaseSources ?? []) {
    register(sourceIds, s.id, s.id);
    for (const e of s.phases) participating(e, s.id);
    if (!s.profile || typeof s.enabled !== 'boolean' || s.phases.length !== 3 ||
      new Set(s.phases.map(endpointKey)).size !== 3) error('INVALID_DEFINITION', s.id);
  }
  for (const [id, inputs] of Object.entries(state.inputs ?? {})) {
    const c = components.get(id);
    for (const [key, value] of Object.entries(inputs)) {
      const definition = c?.model?.inputs;
      if (!definition || !Object.hasOwn(definition, key) || !definition[key].values.includes(value)) error('INVALID_INPUT', `${id}/${key}`);
    }
  }
  for (const [id, value] of Object.entries(state.coils ?? {})) {
    if (typeof value !== 'boolean' || !components.get(id)?.model?.loads.some(l => l.kind === 'coil')) error('INVALID_INPUT', `${id}/coil`);
  }
  for (const c of circuit.components) {
    const m = c.model;
    if (!m) continue;
    const ids = new Set<string>(), unsupported = new Set(m.unsupportedTerminals ?? []);
    for (const terminal of unsupported) valid({component: c.id, terminal}, c.id);
    for (const [key, def] of Object.entries(m.inputs)) {
      if (!def.values.length || !def.values.includes(def.initial)) error('INVALID_DEFINITION', `${c.id}/${key}`);
    }
    if (m.loads.filter(l => l.kind === 'coil').length > 1) error('INVALID_DEFINITION', `${c.id}/coil`);
    for (const item of [...m.fixed, ...m.contacts, ...m.loads]) {
      register(ids, item.id, `${c.id}/${item.id}`);
      for (const terminal of [item.a, item.b]) {
        valid({component: c.id, terminal}, `${c.id}/${item.id}`);
        if (unsupported.has(terminal)) error('INVALID_DEFINITION', `${c.id}/${item.id}`);
      }
      if ('profile' in item && !item.profile) error('INVALID_DEFINITION', `${c.id}/${item.id}`);
    }
    for (const motor of m.motors ?? []) {
      register(ids, motor.id, `${c.id}/${motor.id}`);
      if (!motor.profile || motor.terminals.length !== 3 || new Set(motor.terminals).size !== 3) error('INVALID_DEFINITION', `${c.id}/${motor.id}`);
      for (const terminal of motor.terminals) {
        valid({component: c.id, terminal}, `${c.id}/${motor.id}`);
        if (unsupported.has(terminal)) error('INVALID_DEFINITION', `${c.id}/${motor.id}`);
      }
    }
    for (const item of m.fixed) addEdge(JSON.stringify(['fixed', c.id, item.id]), 'fixed',
      {component: c.id, terminal: item.a}, {component: c.id, terminal: item.b});
    for (const item of m.contacts) {
      const when = item.when;
      let closed = false;
      if (when.kind === 'input') {
        const def = Object.hasOwn(m.inputs, when.key) ? m.inputs[when.key] : undefined;
        if (!def || !def.values.includes(when.equals)) error('INVALID_DEFINITION', `${c.id}/${item.id}`);
        else {
          const supplied = state.inputs && Object.hasOwn(state.inputs, c.id) ? state.inputs[c.id] : undefined;
          const value = supplied && Object.hasOwn(supplied, when.key) ? supplied[when.key] : def.initial;
          closed = value === when.equals;
        }
      } else {
        const owner = when.owner === 'self' ? c.id : c.parentId;
        if (!owner || !components.get(owner)?.model?.loads.some(l => l.kind === 'coil')) error('INVALID_DEFINITION', `${c.id}/${item.id}`);
        else closed = ((state.coils && Object.hasOwn(state.coils, owner) ? state.coils[owner] : false) === when.equals);
      }
      contacts.push({component: c.id, id: item.id, closed});
      if (closed) addEdge(JSON.stringify(['contact', c.id, item.id]), 'contact',
        {component: c.id, terminal: item.a}, {component: c.id, terminal: item.b});
    }
  }
  const groups = new Map<string, Endpoint[]>();
  for (const [key, e] of endpoints) {const id = root(key); if (!groups.has(id)) groups.set(id, []); groups.get(id)!.push(e);}
  return {
    nets: [...groups].map(([id, points]) => ({id, endpoints: points.sort((a, b) => compare(endpointKey(a), endpointKey(b)))})).sort((a, b) => compare(a.id, b.id)),
    edges: edges.sort((a, b) => compare(a.id, b.id)),
    contacts: contacts.sort((a, b) => compare(JSON.stringify([a.component, a.id]), JSON.stringify([b.component, b.id]))),
    diagnostics: sortedDiagnostics(diagnostics),
  };
}
