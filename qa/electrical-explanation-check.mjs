import assert from 'node:assert/strict';
import test from 'node:test';
import {minimalControlCircuit, createTeachingComponent} from '../src/electrical/catalog.ts';
import {directOnLineCircuit} from '../src/electrical/exercises.ts';
import {settleCircuit} from '../src/electrical/simulator.ts';
import {explainSimulation, traceEndpoint} from '../src/electrical/explanation.ts';
const ep = (component, terminal) => ({component, terminal});
const line = (id, a, b) => ({id, from: ep(...a), to: ep(...b)});
const coil = entries => entries.find(e => e.id === 'load:MC1:coil');

test('powered explanations trace actual conducting nets without crossing the coil load', () => {
  const c = minimalControlCircuit(), r = settleCircuit(c, {PB1: {pressed: true}});
  const t = traceEndpoint(c, r.evaluation, ep('MC1', 'A1'));
  assert.deepEqual(t.sources, [ep('SUPPLY', 'L')]); assert.ok(t.wireIds.includes('feed')); assert.ok(t.wireIds.includes('start'));
  assert.equal(t.wireIds.includes('return'), false); assert.equal(t.endpoints.some(e => e.component === 'MC1' && e.terminal === 'A2'), false);
  const e = coil(explainSimulation(c, r)); assert.match(e.title, /吸合/); assert.match(e.detail, /相符/);
  assert.ok(e.wireIds.includes('return')); assert.equal(e.endpoints.length, 2);
});

test('open contacts are stated as observed evidence, not a unique wiring mistake', () => {
  const c = minimalControlCircuit(), r = settleCircuit(c);
  const e = coil(explainSimulation(c, r)); assert.match(e.title, /未吸合/); assert.match(e.detail, /完整回路/);
  assert.ok(e.openContacts.some(contact => contact.component === 'PB1' && contact.id === 'NO'));
  assert.equal(e.openContacts.some(contact => contact.id === 'NC'), false);
  assert.match(e.detail, /保持/); assert.doesNotMatch(e.detail, /一定|唯一|接錯了/);
});

test('missing return and same-potential loads expose the affected endpoints', () => {
  const c = minimalControlCircuit(), missing = {...c, wires: c.wires.filter(w => w.id !== 'return')};
  const e = coil(explainSimulation(missing, settleCircuit(missing, {PB1: {pressed: true}})));
  assert.ok(e.traces.some(t => t.endpoint.terminal === 'A2' && t.sources.length === 0));
  const same = {...c, wires: [...c.wires.filter(w => w.id !== 'return'), line('same', ['MC1', 'A1'], ['MC1', 'A2'])]};
  const s = coil(explainSimulation(same, settleCircuit(same, {PB1: {pressed: true}})));
  assert.match(s.detail, /同一電位/); assert.equal(s.endpoints.length, 2);
});

test('motor explanations distinguish incomplete phases from an energized contactor', () => {
  const c = directOnLineCircuit(); const missing = {...c, wires: c.wires.filter(w => w.id !== 'motor-W')};
  const r = settleCircuit(missing, {QF1: {on: true}, PB3: {pressed: true}}), es = explainSimulation(missing, r);
  assert.match(coil(es).title, /吸合/);
  const m = es.find(e => e.id === 'motor:M1:motor'); assert.match(m.title, /缺相/);
  assert.ok(m.traces.some(t => t.endpoint.terminal === 'W' && !t.sources.length));
  assert.match(m.detail, /三個不同相別/);
});

test('source-off and idle unconnected loads do not flood the user with unrelated errors', () => {
  const c = minimalControlCircuit(); c.components.push(createTeachingComponent({id: 'HL1', definitionId: 'lamp-white'}));
  const off = {...c, sources: c.sources.map(s => ({...s, enabled: false}))};
  const es = explainSimulation(off, settleCircuit(off)); assert.match(coil(es).title, /電源未開啟/);
  assert.equal(es.some(e => e.id === 'load:HL1:lamp'), false);
});

test('short circuit and unsupported terminal explanations keep fault endpoints without partial output', () => {
  const c = minimalControlCircuit();
  const shorted = {...c, wires: [...c.wires, line('short', ['SUPPLY', 'L'], ['SUPPLY', 'N'])]};
  const es = explainSimulation(shorted, settleCircuit(shorted));
  assert.ok(es.some(e => e.id.startsWith('diagnostic:SOURCE_SHORT') && /短接/.test(e.title) && e.wireIds.includes('short')));
  assert.equal(es.some(e => e.id.startsWith('load:')), false);
  const unknown = {...c, wires: [...c.wires, line('unknown', ['SUPPLY', 'L'], ['MC1', 'L-B-U'])]};
  const e = explainSimulation(unknown, settleCircuit(unknown)).find(e => e.id.startsWith('diagnostic:MISSING_MODEL'));
  assert.match(e.detail, /尚未確認/); assert.ok(e.endpoints.some(e => e.terminal === 'L-B-U'));
});

test('oscillation and non-convergence have actionable stop/edit/retry explanations', () => {
  const c = minimalControlCircuit(); c.components.push(createTeachingComponent({id: 'AP1', definitionId: 'shihlin-ap22', parentId: 'MC1'}));
  c.wires = [line('nc-in', ['SUPPLY', 'L'], ['AP1', '61']), line('nc-out', ['AP1', '62'], ['MC1', 'A1']), c.wires[2]];
  const e = explainSimulation(c, settleCircuit(c)).find(e => e.id.startsWith('diagnostic:OSCILLATION'));
  assert.match(e.title, /反覆切換/); assert.match(e.detail, /停止模擬/);
  const minimal = minimalControlCircuit(); const limited = settleCircuit(minimal, {PB1: {pressed: true}}, {}, {maxIterations: 1});
  assert.ok(explainSimulation(minimal, limited).some(e => e.id.startsWith('diagnostic:ITERATION_LIMIT')));
});

test('evidence is stable under wire direction and order changes and does not mutate inputs', () => {
  const c = directOnLineCircuit(), before = structuredClone(c), r = settleCircuit(c, {QF1: {on: true}, PB3: {pressed: true}});
  const reversed = {...c, wires: [...c.wires].reverse().map(w => ({...w, from: w.to, to: w.from}))};
  assert.deepEqual(explainSimulation(c, r), explainSimulation(reversed, settleCircuit(reversed, {QF1: {on: true}, PB3: {pressed: true}})));
  assert.deepEqual(c, before);
});
