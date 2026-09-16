import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {SimulationController} from '../src/application/simulation.ts';
import {buildModel} from '../src/scene.ts';
import {createWirePanel} from '../src/wiring/panel.ts';
import {required} from './helpers/fixture-types.ts';
// Event/state seam only: real panel and routing, minimal DOM slots. This is not browser E2E.
class Element {
    tagName: string;
    children: Element[] = [];
    dataset: Record<string,string> = {};
    attributes: Record<string,unknown> = {};
    disabled = false;
    classes = new Set<string>();
    classList = {toggle:(key:string, active:boolean) => active ? this.classes.add(key) : this.classes.delete(key), contains:(key:string) => this.classes.has(key)};
    html = '';
    controls = new Map<string,Element>();
    onclick: () => unknown = () => {throw Error('Click handler not installed');};
    constructor(tag = 'div') {this.tagName = tag.toUpperCase();}
    set innerHTML(value: string) {
        this.html = value;
        this.controls = new Map(['.wire-prompt', '[data-wire-cancel]', '[data-wire-undo]', '[data-wire-all]',
            '[data-wire-mode="connect"]', '[data-wire-mode="operate"]', '.wire-list'].map(s => [s, new Element('button')]));
        for (const mode of ['connect', 'operate'])
            required(this.controls.get(`[data-wire-mode="${mode}"]`)).dataset.wireMode = mode;
    }
    get innerHTML() { return this.html; }
    querySelector(s:string) { return required(this.controls.get(s)); }
    querySelectorAll(s:string) { return s === '[data-wire-mode]' ? ['connect','operate'].map(m => this.querySelector(`[data-wire-mode="${m}"]`)) : []; }
    setAttribute(k:string, v:unknown) {this.attributes[k]=v;}
    append(...nodes:Element[]) {this.children.push(...nodes);}
    replaceChildren(...nodes:Element[]) {this.children=nodes;}
    getContext() {return {fillRect(){},strokeRect(){},fillText(){}};}
}
type KeyHandler = (event: {key:string;preventDefault():void}) => void;
function make() {
    let panel: Element | undefined, simulation: SimulationController | null = null;
    const listeners = new Map<string, KeyHandler>();
    Object.defineProperty(globalThis, 'document', {configurable: true, writable: true, value: { createElement: (tag: string|undefined) => new Element(tag), activeElement: { tagName: 'BODY' },
        querySelector: (s: string) => s === '.select-wrap' ? { before: (p: Element) => { panel = p; } } : new Element() }});
    Reflect.deleteProperty(globalThis, 'window');
    const app = buildModel(new T.Scene());
    Object.defineProperty(globalThis, 'window', {configurable: true, writable: true, value: { addEventListener: (name: string, handler: KeyHandler) => listeners.set(name, handler) }});
    const ui = createWirePanel({...app, setFlap(open){app.flap.rotation.x=open?Math.PI:0;}}, { toast: () => { }, isFlapOpen: () => true, simulation: () => simulation });
    simulation = new SimulationController(app.components, () => ui.routing.wires);
    const connect = async (a: readonly [string,string], b: readonly [string,string]) => { await ui.pick(...a); await ui.pick(...b); };
    const active = () => required(panel).querySelector('.wire-list').children.filter((r) => r.classList.contains('active')).map((r) => r.children[0].dataset.wireId);
    return { ui, simulation, panel, connect, active, key: (key:string) => required(listeners.get('keydown'))({ key, preventDefault() { } }) };
}
test('repeated undo follows addition order across external and physical wires', async () => {
    const { ui, simulation: s, panel, connect } = make();
    await connect(['CONTROL', 'L'], ['QF1', 'L1']);
    await connect(['MC1', 'A1'], ['TB2', '1A']);
    await connect(['MAIN', 'L1'], ['QF1', 'L2']);
    const undo = required(required(panel)).querySelector('[data-wire-undo]');
    undo.onclick();
    assert.equal(s.snapshot().externalWires.length, 1);
    assert.equal(undo.disabled, false);
    undo.onclick();
    assert.equal(ui.routing.wires.length, 0);
    assert.equal(undo.disabled, false);
    undo.onclick();
    assert.equal(s.snapshot().externalWires.length, 0);
    assert.equal(undo.disabled, true);
});
test('a new physical wire replaces external selection and Delete removes that visible selection', async () => {
    const { ui, simulation: s, connect, active, key } = make();
    await connect(['CONTROL', 'L'], ['QF1', 'L1']);
    if (!active().includes('E1'))
        ui.select('E1');
    await connect(['MC1', 'A1'], ['TB2', '1A']);
    assert.deepEqual(active(), ['W01']);
    assert.equal(ui.routing.selected, 'W01');
    key('Delete');
    assert.equal(ui.routing.wires.length, 0);
    assert.deepEqual(s.snapshot().externalWires.map(w => w.id), ['E1']);
});
test('pending routing rejects a source start race and every panel deletion path stays locked', async () => {
    const { ui, simulation: s, panel, connect, key } = make();
    await connect(['CONTROL', 'L'], ['QF1', 'L1']);
    await ui.pick('MC1', 'A1');
    const pending = ui.pick('TB2', '1A');
    assert.equal(ui.isBusy(), true);
    s.start();
    await pending;
    assert.equal(ui.routing.wires.length, 0);
    assert.equal(ui.isBusy(), false);
    key('Delete');
    required(required(panel)).querySelector('[data-wire-undo]').onclick();
    assert.equal(s.snapshot().externalWires.length, 1);
    assert.equal(ui.setMode('connect'), false);
    s.stop();
    ui.setMode('connect');
    await connect(['MC1', 'A1'], ['TB2', '1A']);
    assert.equal(ui.routing.wires.length, 1);
});
test('evidence highlights multiple nets without selecting a deletable wire or changing topology', async () => {
    const { ui, simulation: s, panel, connect, key } = make();
    await connect(['CONTROL', 'L'], ['QF1', 'L1']);
    await connect(['MC1', 'A1'], ['TB2', '1A']);
    const before = s.circuit().wires;
    ui.trace(['E1', 'W01']);
    assert.equal(ui.routing.selected, null);
    assert.equal(required(required(panel)).querySelector('.wire-list').children.filter((r) => r.classList.contains('evidence')).length, 2);
    assert.equal(required(required(panel)).querySelector('[data-wire-all]').disabled, false);
    key('Delete');
    assert.deepEqual(s.circuit().wires, before);
    ui.clearEvidence();
    ui.render();
    assert.equal(required(required(panel)).querySelector('.wire-list').children.some((r) => r.classList.contains('evidence')), false);
    assert.equal(required(required(panel)).querySelector('[data-wire-all]').disabled, true);
    assert.deepEqual(s.circuit().wires, before);
});
test('diagnostic export keeps the failed connection endpoints and error without changing selection or wiring', async () => {
    const { ui, simulation: s, connect } = make();
    await connect(['TB1', '42B'], ['HL4', '2']);
    const before = s.circuit().wires;
    await connect(['TB1', '42B'], ['HL4', '2']);
    const snapshot = ui.snapshotSession();
    assert.deepEqual(required(snapshot.lastAttempt).from, { component: 'TB1', terminal: '42B' });
    assert.deepEqual(required(snapshot.lastAttempt).to, { component: 'HL4', terminal: '2' });
    assert.equal(required(snapshot.lastAttempt).status, 'failed');
    assert.match(required(required(snapshot.lastAttempt).error), /已經接線/);
    assert.deepEqual(snapshot.pending, { component: 'TB1', terminal: '42B' });
    assert.equal(snapshot.busy, false);
    Object.assign(required(snapshot.lastAttempt).to, {terminal:'1'});
    Object.assign(snapshot.undoOrder, {length:0});
    assert.equal(required(ui.snapshotSession().lastAttempt).to.terminal, '2');
    assert.equal(ui.snapshotSession().undoOrder.length, 1);
    assert.deepEqual(s.circuit().wires, before);
});
test('imported session selects the restored wire and resumes undo across both wire kinds', async () => {
    const { ui, simulation: s, panel, connect, active } = make();
    await connect(['CONTROL', 'L'], ['QF1', 'L1']);
    await connect(['MC1', 'A1'], ['TB2', '1A']);
    await ui.pick('TB1', '42A');
    ui.restoreSession({ mode: 'operate', pending: null, busy: false, selectedWireId: 'E1', evidenceIds: [], undoOrder: ['W01', 'E1'], lastAttempt: null });
    assert.equal(ui.isConnect(), false);
    assert.deepEqual(active(), ['E1']);
    assert.equal(ui.snapshotSession().pending, null);
    required(required(panel)).querySelector('[data-wire-undo]').onclick();
    assert.equal(s.snapshot().externalWires.length, 0);
    assert.equal(ui.routing.wires.length, 1);
    required(required(panel)).querySelector('[data-wire-undo]').onclick();
    assert.equal(ui.routing.wires.length, 0);
});
test('project wiring uses configured external devices and its shared ordered connection service; disposed UI ignores keys', async () => {
    const { createProjectRuntime } = await import('../src/project/runtime.ts');
    const { minimalProject } = await import('./helpers/project-data.ts');
    let panel: Element | undefined;
    const listeners = new Map<string, KeyHandler>();
    Object.defineProperty(globalThis, 'document', {configurable: true, writable: true, value: { createElement: (tag: string|undefined) => new Element(tag), activeElement: { tagName: 'BODY' },
        querySelector: (s: string) => s === '.select-wrap' ? { before: (p: Element) => { panel = p; } } : new Element() }});
    Reflect.deleteProperty(globalThis, 'window');
    const p = minimalProject();
    p.configuration.components.push({ id: 'customSupply', definitionId: 'teaching-ac220-three-phase-source', definitionVersion: 1, placement: null });
    const runtime = createProjectRuntime(p);
    Object.defineProperty(globalThis, 'window', {configurable: true, writable: true, value: { addEventListener: (n: string, h: KeyHandler) => listeners.set(n, h), removeEventListener: (n: string, h: KeyHandler) => { if (listeners.get(n) === h)
            listeners.delete(n); } }});
    const ui = createWirePanel({...runtime.model,setFlap:open=>runtime.movePanel(open)}, { toast() { }, isFlapOpen: () => false, simulation: () => runtime.simulation, runtime });
    await ui.pick('customSupply', 'L1');
    await ui.pick('coil', 'A1');
    assert.equal(runtime.connectionOrder().length, 1);
    assert.equal(runtime.simulation.snapshot().externalWires.length, 1);
    assert.equal(ui.routing, runtime.routing);
    required(required(panel)).querySelector('[data-wire-undo]').onclick();
    assert.equal(runtime.connectionOrder().length, 0);
    assert.equal(typeof ui.dispose, 'function');
    const key = listeners.get('keydown');
    ui.dispose();
    assert.equal(listeners.size, 0);
    required(key)({ key: 'Delete', preventDefault() { } });
    runtime.dispose();
});
