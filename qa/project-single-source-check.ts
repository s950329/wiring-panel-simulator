import {stateOf} from './helpers/fixture-types.ts';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {defaultProject} from '../src/project/default-project.ts';
import {readProject} from '../src/project/legacy.ts';
import {createProjectRuntime} from '../src/project/runtime.ts';
import {buildProject, ProjectSession} from '../src/project/session.ts';
import {validateProject} from '../src/project/validation.ts';
import {required} from './helpers/fixture-types.ts';
const SOURCE = 'teaching-ac220-three-phase-source';
if (!globalThis.document) Object.defineProperty(globalThis, 'document', {configurable: true, writable: true, value: { createElement: () => ({ getContext: () => ({ fillRect() { }, strokeRect() { }, fillText() { } }) }) }});
function single() {
    const p = defaultProject();
    p.configuration.fixedConnections = [];
    p.configuration.components = p.configuration.components.filter(c => c.definitionId !== 'teaching-source');
    for (const c of p.configuration.components)
        if (c.definitionId.endsWith('source')) {
            c.definitionId = SOURCE;
            delete c.parameters;
            delete c.state;
        }
    return p;
}
const external = (id: string, definitionId = SOURCE) => ({ id, definitionId, definitionVersion: 1 as const, placement: null });
test('D1 default board has exactly one explicit phase-capable source and QF1 OFF', () => {
    const p = defaultProject(), sources = p.configuration.components.filter(c => c.definitionId.endsWith('source'));
    assert.equal(sources.length, 1);
    assert.equal(sources[0].definitionId, SOURCE);
    assert.equal(sources[0].parameters, undefined);
    assert.equal(required(required(p.configuration.components.find(c => c.id === 'QF1')).state).on, false);
    assert.ok(!p.configuration.components.some(c => c.id === 'CONTROL'));
});
test('P04 single source is validated by definition rather than the instance name', () => {
    const p = single();
    required(p.configuration.components.find(c => c.definitionId === SOURCE)).id = 'SUPPLY_RENAMED';
    assert.doesNotThrow(() => validateProject(p));
    p.configuration.components.push(external('SECOND'));
    assert.throws(() => validateProject(p), /單一|一組/);
    const renamedControl = single();
    renamedControl.configuration.components.push(external('NOT_CALLED_CONTROL', 'teaching-source'));
    assert.throws(() => validateProject(renamedControl), /獨立|單一|控制電源/);
});
test('P01 no per-source enabled/available state is accepted or serialized', () => {
    for (const field of ['enabled', 'available']) {
        const p = single();
        required(p.configuration.components.find(c => c.definitionId === SOURCE)).parameters = { [field]: true };
        assert.throws(() => validateProject(p), /parameters/);
    }
    const r = createProjectRuntime(single());
    try {
        const out = r.exportProject();
        assert.equal(required(out.configuration.components.find(c => c.definitionId === SOURCE)).parameters, undefined);
        const s = r.simulation.snapshot();
        assert.ok(!('power' in s));
        assert.ok(!('sourcePower' in s));
        assert.ok(!('setPower' in r.simulation));
        assert.ok(!('setSource' in r.simulation));
    }
    finally {
        r.dispose();
    }
});
test('zero-source editable drafts never receive implicit power equipment', () => {
    const p = single();
    p.configuration.components = p.configuration.components.filter(c => !c.definitionId.endsWith('source'));
    const r = createProjectRuntime(p);
    try {
        r.simulation.start();
        assert.deepEqual(r.simulation.circuit().sources, []);
        assert.deepEqual(r.simulation.circuit().threePhaseSources, []);
    }
    finally {
        r.dispose();
    }
});
test('A10 source is active in test mode even with QF1 OFF; real contacts alone isolate its outputs', () => {
    const r = createProjectRuntime(defaultProject());
    try {
        r.simulation.start();
        const c = r.simulation.circuit(), s = r.simulation.snapshot();
        assert.equal(required(s.result).status, 'stable');
        assert.deepEqual(c.sources, []);
        assert.equal(required(c.threePhaseSources).length, 1);
        assert.equal(required(c.threePhaseSources)[0].enabled, true);
        assert.equal(required(required(c.threePhaseSources)[0].lineToLine).length, 3);
        const net = (e: string[]) => required(required(required(s.result).evaluation).nets.find(n => n.endpoints.some(p => p.component === e[0] && p.terminal === e[1]))).id;
        assert.equal(net(['MAIN', 'L1']), net(['QF1', 'L1']));
        assert.notEqual(net(['QF1', 'L1']), net(['QF1', 'T1']));
        r.simulation.operate('QF1', { type: 'toggle' });
        assert.equal(required(r.simulation.circuit().threePhaseSources)[0].enabled, true);
        r.simulation.stop();
        assert.equal(stateOf(required(r.components.get('QF1')), 'toggle').on, true);
        assert.equal(required(r.simulation.circuit().threePhaseSources)[0].enabled, false);
    }
    finally {
        r.dispose();
    }
});
test('generic legacy three-phase source remains explicit without new phase capability', () => {
    const p = single();
    required(p.configuration.components.find(c => c.definitionId === SOURCE)).definitionId = 'teaching-three-phase-source';
    const r = createProjectRuntime(p);
    try {
        assert.equal(required(r.simulation.circuit().threePhaseSources)[0].lineToLine, undefined);
    }
    finally {
        r.dispose();
    }
});
