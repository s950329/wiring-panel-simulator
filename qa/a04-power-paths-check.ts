import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import type {Circuit, Diagnostic, Endpoint} from '../src/electrical/contracts.ts';
import type {SimulationResult} from '../src/electrical/simulator.ts';
import {settleCircuit} from '../src/electrical/simulator.ts';
import type {ProjectDocument} from '../src/project/contracts.ts';
import {createProjectRuntime} from '../src/project/runtime.ts';
import {mutableCircuit, required} from './helpers/fixture-types.ts';
const project: ProjectDocument = JSON.parse(readFileSync(new URL('../examples/a04-motor-start.project.json', import.meta.url), 'utf8'));
if (!globalThis.document) Object.defineProperty(globalThis, 'document', {configurable: true, writable: true, value: { createElement: () => ({ getContext: () => ({ fillRect() { }, strokeRect() { }, fillText() { } }) }) }});
function circuit() { const r = createProjectRuntime(project); const c = mutableCircuit(r.simulation.circuit()); c.wires = [...project.connections.map((w, i) => ({ ...w, id: `case-${i}` })), ...c.wires]; for (const s of c.threePhaseSources)
    s.enabled = true; r.dispose(); return c; }
function solve(c: Circuit, patch = {}, previous = {}) { const r = settleCircuit(c, { QF1: { on: true }, PB3: { pressed: false }, PB5: { pressed: false }, TH1: { tripped: false }, ...patch }, previous); assert.equal(r.status, 'stable', JSON.stringify(r.diagnostics)); return r; }
const load = (r: SimulationResult, id: string) => required(required(r.evaluation).loads.find((l) => l.component === id)).state === 'energized';
const motor = (r: SimulationResult) => required(r.evaluation).motors.find((m: { component: string; }) => m.component === 'M1');
test('A09 saved A04 has one source, four physically connected fuse terminals and no source toggle settings', () => {
    const c = circuit();
    assert.deepEqual(c.sources, []);
    assert.equal(c.threePhaseSources.length, 1);
    assert.equal(required(c.threePhaseSources[0].lineToLine).length, 3);
    assert.equal(project.connections.length, 31);
    assert.equal(required(project.configuration.fixedConnections).length, 3);
    assert.equal(required(required(project.configuration.components.find(c => c.id === 'QF1')).state).on, false);
    for (const t of ['F1-IN', 'F1-OUT', 'F2-IN', 'F2-OUT']) {
        const w = project.connections.filter(w => [w.from, w.to].some(e => e.component === 'FU1' && e.terminal === t));
        assert.equal(w.length, 1, t);
        assert.ok(![w[0].from, w[0].to].some(e => ['MAIN', 'CONTROL', 'M1'].includes(e.component)), t);
    }
    for (const [q, f] of [['T1', 'F1-IN'], ['T3', 'F2-IN']] as const)
        assert.ok(project.connections.some(w => [w.from, w.to].some(e => e.component === 'QF1' && e.terminal === q) && [w.from, w.to].some(e => e.component === 'FU1' && e.terminal === f)));
    assert.ok(!JSON.stringify(project).includes('CONTROL'));
    assert.ok(!project.configuration.components.some(c => c.parameters?.enabled !== undefined || c.state?.available !== undefined));
});
test('A05 either fuse or any of its four external terminals becoming open removes self-hold without a hidden bypass', () => {
    const c = circuit(), on = solve(c, { PB3: { pressed: true } });
    assert.equal(on.coils.MC1, true);
    for (const key of ['f1Intact', 'f2Intact']) {
        const r = solve(c, { FU1: { [key]: false } }, on.coils);
        assert.equal(r.coils.MC1, false);
        assert.equal(required(motor(r)).state, 'unpowered');
    }
    for (const t of ['F1-IN', 'F1-OUT', 'F2-IN', 'F2-OUT']) {
        const broken = { ...c, wires: c.wires.filter(w => ![w.from, w.to].some(e => e.component === 'FU1' && e.terminal === t)) };
        const r = solve(broken, {}, on.coils);
        assert.equal(r.coils.MC1, false, t);
        assert.equal(required(motor(r)).state, 'unpowered');
    }
});
test('A07 green lamp can indicate coil hold while a missing S-phase leaves the motor unpowered', () => {
    const c = circuit();
    c.wires = c.wires.filter(w => ![w.from, w.to].some(e => e.component === 'MAIN' && e.terminal === 'L2'));
    const r = solve(c, { PB3: { pressed: true } });
    assert.equal(r.coils.MC1, true);
    assert.equal(load(r, 'HL4'), true);
    assert.equal(required(motor(r)).state, 'unpowered');
    assert.equal(required(motor(r)).reason, 'missing-phase');
});
test('A08 QF1 contacts remove overload alarm supply while the upstream source remains enabled', () => {
    const c = circuit(), alarm = solve(c, { TH1: { tripped: true } });
    assert.equal(load(alarm, 'HL3'), true);
    assert.equal(load(alarm, 'BZ1'), true);
    const r = solve(c, { TH1: { tripped: true }, QF1: { on: false } }, alarm.coils);
    assert.equal(load(r, 'HL3'), false);
    assert.equal(load(r, 'BZ1'), false);
    assert.equal(c.threePhaseSources[0].enabled, true);
    const net = (id: string, t: string) => required(r.evaluation.nets.find(n => n.endpoints.some(e => e.component === id && e.terminal === t))).id;
    assert.equal(net('MAIN', 'L1'), net('QF1', 'L1'));
    assert.notEqual(net('QF1', 'L1'), net('QF1', 'T1'));
});
test('A06 no restart with released ON; a held ON is governed by actual contacts after power restoration', () => {
    const c = circuit(), on = solve(c, { PB3: { pressed: true } }), off = solve(c, { QF1: { on: false } }, on.coils);
    assert.equal(off.coils.MC1, false);
    assert.equal(solve(c, {}, off.coils).coils.MC1, false);
    assert.equal(solve(c, { PB3: { pressed: true } }, off.coils).coils.MC1, true);
    const tripped = solve(c, { PB3: { pressed: true }, TH1: { tripped: true } }, on.coils);
    assert.equal(tripped.coils.MC1, false);
    assert.equal(solve(c, { PB3: { pressed: true } }, tripped.coils).coils.MC1, true);
});
test('A11 deliberately bypassing QF1 is not concealed by an artificial global OFF gate', () => {
    const c = circuit();
    c.wires = c.wires.map(w => {
        if (![w.from, w.to].some(e => e.component === 'FU1' && e.terminal.endsWith('-IN')))
            return w;
        const remap = (e: Endpoint) => e.component === 'QF1' ? { ...e, terminal: e.terminal.replace('T', 'L') } : e;
        return { ...w, from: remap(w.from), to: remap(w.to) };
    });
    const r = solve(c, { QF1: { on: false }, PB3: { pressed: true } });
    assert.equal(r.coils.MC1, true);
    assert.equal(load(r, 'HL4'), true);
    assert.equal(required(motor(r)).state, 'unpowered');
});
