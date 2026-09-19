/** DOM event fixture: no WebGL renderer and no routing/publication transaction. */
import * as T from 'three';
import {HemisphereCamera} from '../../src/camera.ts';
import {createLayoutEditor} from '../../src/editor/ui.ts';
import type {BoardScene} from '../../src/editor/stage.ts';
import {minimalProject} from './project-data.ts';

const root = document.querySelector<HTMLElement>('#app')!;
const canvas = root.querySelector<HTMLCanvasElement>('#viewport canvas')!;
const world = new T.Group(), scene = new T.Scene();
world.position.set(-400, 0, -320); scene.add(world);
const camera = new T.OrthographicCamera(-1, 1, 1, -1, 1, 5000), orbit = new HemisphereCamera(camera);
const rect = canvas.getBoundingClientRect(); orbit.aspect = rect.width / rect.height;
const app: BoardScene = {world, scene, camera, orbit, renderer: {domElement: canvas}, grid: new T.GridHelper(),
  pick: () => null, select() {}, setFlap() {}, inspect() {}, setConstructionMode() {orbit.preset('construction');}};
let project = minimalProject(); project.configuration.components = []; project.configuration.ducts = [];
const read = () => structuredClone(project);
const editor = createLayoutEditor({root, app, read, canEdit: () => true, load: async next => {project = structuredClone(next);},
  cancelLoad() {}, setPanelOpen() {}, prepare() {}, importFile() {}, saveFile() {}, toast() {}, modeChanged() {}});
Object.assign(window, {dragFixture: {editor, read}});
editor.setActive(true);
