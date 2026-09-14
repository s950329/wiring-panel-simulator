import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {buildModel} from '../src/scene.js';
import {createWirePanel} from '../src/wiring/panel.js';
import {SimulationController} from '../src/application/simulation.ts';

// Event/state seam only: real panel and routing, minimal DOM slots. This is not browser E2E.
class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.attributes = {}; this.disabled = false;
    this.classes = new Set(); this.classList = {toggle: (k, b) => b ? this.classes.add(k) : this.classes.delete(k), contains: k => this.classes.has(k)};
  }
  set innerHTML(value) {
    this.html = value;
    this.controls = new Map(['.wire-prompt', '[data-wire-cancel]', '[data-wire-undo]', '[data-wire-all]',
      '[data-wire-mode="connect"]', '[data-wire-mode="operate"]', '.wire-list'].map(s => [s, new Element('button')]));
    for (const mode of ['connect', 'operate']) this.controls.get(`[data-wire-mode="${mode}"]`).dataset.wireMode = mode;
  }
  get innerHTML() {return this.html;}
  querySelector(s) {return this.controls.get(s);}
  querySelectorAll(s) {return s === '[data-wire-mode]' ? ['connect', 'operate'].map(m => this.controls.get(`[data-wire-mode="${m}"]`)) : [];}
  setAttribute(k, v) {this.attributes[k] = v;}
  append(...nodes) {this.children.push(...nodes);}
  replaceChildren(...nodes) {this.children = nodes;}
  getContext() {return {fillRect() {}, strokeRect() {}, fillText() {}};}
}
function make() {
  let panel, simulation;
  const listeners = new Map();
  globalThis.document = {createElement: tag => new Element(tag), activeElement: {tagName: 'BODY'},
    querySelector: s => s === '.select-wrap' ? {before: p => {panel = p;}} : new Element()};
  delete globalThis.window; const app = buildModel(new T.Scene());
  globalThis.window = {addEventListener: (name, handler) => listeners.set(name, handler)};
  const ui = createWirePanel(app, {toast: () => {}, isFlapOpen: () => true, simulation: () => simulation});
  simulation = new SimulationController(app.components, () => ui.routing.wires);
  const connect = async (a, b) => {await ui.pick(...a); await ui.pick(...b);};
  const active = () => panel.querySelector('.wire-list').children.filter(r => r.classList.contains('active')).map(r => r.children[0].dataset.wireId);
  return {ui, simulation, panel, connect, active, key: key => listeners.get('keydown')({key, preventDefault() {}})};
}
test('repeated undo follows addition order across external and physical wires', async () => {
  const {ui, simulation: s, panel, connect} = make();
  await connect(['CONTROL', 'L'], ['QF1', 'L1']);
  await connect(['MC1', 'A1'], ['TB2', '1A']);
  await connect(['MAIN', 'L1'], ['QF1', 'L2']);
  const undo = panel.querySelector('[data-wire-undo]');
  undo.onclick(); assert.equal(s.snapshot().externalWires.length, 1); assert.equal(undo.disabled, false);
  undo.onclick(); assert.equal(ui.routing.wires.length, 0); assert.equal(undo.disabled, false);
  undo.onclick(); assert.equal(s.snapshot().externalWires.length, 0); assert.equal(undo.disabled, true);
});
test('a new physical wire replaces external selection and Delete removes that visible selection', async () => {
  const {ui, simulation: s, connect, active, key} = make();
  await connect(['CONTROL', 'L'], ['QF1', 'L1']);
  if (!active().includes('E1')) ui.select('E1');
  await connect(['MC1', 'A1'], ['TB2', '1A']);
  assert.deepEqual(active(), ['W01']); assert.equal(ui.routing.selected, 'W01');
  key('Delete'); assert.equal(ui.routing.wires.length, 0); assert.deepEqual(s.snapshot().externalWires.map(w => w.id), ['E1']);
});
test('pending routing rejects a source start race and every panel deletion path stays locked', async () => {
  const {ui, simulation: s, panel, connect, key} = make();
  await connect(['CONTROL', 'L'], ['QF1', 'L1']);
  await ui.pick('MC1', 'A1'); const pending = ui.pick('TB2', '1A');
  assert.equal(ui.isBusy(), true); s.start(); await pending;
  assert.equal(ui.routing.wires.length, 0); assert.equal(ui.isBusy(), false);
  key('Delete'); panel.querySelector('[data-wire-undo]').onclick();
  assert.equal(s.snapshot().externalWires.length, 1); assert.equal(ui.setMode('connect'), false);
  s.stop(); ui.setMode('connect'); await connect(['MC1', 'A1'], ['TB2', '1A']);
  assert.equal(ui.routing.wires.length, 1);
});

test('evidence highlights multiple nets without selecting a deletable wire or changing topology', async () => {
  const {ui, simulation: s, panel, connect, key} = make();
  await connect(['CONTROL', 'L'], ['QF1', 'L1']);
  await connect(['MC1', 'A1'], ['TB2', '1A']);
  const before = s.circuit().wires;
  ui.trace(['E1', 'W01']); assert.equal(ui.routing.selected, null);
  assert.equal(panel.querySelector('.wire-list').children.filter(r => r.classList.contains('evidence')).length, 2);
  assert.equal(panel.querySelector('[data-wire-all]').disabled, false);
  key('Delete'); assert.deepEqual(s.circuit().wires, before);
  ui.clearEvidence(); ui.render();
  assert.equal(panel.querySelector('.wire-list').children.some(r => r.classList.contains('evidence')), false);
  assert.equal(panel.querySelector('[data-wire-all]').disabled, true);
  assert.deepEqual(s.circuit().wires, before);
});

test('diagnostic export keeps the failed connection endpoints and error without changing selection or wiring', async () => {
  const {ui, simulation: s, connect} = make();
  await connect(['TB1', '42B'], ['HL4', '2']);
  const before = s.circuit().wires;
  await connect(['TB1', '42B'], ['HL4', '2']);
  const snapshot = ui.snapshotSession();
  assert.deepEqual(snapshot.lastAttempt.from, {component: 'TB1', terminal: '42B'});
  assert.deepEqual(snapshot.lastAttempt.to, {component: 'HL4', terminal: '2'});
  assert.equal(snapshot.lastAttempt.status, 'failed'); assert.match(snapshot.lastAttempt.error, /已經接線/);
  assert.deepEqual(snapshot.pending, {component: 'TB1', terminal: '42B'}); assert.equal(snapshot.busy, false);
  snapshot.lastAttempt.to.terminal = '1'; snapshot.undoOrder.length = 0;
  assert.equal(ui.snapshotSession().lastAttempt.to.terminal, '2'); assert.equal(ui.snapshotSession().undoOrder.length, 1);
  assert.deepEqual(s.circuit().wires, before);
});

test('imported session selects the restored wire and resumes undo across both wire kinds', async () => {
  const {ui, simulation: s, panel, connect, active} = make();
  await connect(['CONTROL', 'L'], ['QF1', 'L1']); await connect(['MC1', 'A1'], ['TB2', '1A']);
  await ui.pick('TB1', '42A');
  ui.restoreSession({mode: 'operate', pending: null, busy: false, selectedWireId: 'E1', evidenceIds: [], undoOrder: ['W01', 'E1'], lastAttempt: null});
  assert.equal(ui.isConnect(), false); assert.deepEqual(active(), ['E1']); assert.equal(ui.snapshotSession().pending, null);
  panel.querySelector('[data-wire-undo]').onclick();
  assert.equal(s.snapshot().externalWires.length, 0); assert.equal(ui.routing.wires.length, 1);
  panel.querySelector('[data-wire-undo]').onclick(); assert.equal(ui.routing.wires.length, 0);
});

test('project wiring uses configured external devices and its shared ordered connection service; disposed UI ignores keys', async()=>{
 const {createProjectRuntime}=await import('../src/project/runtime.ts');const {minimalProject}=await import('./helpers/project-data.mjs');
 let panel;const listeners=new Map();globalThis.document={createElement:tag=>new Element(tag),activeElement:{tagName:'BODY'},
  querySelector:s=>s==='.select-wrap'?{before:p=>{panel=p}}:new Element()};delete globalThis.window;
 const p=minimalProject();p.configuration.components.push({id:'customSupply',definitionId:'teaching-ac220-three-phase-source',definitionVersion:1,placement:null});
 const runtime=createProjectRuntime(p);globalThis.window={addEventListener:(n,h)=>listeners.set(n,h),removeEventListener:(n,h)=>{if(listeners.get(n)===h)listeners.delete(n)}};
 const ui=createWirePanel(runtime.model,{toast(){},isFlapOpen:()=>false,simulation:()=>runtime.simulation,runtime});
 await ui.pick('customSupply','L1');await ui.pick('coil','A1');assert.equal(runtime.connectionOrder().length,1);
 assert.equal(runtime.simulation.snapshot().externalWires.length,1);assert.equal(ui.routing,runtime.routing);
 panel.querySelector('[data-wire-undo]').onclick();assert.equal(runtime.connectionOrder().length,0);
 assert.equal(typeof ui.dispose,'function');const key=listeners.get('keydown');ui.dispose();assert.equal(listeners.size,0);key({key:'Delete',preventDefault(){}});runtime.dispose();
});
