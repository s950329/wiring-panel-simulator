import assert from 'node:assert/strict';
import test from 'node:test';
import {directOnLineCircuit} from '../src/electrical/exercises.ts';
import {ElectricalSimulator} from '../src/electrical/simulator.ts';

const ready = {QF1: {on: true}};
const start = {...ready, PB3: {pressed: true}};
const ep = (component, terminal) => ({component, terminal});
function check(r, coil, state, reason) {
  assert.equal(r.status, 'stable'); assert.equal(r.coils.MC1, coil);
  const motor = r.evaluation.motors.find(m => m.component === 'M1');
  assert.equal(motor.state, state);
  if (reason) assert.equal(motor.reason, reason);
  return r;
}
function running() {
  const c = directOnLineCircuit(), sim = new ElectricalSimulator();
  check(sim.step(c, ready), false, 'unpowered');
  check(sim.step(c, start), true, 'powered');
  check(sim.step(c, ready), true, 'powered');
  return {c, sim};
}

test('direct-on-line start, release/self-hold and stop follow the actual control and main wires', () => {
  const {c, sim} = running();
  const held = sim.step(c, ready);
  assert.equal(held.evaluation.loads.find(l => l.component === 'HL4').state, 'energized');
  check(sim.step(c, {...ready, PB5: {pressed: true}}), false, 'unpowered');
  check(sim.step(c, ready), false, 'unpowered');
});

test('start and stop together are blocked by the series stop contact', () => {
  const c = directOnLineCircuit(), sim = new ElectricalSimulator();
  check(sim.step(c, {...start, PB5: {pressed: true}}), false, 'unpowered');
});

test('emergency and overload reset do not restart a released-start self-hold circuit', () => {
  for (const input of [{ES1: {latched: true}}, {TH1: {tripped: true}}]) {
    const {c, sim} = running();
    check(sim.step(c, {...ready, ...input}), false, 'unpowered');
    check(sim.step(c, ready), false, 'unpowered');
    check(sim.step(c, start), true, 'powered');
  }
});

test('loss and restoration of control power drops self-hold until start is pressed again', () => {
  const {c, sim} = running();
  const off = {...c, sources: c.sources.map(s => ({...s, enabled: false}))};
  check(sim.step(off, ready), false, 'unpowered');
  check(sim.step(c, ready), false, 'unpowered');
  check(sim.step(c, start), true, 'powered');
});

test('a missing holding wire or coil return prevents the corresponding retention or energization', () => {
  const {c, sim} = running();
  check(sim.step({...c, wires: c.wires.filter(w => w.id !== 'hold-out')}, ready), false, 'unpowered');
  const fresh = new ElectricalSimulator();
  check(fresh.step({...c, wires: c.wires.filter(w => w.id !== 'coil-return')}, start), false, 'unpowered');
  const same = {...c, wires: c.wires.map(w => w.id === 'coil-return' ? {...w, to: ep('MC1', 'A1')} : w)};
  const r = check(new ElectricalSimulator().step(same, start), false, 'unpowered');
  assert.equal(r.evaluation.loads.find(l => l.component === 'MC1').reason, 'same-potential');
});

test('missing or duplicated main phase never becomes powered merely because MC1 is energized', () => {
  const {c, sim} = running();
  check(sim.step({...c, wires: c.wires.filter(w => w.id !== 'motor-W')}, ready), true, 'unpowered', 'missing-phase');
  const duplicate = {...c, wires: c.wires.map(w => w.id === 'motor-W' ? {...w, from: ep('TH1', '4/T2')} : w)};
  check(sim.step(duplicate, ready), true, 'unpowered', 'duplicate-phase');
});

test('main supply and QF are independent of control self-hold, including genuine re-energization', () => {
  const {c, sim} = running();
  check(sim.step(c, {QF1: {on: false}}), true, 'unpowered', 'open');
  check(sim.step(c, ready), true, 'powered');
  const mainOff = {...c, threePhaseSources: c.threePhaseSources.map(s => ({...s, enabled: false}))};
  check(sim.step(mainOff, ready), true, 'unpowered', 'source-off');
  check(sim.step(c, ready), true, 'powered');
});

test('overload affects only its wired contact; bypassing that contact is not hidden by a global stop', () => {
  const {c, sim} = running();
  const bypass = {...c, wires: [...c.wires, {id: 'bypass-TH', from: ep('TH1', 'TC'), to: ep('TH1', 'TB')}]};
  check(sim.step(bypass, {...ready, TH1: {tripped: true}}), true, 'powered');
});

test('phase short and an unverified terminal halt the exercise without publishing partial coil or motor states', () => {
  const c = directOnLineCircuit();
  for (const [a, b, code] of [[ep('MAIN', 'L1'), ep('MAIN', 'L2'), 'SOURCE_SHORT'],
    [ep('MC1', 'L-B-U'), ep('PB3', '1'), 'MISSING_MODEL']]) {
    const r = new ElectricalSimulator().step({...c, wires: [...c.wires, {id: 'fault', from: a, to: b}]}, start);
    assert.equal(r.status, 'halted'); assert.equal(r.evaluation, null); assert.equal(r.coils, null);
    assert.ok(r.diagnostics.some(d => d.code === code));
  }
});

test('renaming instances and reversing wire data cannot act as a hidden standard-answer recognizer', () => {
  const c = directOnLineCircuit(), rename = id => `TEST-${id}`, endpoint = e => ({...e, component: rename(e.component)});
  const renamed = {...c, components: c.components.map(x => ({...x, id: rename(x.id), ...(x.parentId ? {parentId: rename(x.parentId)} : {})})).reverse(),
    sources: c.sources.map(s => ({...s, a: endpoint(s.a), b: endpoint(s.b)})),
    threePhaseSources: c.threePhaseSources.map(s => ({...s, phases: s.phases.map(endpoint)})),
    wires: c.wires.map(w => ({...w, from: endpoint(w.to), to: endpoint(w.from), points: [[999, 99, 9]]})).reverse()};
  const sim = new ElectricalSimulator();
  const r = sim.step(renamed, {'TEST-QF1': {on: true}, 'TEST-PB3': {pressed: true}});
  assert.equal(r.status, 'stable'); assert.deepEqual(r.coils, {'TEST-MC1': true});
  assert.equal(r.evaluation.motors[0].state, 'powered');
  assert.equal(sim.step(renamed, {'TEST-QF1': {on: true}}).coils['TEST-MC1'], true);
});
