/** DOM-only Chromium regression using real native pointer drag events and editor UI.
 * node --import tsx qa/editor-drag-browser-check.ts
 * Requires Playwright Chromium or CHROMIUM_EXECUTABLE. No server or WebGL needed.
 * Only the renderer/viewer and project publication host are fixtures. UI, placement,
 * geometry and drag/drop code are real. This does not test 3D rendering or routing.
 */
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {build} from 'esbuild';
import type {ProjectDocument} from '../src/project/contracts.ts';
import type {createLayoutEditor} from '../src/editor/ui.ts';
import {fileURLToPath} from 'node:url';

interface Feedback {
  tag: string; width: number; height: number; transparent: boolean;
  connected: boolean; pointerEvents: string; ariaHidden: string | null;
  x: number; y: number;
}
type DragWindow = Window & typeof globalThis & {
  dragProbe: {feedback: Feedback[]; trustedStarts: number; payload: string; effect: string};
  dragFixture: {editor: ReturnType<typeof createLayoutEditor>; read(): ProjectDocument};
};
const root = fileURLToPath(new URL('../', import.meta.url));
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_EXECUTABLE, headless: true,
  args: []});
const page = await browser.newPage({viewport: {width: 1400, height: 1000}, locale: 'zh-TW'});
const errors: string[] = [], checks: string[] = [];
page.on('pageerror', error => errors.push(error.message));
const check = (ok: unknown, label: string) => {assert.ok(ok, label); checks.push(label); console.log('PASS:', label);};
try {
  const installProbe = () => {
    const probe = {feedback: [] as Feedback[], trustedStarts: 0, payload: '', effect: ''};
    (window as DragWindow).dragProbe = probe;
    const original = DataTransfer.prototype.setDragImage;
    DataTransfer.prototype.setDragImage = function (image: Element, x: number, y: number) {
      const canvas = image instanceof HTMLCanvasElement ? image : null;
      const pixels = canvas?.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
      probe.feedback.push({tag: image.tagName, width: canvas?.width ?? 0, height: canvas?.height ?? 0,
        transparent: !!pixels && pixels.every((channel, index) => index % 4 !== 3 || channel === 0),
        connected: image.isConnected, pointerEvents: getComputedStyle(image).pointerEvents,
        ariaHidden: image.getAttribute('aria-hidden'), x, y});
      original.call(this, image, x, y);
    };
    document.addEventListener('dragstart', event => {
      if (!(event.target instanceof Element) || !event.target.closest('.layout-card')) return;
      if (event.isTrusted) probe.trustedStarts++;
      probe.payload = event.dataTransfer?.getData('application/x-wiring-component') ?? '';
      probe.effect = event.dataTransfer?.effectAllowed ?? '';
    });
  };
  const bundle = await build({entryPoints: [root + 'qa/helpers/editor-dom.ts'], bundle: true, write: false,
    format: 'iife', platform: 'browser', target: 'es2022', plugins: [{name: 'no-webgl-viewer', setup(build) {
      build.onLoad({filter: /[\\/]src[\\/]editor[\\/]viewer\.ts$/}, () => ({
        contents: 'export class ComponentViewer {thumbnail(){} open(){} close(){} reset(){} dispose(){}}', loader: 'ts'
      }));
    }}]});
  const styles = ['src/style.css', 'src/editor/style.css'].map(path => readFileSync(root + path, 'utf8')).join('\n');
  await page.setContent('<style>' + styles + '</style><div id="app"><header><div class="header-actions"></div></header><main><section class="workspace"><div id="viewport"><canvas tabindex="0" style="width:100%;height:100%"></canvas></div></section><aside class="sidebar"></aside></main></div>');
  await page.evaluate(installProbe);
  await page.addScriptTag({content: bundle.outputFiles[0].text});
  const card = page.locator('.layout-card[data-definition="shihlin-sp16"]');
  await page.locator('#layout-category').selectOption('contactors');
  await card.waitFor({state: 'visible'});
  const rect = await page.locator('#viewport canvas').boundingBox(); assert.ok(rect);
  const center = {x: rect.x + rect.width / 2, y: rect.y + rect.height / 2};
  const edge = {x: rect.x + rect.width - 8, y: center.y};
  const components = () => page.evaluate(() => (window as DragWindow).dragFixture.read().configuration.components);
  const startDrag = async () => {
    const r = await card.boundingBox(); assert.ok(r);
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down();
    await page.mouse.move(r.x + r.width / 2 + 15, r.y + r.height / 2, {steps: 4});
    // A second move over the drop target delivers Chromium's native dragover.
    await page.mouse.move(center.x, center.y, {steps: 8}); await page.mouse.move(center.x + 1, center.y);
  };
  await startDrag();
  const first = await page.evaluate(() => (window as DragWindow).dragProbe);
  check(first.trustedStarts === 1, 'real pointer input dispatches a trusted catalog dragstart');
  check(first.feedback.length === 1, 'catalog dragstart overrides the browser card thumbnail');
  assert.deepEqual(first.feedback[0], {tag: 'CANVAS', width: 1, height: 1, transparent: true,
    connected: true, pointerEvents: 'none', ariaHidden: 'true', x: 0, y: 0});
  check(first.payload === 'shihlin-sp16' && first.effect === 'copy', 'transparent feedback preserves drag payload and copy operation');
  check(await card.isVisible() && await page.locator('dialog[open]').count() === 0,
    'source card stays visible and dragging does not open the detail dialog');
  check((await components()).length === 0, 'preview does not mutate the live project');
  await page.mouse.move(edge.x, edge.y, {steps: 5}); await page.mouse.move(edge.x - 1, edge.y);
  check(await page.locator('.layout-status').evaluate(el => el.classList.contains('invalid')), 'out-of-bounds placement feedback is preserved');
  await page.mouse.move(center.x, center.y, {steps: 5}); await page.mouse.move(center.x + 1, center.y);
  check(!(await page.locator('.layout-status').evaluate(el => el.classList.contains('invalid'))), 'valid grid placement feedback is preserved');
  await page.mouse.up();
  await page.waitForFunction(() => {
    return (window as DragWindow).dragFixture.read().configuration.components.length === 1;
  });
  check((await components())[0]?.definitionId === 'shihlin-sp16', 'native drop places exactly the chosen component');
  await startDrag(); await page.keyboard.press('Escape'); await page.mouse.up();
  check((await components()).length === 1, 'cancelling a second native drag does not add a component');
  check(await page.locator('.layout-drag-image').count() === 1, 'repeated drags reuse a single invisible feedback canvas');
  await card.click(); await page.locator('.layout-dialog[open]').waitFor();
  check(await page.locator('.layout-dialog [data-place]').isVisible(), 'ordinary card click still opens details with click-to-place');
  await page.locator('.layout-dialog [data-close]').click();
  await page.evaluate(() => {
    const {editor} = (window as DragWindow).dragFixture; editor.setActive(false); editor.setActive(true);
  });
  check(await page.locator('.layout-drag-image').count() === 1, 'mode re-entry does not leak extra feedback canvases');
  await page.evaluate(() => (window as DragWindow).dragFixture.editor.dispose());
  check(await page.locator('.layout-drag-image').count() === 0, 'editor disposal removes the feedback canvas');
  assert.deepEqual(errors, []);
  mkdirSync('qa-results', {recursive: true});
  writeFileSync('qa-results/editor-drag-browser.json', JSON.stringify({passed: true, checks, feedback: first.feedback[0], errors}, null, 2) + '\n');
} finally {await browser.close();}
