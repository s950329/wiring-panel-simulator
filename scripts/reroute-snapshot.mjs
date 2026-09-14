import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as T from 'three';
import {buildModel} from '../src/scene.js';
import {WiringController} from '../src/wiring/controller.js';
import {SimulationController} from '../src/application/simulation.ts';
import {importBoardSnapshot} from '../src/application/board-import.ts';
import {createBoardSnapshot} from '../src/application/board-snapshot.ts';
import {prepareWireRestore} from '../src/wiring/restore.ts';

// The same non-rendering canvas adapter used by the project's geometry tests.
// Labels are planes and are not physical routing obstacles.
function ensureCanvasAdapter() {
  globalThis.document ??= {createElement: () => ({getContext: () => ({fillRect() {}, strokeRect() {}, fillText() {}})})};
}
export function createRuntime() {
  ensureCanvasAdapter();
  const model = buildModel(new T.Scene());
  const routing = new WiringController(model.world, model.components);
  const simulation = new SimulationController(model.components, () => routing.wires);
  return {...model, routing, simulation, page: 'board'};
}

/** Explicit offline reroute; ordinary snapshot import continues to preserve saved geometry. */
export function rerouteSnapshot(source, {closePanel = false, progress = () => {}} = {}) {
  const runtime = createRuntime();
  const imported = importBoardSnapshot(source, runtime); // Includes actual geometry validation.
  const {world, components, routing, simulation, flap} = runtime;
  const topology = routing.snapshot().map(({id, from, to}) => ({id, from, to}));
  // Drop ALL old saved routes. Leaving some old routes in place would reserve their bad lanes.
  routing.replacePrepared(prepareWireRestore(world, components, []));
  for (const wire of topology) {
    // Keep source IDs even if a prior edit left gaps in their sequence.
    routing.sequence = Number(wire.id.slice(1)) - 1;
    try {routing.connect(wire.from, wire.to);}
    catch (error) {throw new Error(`${wire.id} (${wire.from.component}:${wire.from.terminal} → ${wire.to.component}:${wire.to.terminal}): ${error.message}`, {cause: error});}
    progress(wire.id);
  }
  routing.sequence = Math.max(0, ...topology.map(w => Number(w.id.slice(1))));
  const view = structuredClone(imported.view);
  if (closePanel && view.operationPanelOpen) {
    const moving = new Set([...components.values()].filter(c => c.root.parent === flap).map(c => c.id));
    routing.movePanel(() => {flap.rotation.x = 0;}, () => {flap.rotation.x = Math.PI;}, moving);
    view.operationPanelOpen = false; view.panelAngle = 0;
  }
  routing.select(null);
  for (const c of components.values()) c.updateView(components.get(c.placement.parentId), true);
  const snapshot = createBoardSnapshot({components, physicalWires: routing.snapshot(), simulation, view,
    wiringSession: {...imported.session, mode: 'operate', pending: null, busy: false, selectedWireId: null,
      evidenceIds: [], lastAttempt: null}});
  // A new model must accept the exact exported geometry without changing any route.
  const verification = createRuntime();
  importBoardSnapshot(JSON.stringify(snapshot), verification);
  return snapshot;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, output, option] = process.argv.slice(2);
  if (!input || !output || (option && option !== '--close-panel') || process.argv.length > 5) {
    console.error('Usage: node --import tsx scripts/reroute-snapshot.mjs INPUT.json OUTPUT.json [--close-panel]');
    process.exitCode = 1;
  } else if (resolve(input) === resolve(output)) {
    console.error('Choose a different output file; the original snapshot must be preserved.');
    process.exitCode = 1;
  } else {
    try {
      const snapshot = rerouteSnapshot(await readFile(input, 'utf8'), {closePanel: option === '--close-panel', progress: id => console.log(`Native route: ${id}`)});
      await mkdir(dirname(resolve(output)), {recursive: true});
      await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, {flag: 'wx'});
      console.log(`Verified import: ${snapshot.wiring.physical.length} physical + ${snapshot.wiring.external.length} external wires; simulation off.`);
    } catch (error) {console.error(error); process.exitCode = 1;}
  }
}
