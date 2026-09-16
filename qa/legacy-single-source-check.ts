import {stateOf} from './helpers/fixture-types.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRuntime} from '../scripts/reroute-snapshot.ts';
import {createBoardSnapshot} from '../src/application/board-snapshot.ts';
import {readProject} from '../src/project/legacy.ts';
import {createProjectRuntime} from '../src/project/runtime.ts';
import {ProjectSession} from '../src/project/session.ts';
import {mutableClone, required} from './helpers/fixture-types.ts';
import {ep, minimalProject} from './helpers/project-data.ts';
if (!globalThis.document) Object.defineProperty(globalThis, 'document', {configurable: true, writable: true, value: { createElement: () => ({ getContext: () => ({ fillRect() { }, strokeRect() { }, fillText() { } }) }) }});
function snapshot() {
    const m = createRuntime();
    return { ...mutableClone(createBoardSnapshot({ components: m.components, physicalWires: [], simulation: m.simulation, wiringSession: null,
            view: { page: 'board', selectedComponent: null, selectedTerminal: null, operationPanelOpen: false, attachmentsShown: true, gridVisible: false, camera: { azimuth: 0, elevation: 1, radius: 1060, target: [0, 0, 5] }, worldTransform: { position: [-400, 0, -320], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] }, panelAngle: 0 } })), revision: 'WIRE-R12' };
}
const read = (s: unknown) => readProject(JSON.stringify(s));
test('P05 unused auto CONTROL is removed with explicit notes; generic MAIN never gains phase-pair capability', () => {
    const old = snapshot(), before = structuredClone(old);
    Object.assign(stateOf(required(old.components.find(c => c.id === 'QF1')), 'toggle'), {on: true});
    const result = read(old), list = result.project.configuration.components;
    assert.equal(list.length, 24);
    assert.ok(!list.some(c => c.id === 'CONTROL'));
    assert.equal(required(list.find(c => c.id === 'MAIN')).definitionId, 'teaching-three-phase-source');
    assert.equal(required(list.find(c => c.id === 'MAIN')).parameters, undefined);
    assert.equal(required(required(list.find(c => c.id === 'QF1')).state).on, true);
    assert.match(result.conversionNotes.join(' '), /CONTROL/);
    assert.deepEqual(old.wiring, before.wiring);
});
test('P02 wired CONTROL rejection includes the actual endpoint and never silently reconnects it', () => {
    const old = snapshot();
    old.wiring.external = [{ id: 'E1', from: ep('CONTROL', 'L'), to: ep('FU1', 'F1-IN') }];
    required(old.simulation).externalWires = structuredClone(old.wiring.external);
    const before = JSON.stringify(old);
    assert.throws(() => read(old), /CONTROL:L.*FU1:F1-IN/);
    assert.equal(JSON.stringify(old), before);
});
test('legacy disabled MAIN, extra sources or conflicting external references are not guessed away', () => {
    const disabled = snapshot();
    required(disabled.simulation).power.main = false;
    assert.throws(() => read(disabled), /main.*無法|主電源.*無法/);
    const extra = snapshot();
    required(extra.simulation).circuit.sources.push({ ...required(extra.simulation).circuit.sources[0], id: 'HIDDEN' });
    assert.throws(() => read(extra), /來源|電源|sources/);
    const hidden = snapshot();
    required(hidden.simulation).externalWires.push({ id: 'E8', from: ep('CONTROL', 'N'), to: ep('FU1', 'F2-IN') });
    assert.throws(() => read(hidden), /externalWires|不一致|CONTROL/);
});
test('legacy wired CONTROL import is transactional and cannot disturb the active board or its persistent switch state', async () => {
    const owner = createProjectRuntime(minimalProject()), session = new ProjectSession(owner);
    owner.simulation.operate('breaker', { type: 'toggle' });
    const before = owner.exportProject();
    const old = snapshot();
    old.wiring.external.push({ id: 'E1', from: ep('CONTROL', 'L'), to: ep('FU1', 'F1-IN') });
    required(old.simulation).externalWires = structuredClone(old.wiring.external);
    await assert.rejects(session.load(JSON.stringify(old)), /CONTROL:L.*FU1:F1-IN/);
    assert.equal(session.active, owner);
    assert.equal(owner.disposed, false);
    assert.deepEqual(owner.exportProject(), before);
    assert.equal(owner.locked, false);
    session.dispose();
});
