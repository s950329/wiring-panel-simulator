import assert from 'node:assert/strict';
import test from 'node:test';
import type {ProjectDocument} from '../src/project/contracts.ts';
import {ep, minimalProject, withAssembly} from './helpers/project-data.ts';
const module = await import('../src/project/validation.ts');
const parse = (source: string) => { assert.equal(typeof module.parseProject, 'function', 'project parser must exist'); return module.parseProject(source); };
const load = (p: ProjectDocument) => parse(JSON.stringify(p));
test('new project accepts independent instance IDs, meaningful defaults and quarter-turn placement', () => {
    const p = minimalProject(), before = JSON.stringify(p), out = load(p);
    assert.equal(out.configuration.components[0].id, 'breaker');
    assert.deepEqual(out.configuration.components[0].state, { on: true });
    assert.equal(JSON.stringify(p), before);
    assert.deepEqual(load(out), out);
});
test('project validation rejects unknown fields, versions, prototypes, bad values and unresolved mounts', () => {
    const corruptions: Array<(p: ProjectDocument) => void> = [
        p => { Object.assign(p, {schemaVersion:99}); },
        p => { Object.assign(p.configuration.components[0], {definitionVersion:2}); },
        p => { p.configuration.components[0].definitionId = 'remote-model'; },
        p => { p.configuration.board.width = -1; },
        p => { Object.assign(p.configuration.components[0].placement!, {rotationY:45}); },
        p => { Object.assign(p.configuration.components[0].placement!, {mountId:'missing'}); },
        p => { Object.assign(p.configuration.components[0].state!, {on:'true'}); },
        p => { Object.assign(p.configuration.components[0], {points:[]}); },
        p => { p.configuration.components.push({...p.configuration.components[0]}); },
        p => { Object.assign(p.configuration.board, {extra:'wrong'}); },
    ];
    for (const mutate of corruptions) {
        const p = minimalProject();
        mutate(p);
        assert.throws(() => load(p));
    }
    assert.throws(() => parse('{"__proto__":{"polluted":true}}'), /欄位|污染|proto/);
    assert.equal(Reflect.get({}, 'polluted'), undefined);
});
test('assembly slots enforce type, unique occupancy and explicit fixed conductors', () => {
    const good = withAssembly();
    assert.equal(load(good).configuration.components.length, 4);
    const corruptions: Array<(p: ProjectDocument) => void> = [
        p => {p.configuration.assemblies[0].hostId='missing';},
        p => {p.configuration.assemblies[0].hostId='thermal';},
        p => {Object.assign(p.configuration.components[2].placement!, {slot:'missing'});},
        p => {p.configuration.components[2].definitionId='shihlin-th20';},
        p => {Object.assign(p.configuration.components[3].parameters!, {current:3.3});},
        p => {Object.assign(p.configuration.components[3].parameters!, {current:15.1});},
        p => {p.configuration.components.push({...p.configuration.components[2],id:'second-aux'});},
    ];
    for (const mutate of corruptions) {
        const p = withAssembly();
        mutate(p);
        assert.throws(() => load(p));
    }
    good.connections = [{ from: ep('coil', '2T1'), to: ep('thermal', '1/L1') }];
    assert.throws(() => load(good), /固定|重複/);
});
test('connections validate undirected duplication and endpoints but permit distinct branches and deliberate electrical faults', () => {
    const p = minimalProject();
    p.connections = [{ from: ep('breaker', 'T1'), to: ep('coil', '1L1') },
        { from: ep('breaker', 'T1'), to: ep('coil', '3L2') }];
    assert.equal(load(p).connections.length, 2);
    p.connections.push({ from: ep('coil', '1L1'), to: ep('breaker', 'T1') });
    assert.throws(() => load(p), /重複/);
    p.connections = [{ from: ep('coil', 'A1'), to: ep('coil', 'A1') }];
    assert.throws(() => load(p), /自接|相同/);
    p.connections = [{ from: ep('coil', 'unknown'), to: ep('breaker', 'T1') }];
    assert.throws(() => load(p), /unknown/);
});
test('external source instances use explicit capabilities, no prescribed IDs or implicit additions', () => {
    const p = minimalProject();
    p.configuration.components = [{ id: 'supply-A', definitionId: 'teaching-ac220-three-phase-source', definitionVersion: 1, placement: null }];
    const out = load(p);
    assert.equal(out.configuration.components.length, 1);
    assert.equal(out.configuration.components[0].parameters, undefined);
    p.configuration.components[0].definitionId = 'shihlin-t20';
    assert.throws(() => load(p), /placement|安裝/);
});
test('resource limits are enforced before model construction and transient inputs cannot become saved outputs', () => {
    const p = minimalProject();
    p.configuration.components[1].state = { pressed: true };
    const out = load(p);
    assert.equal(out.configuration.components[1].state?.pressed, undefined);
    p.configuration.components[1].state = { energized: true };
    assert.throws(() => load(p), /state|欄位/);
    p.configuration.components = [];
    p.connections = Array.from({ length: 513 }, () => ({ from: ep('x', '1'), to: ep('y', '2') }));
    assert.throws(() => load(p), /connections/);
    assert.throws(() => parse(' '.repeat(10 * 1024 * 1024 + 1)), /10 MB/);
});
test('default BOARD 024 is a portable project datum rather than an import whitelist', async () => {
    const m = await import('../src/project/default-project.ts');
    assert.equal(typeof m.defaultProject, 'function');
    const p = m.defaultProject(), out = load(p);
    assert.equal(out.configuration.components.length, 24);
    const first = p.configuration.components[0];
    first.id = 'changed';
    assert.notEqual(m.defaultProject().configuration.components[0].id, 'changed');
    assert.equal(out.configuration.assemblies.length, 1);
});
