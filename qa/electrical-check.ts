import assert from 'node:assert/strict';
import test from 'node:test';
import {createTeachingComponent, minimalControlCircuit} from '../src/electrical/catalog.ts';
import type {Circuit, Evaluation, EvaluationState, Netlist} from '../src/electrical/contracts.ts';
import {loadPaths} from '../src/electrical/load-paths.ts';
import {buildNetlist, endpointKey} from '../src/electrical/netlist.ts';
import {evaluateCircuit} from '../src/electrical/solver.ts';
import {mutableCircuit, mutableClone, required} from './helpers/fixture-types.ts';
const ep = (component: string, terminal: string) => ({ component, terminal });
const wire = (id: string, a: readonly [string, string], b: readonly [string, string]) => ({ id, from: ep(...a), to: ep(...b) });
const component = (id: string, definitionId: string, parentId?: string) => mutableClone(createTeachingComponent({ id, definitionId, parentId }));
const result = (c: Circuit, state?: EvaluationState) => evaluateCircuit(c, state);
const coil = (r: Evaluation) => r.loads.find((l: { component: string; }) => l.component === 'MC1');
const pressed = { inputs: { PB1: { pressed: true } } };
const has = (r: Pick<Netlist, "diagnostics">, code: string) => r.diagnostics.some((d) => d.code === code);
const net = (r: Pick<Netlist, "nets">, c: string, t: string) => r.nets.find((n) => n.endpoints.some((e) => e.component === c && e.terminal === t))?.id;
test('minimal source-button-coil-return requires both terminals and a closed button', () => {
    const c = mutableCircuit(minimalControlCircuit()), before = structuredClone(c);
    assert.equal(required(coil(result(c))).state, 'unpowered');
    const on = result(c, pressed);
    assert.equal(on.status, 'ok');
    assert.equal(required(coil(on)).state, 'energized');
    assert.ok(has(on, 'RATING_UNVERIFIED'));
    assert.notEqual(...required(coil(on)).nets);
    assert.equal(has(on, 'SOURCE_SHORT'), false);
    assert.equal(required(coil(result({ ...c, wires: c.wires.slice(0, -1) }, pressed))).reason, 'open');
    assert.deepEqual(c, before);
});
test('teaching contacts have explicit truth tables and fuse integrity is independent of its cover', () => {
    const components = [component('PB1', 'button-yellow'), component('ES1', 'emergency-red'),
        component('SA1', 'selector-three-position'), component('QF1', 'shihlin-t20'),
        component('FU1', 'twin-fuse-holder'), component('TH1', 'shihlin-th20')];
    const c = { components, wires: [], sources: [] };
    const same = (r: Netlist, id: string, a: string, b: string) => net(r, id, a) === net(r, id, b);
    for (const active of [false, true]) {
        const r = buildNetlist(c, { inputs: { PB1: { pressed: active }, ES1: { latched: active },
                QF1: { on: active }, FU1: { f1Intact: active }, TH1: { tripped: active } } });
        assert.equal(same(r, 'PB1', '2', '3'), active);
        assert.equal(same(r, 'PB1', '1', '4'), !active);
        assert.equal(same(r, 'ES1', '1', '2'), !active);
        for (let i = 1; i <= 3; i++)
            assert.equal(same(r, 'QF1', `L${i}`, `T${i}`), active);
        assert.equal(same(r, 'FU1', 'F1-IN', 'F1-OUT'), active);
        assert.equal(same(r, 'FU1', 'F2-IN', 'F2-OUT'), true);
        assert.equal(same(r, 'TH1', 'TC', 'TB'), !active);
        assert.equal(same(r, 'TH1', 'TC', 'TA'), active);
    }
    for (const position of [0, 1, 2] as const) {
        const r = buildNetlist(c, { inputs: { SA1: { position } } });
        assert.equal(same(r, 'SA1', '1', '2'), position === 0);
        assert.equal(same(r, 'SA1', '3', '4'), position === 2);
    }
    assert.ok(has(buildNetlist(c, { inputs: { FU1: { open: true } } }), 'INVALID_INPUT'));
});
test('terminal strips bridge only each A/B slot; empty socket pins remain isolated', () => {
    const c = { components: [component('TB1', 'terminal-strip-46'), component('TB2', 'terminal-strip-13'),
            component('SO1', 'omron-p2cf11')], wires: [], sources: [] };
    const r = buildNetlist(c);
    for (const [id, count] of [['TB1', 46], ['TB2', 13]] as const)
        for (let i = 1; i <= count; i++) {
            assert.equal(net(r, id, `${i}A`), net(r, id, `${i}B`));
            if (i < count)
                assert.notEqual(net(r, id, `${i}A`), net(r, id, `${i + 1}A`));
        }
    assert.equal(new Set(Array.from({ length: 11 }, (_, i) => net(r, 'SO1', String(i + 1)))).size, 11);
});
test('coil snapshot drives contactor and attached AP contacts without automatic feedback', () => {
    const c = mutableCircuit(minimalControlCircuit());
    const withAP = { ...c, components: [...c.components, component('AP1', 'shihlin-ap22', 'MC1')] };
    const r = result(withAP, { ...pressed, coils: { MC1: true } });
    assert.equal(net(r, 'AP1', '53'), net(r, 'AP1', '54'));
    assert.notEqual(net(r, 'AP1', '61'), net(r, 'AP1', '62'));
    assert.equal(net(r, 'MC1', '1L1'), net(r, 'MC1', '2T1'));
    const first = result(withAP, pressed);
    assert.equal(required(coil(first)).state, 'energized');
    assert.notEqual(net(first, 'AP1', '53'), net(first, 'AP1', '54'));
    assert.ok(has(result(withAP, { inputs: { MC1: { pressed: true } } }), 'INVALID_INPUT'));
});
test('source off, same potential, reversed poles and incompatible supply are distinct', () => {
    const c = mutableCircuit(minimalControlCircuit());
    assert.equal(required(coil(result({ ...c, sources: c.sources.map(s => ({ ...s, enabled: false })) }, pressed))).reason, 'source-off');
    assert.equal(required(coil(result({ ...c, sources: c.sources.map(s => ({ ...s, a: s.b, b: s.a })) }, pressed))).state, 'energized');
    const same = { ...c, wires: c.wires.map((w, i) => i === 2 ? { ...w, to: ep('SUPPLY', 'L') } : w) };
    assert.equal(required(coil(result(same, pressed))).reason, 'same-potential');
    const wrong = result({ ...c, sources: c.sources.map(s => ({ ...s, profile: 'other' })) }, pressed);
    assert.equal(required(coil(wrong)).state, 'unknown');
    assert.ok(has(wrong, 'INCOMPATIBLE_SUPPLY'));
});
test('direct source shorts and conflicting live sources are faults, loads are never conducting bridges', () => {
    const c = mutableCircuit(minimalControlCircuit());
    const shorted = result({ ...c, wires: [...c.wires, wire('short', ['SUPPLY', 'L'], ['SUPPLY', 'N'])] }, pressed);
    assert.equal(shorted.status, 'fault');
    assert.equal(required(coil(shorted)).state, 'fault');
    assert.ok(has(shorted, 'SOURCE_SHORT'));
    const conflict = result({ ...c, sources: [...c.sources, { ...c.sources[0], id: 'second' }] }, pressed);
    assert.equal(conflict.status, 'fault');
    assert.ok(has(conflict, 'SOURCE_CONFLICT'));
});
test('series loads are unknown while a dangling load branch stays open', () => {
    const c = mutableCircuit(minimalControlCircuit());
    const series = { ...c, components: [...c.components, component('HL1', 'lamp-white')],
        wires: [...c.wires.slice(0, 2), wire('return', ['MC1', 'A2'], ['HL1', '1']), wire('neutral', ['HL1', '2'], ['SUPPLY', 'N'])] };
    const r = result(series, pressed);
    assert.equal(r.status, 'unknown');
    assert.ok(r.loads.every(l => l.reason === 'unsupported-series'));
    assert.equal(has(r, 'SOURCE_SHORT'), false);
    const dangling = result({ ...c, components: series.components,
        wires: [...c.wires, wire('tail', ['MC1', 'A1'], ['HL1', '1'])] }, pressed);
    assert.equal(required(coil(dangling)).state, 'energized');
    assert.equal(required(dangling.loads.find(l => l.component === 'HL1')).reason, 'open');
});
test('closed loops through two sources are unsupported, while a single connecting load stays open', () => {
    const source = (id: string) => ({ id, a: ep(id, 'L'), b: ep(id, 'N'), profile: 'teaching-control-v1', enabled: true });
    const c = { components: [component('S1', 'teaching-source'), component('S2', 'teaching-source'),
            component('HL1', 'lamp-white'), component('HL2', 'lamp-white')], sources: [source('S1'), source('S2')], wires: [
            wire('1', ['S1', 'L'], ['HL1', '1']), wire('2', ['HL1', '2'], ['S2', 'N']),
            wire('3', ['S2', 'L'], ['HL2', '1']), wire('4', ['HL2', '2'], ['S1', 'N']),
        ] };
    const r = result(c);
    assert.equal(r.status, 'unknown');
    assert.ok(has(r, 'UNSUPPORTED_SOURCE_NETWORK'));
    assert.ok(r.loads.every(l => l.reason === 'unsupported-source-network'));
    assert.deepEqual(result({ ...c, components: [...c.components].reverse(), sources: [...c.sources].reverse(),
        wires: [...c.wires].reverse().map(w => ({ ...w, from: w.to, to: w.from })) }), r);
    const open = result({ ...c, wires: c.wires.slice(0, 3) });
    assert.equal(open.status, 'ok');
    assert.ok(open.loads.every(l => l.reason === 'open'));
    assert.equal(result({ ...c, sources: c.sources.map(s => ({ ...s, enabled: s.id === 'S1' })) }).status, 'ok');
});
test('invalid endpoints and connected missing models fail without mutating the circuit', () => {
    const c = mutableCircuit(minimalControlCircuit());
    const missing = { id: 'UNKNOWN', terminals: ['1', '2'] };
    assert.equal(result({ ...c, components: [...c.components, missing] }, pressed).status, 'ok');
    const bad = { ...c, components: [...c.components, missing], wires: [...c.wires, wire('unknown', ['UNKNOWN', '1'], ['PB1', '1'])] };
    const before = structuredClone(bad), r = result(bad, pressed);
    assert.equal(r.status, 'unknown');
    assert.ok(has(r, 'MISSING_MODEL'));
    assert.deepEqual(bad, before);
    assert.ok(has(result({ ...c, wires: [...c.wires, wire('bad', ['PB1', '13'], ['MC1', 'A1'])] }, pressed), 'INVALID_ENDPOINT'));
    assert.ok(has(result({ ...c, components: [...c.components, component('UNVERIFIED', 'cn18')], wires: [...c.wires, wire('unverified', ['UNVERIFIED', '21NC'], ['PB1', '3'])] }, pressed), 'MISSING_MODEL'));
    assert.ok(has(result({ ...c, components: [...c.components, c.components[0]] }, pressed), 'DUPLICATE_ID'));
});
test('wire direction/order, component order and routing geometry do not change results', () => {
    const c = mutableCircuit(minimalControlCircuit()), r = result(c, pressed);
    const changed = { ...c, components: [...c.components].reverse().map(x => ({ ...x, x: 99, rotation: 180 })),
        wires: [...c.wires].reverse().map(w => ({ ...w, from: w.to, to: w.from, points: [[9, 8, 7]], viaDucts: [] })) };
    assert.deepEqual(result(changed, pressed), r);
    assert.notEqual(endpointKey(ep('a:b', 'c')), endpointKey(ep('a', 'b:c')));
});
test('load-path analysis agrees with simple-path enumeration, including parallel and dangling cycles', () => {
    const all: [string, string][] = [['a', 'b'], ['a', 'c'], ['a', 'd'], ['b', 'c'], ['b', 'd'], ['c', 'd']];
    function expected(edges: readonly (readonly [string,string])[], start: string, end: string) {
        const found = new Set<number>();
        function visit(v: string, visited: Set<string>, path: number[]) {
            if (v === end) {
                for (const e of path)
                    found.add(e);
                return;
            }
            edges.forEach(([a, b], i) => {
                const next = a === v ? b : b === v ? a : undefined;
                if (next !== undefined && !visited.has(next))
                    visit(next, new Set([...visited, next]), [...path, i]);
            });
        }
        visit(start, new Set([start]), []);
        return [...found].sort();
    }
    const graphs = Array.from({ length: 64 }, (_, mask) => all.filter((_, i) => mask & (1 << i)));
    graphs.push([['a', 'b'], ['a', 'b'], ['b', 'd'], ['b', 'c'], ['c', 'e'], ['e', 'b'], ['d', 'd']]);
    for (const edges of graphs)
        for (const pair of all) {
            assert.deepEqual([...loadPaths(edges, [pair])].sort(), expected(edges, ...pair), JSON.stringify({ edges, pair }));
        }
});
test('malformed definitions, parent references, source endpoints and input values are rejected', () => {
    const c = mutableCircuit(minimalControlCircuit());
    assert.ok(has(result(c, { inputs: { PB1: { pressed: 1 } } }), 'INVALID_INPUT'));
    assert.ok(has(result(c, { coils: { PB1: true } }), 'INVALID_INPUT'));
    assert.ok(has(result({ ...c, components: [...c.components, component('AP1', 'shihlin-ap22', 'PB1')] }), 'INVALID_DEFINITION'));
    assert.ok(has(result({ ...c, sources: [{ ...c.sources[0], b: ep('missing', 'N') }] }), 'INVALID_ENDPOINT'));
    const invalid = structuredClone(c);
    required(required(invalid.components.find(x => x.id === 'MC1')).model).loads[0].b = 'missing';
    assert.equal(result(invalid, pressed).status, 'unknown');
    const isolated = component('X', 'button-yellow');
    Object.assign(required(isolated.model).contacts[0].when, {key:'missing'});
    assert.ok(has(result({ ...c, components: [...c.components, isolated] }), 'INVALID_DEFINITION'));
});
