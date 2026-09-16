/** Optional real-pointer acceptance for production and standalone builds.
 * Run after npm run build and serving dist:
 * npm run test:browser:project -- http://127.0.0.1:4173
 * Requires npx playwright install chromium, or CHROMIUM_EXECUTABLE.
 * Not part of npm test: this script creates a WebGL renderer.
 */
import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {chromium, type Browser, type Locator, type Page} from 'playwright';
import {MODEL_REVISION} from '../src/revision.ts';
import type {ProjectDocument} from '../src/project/contracts.ts';

const BASE = (process.argv[2] ?? 'http://127.0.0.1:4173').replace(/\/$/, '');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'qa-results');
const checks: string[] = [], errors: string[] = [], messages: string[] = [];
const captureWarnings: {file: string; error: string}[] = [];
const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error);
function writeJSON(name: string, value: unknown): void {
  writeFileSync(join(OUT, name), JSON.stringify(value, null, 2) + '\n');
}
function check(ok: unknown, label: string): void {
  assert.ok(ok, label);
  checks.push(label);
  writeJSON('browser-progress.json', {checks});
  console.log('PASS:', label);
}
async function ready(page: Page): Promise<void> {
  await page.waitForFunction(() => window.wiringLab && 'getProject' in window.wiringLab, undefined, {polling: 100, timeout: 30000});
  // Labels are assertions too; make the QA locale explicit without changing app defaults.
  await page.evaluate(() => window.wiringLab?.setLocale?.('zh-TW'));
}
async function state(page: Page) {
  return page.evaluate(() => {
    const lab = window.wiringLab;
    if (!lab || !('getProject' in lab)) throw Error('Project app did not initialize');
    return {revision: lab.getRevision(), project: lab.getProject(), simulation: lab.getSimulation(), wires: lab.getWires()};
  });
}
async function load(page: Page, filename: string): Promise<void> {
  await page.locator('[data-project-file]').setInputFiles(join(ROOT, 'examples', filename));
  await page.waitForFunction(() => document.querySelector('[data-project-status]')?.textContent?.includes('已匯入'), undefined, {polling: 100, timeout: 90000});
  assert.match(await page.locator('[data-project-status]').innerText(), /模擬未執行/);
}
async function energized(page: Page, component: string, value: boolean): Promise<void> {
  await page.waitForFunction(([id, expected]) => {
    const lab = window.wiringLab;
    return lab && 'getProject' in lab && lab.getSimulation().result?.evaluation?.loads.some(load => load.component === id && (load.state === 'energized') === expected);
  }, [component, value] as const, {polling: 100, timeout: 10000});
}
async function pointerTarget(button: Locator): Promise<[number, number]> {
  // Check the actual DOM hit target, then send real pointer events.
  const box = await button.evaluate(el => {
    el.scrollIntoView({block: 'center', behavior: 'instant'});
    const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    return {x: r.x, y: r.y, width: r.width, height: r.height, enabled: el instanceof HTMLButtonElement && !el.disabled, hit: el.contains(document.elementFromPoint(x, y))};
  });
  assert.ok(box.enabled && box.hit && box.width > 0 && box.height > 0, JSON.stringify(box));
  return [box.x + box.width / 2, box.y + box.height / 2];
}
async function click(page: Page, button: Locator): Promise<void> {
  await page.mouse.click(...await pointerTarget(button));
}
async function toggleQF(page: Page): Promise<void> {
  await page.locator('#component-select').selectOption('QF1');
  await click(page, page.locator('#details .actions button').filter({hasText: '切換 ON／OFF'}));
}
async function press(page: Page, component: string, assertion: () => Promise<void>): Promise<void> {
  await page.locator('#component-select').selectOption(component);
  const button = page.locator('#details .actions button').filter({hasText: '按住手動壓合'});
  await page.mouse.move(...await pointerTarget(button));
  await page.mouse.down();
  try {await assertion();} finally {await page.mouse.up();}
}
async function capture(page: Page, name: string): Promise<void> {
  // A software-render screenshot timeout is recorded as a warning, never a pass.
  try {await page.screenshot({path: join(OUT, name), fullPage: false, timeout: 10000});}
  catch (error) {
    captureWarnings.push({file: name, error: messageOf(error)});
    console.warn('CAPTURE WARNING:', name, messageOf(error));
    writeJSON('capture-warnings.json', captureWarnings);
  }
}
async function run(browser: Browser, page: Page): Promise<void> {
  await page.goto(BASE, {waitUntil: 'networkidle'});
  await ready(page);
  check((await state(page)).revision === MODEL_REVISION, `${MODEL_REVISION} boot`);
  check(await page.locator('#component-select option').count() === 22, 'default 22 components');
  await load(page, 'a04-motor-start.project.json');
  check((await state(page)).wires.length === 28, 'A04 native route import');
  check(await page.locator('[data-source], .supply-switches').count() === 0, 'no independent source controls');
  check(await page.locator('.equipment-card').count() === 2 && await page.locator('[data-equipment="CONTROL"]').count() === 0, 'only MAIN supply and M1 motor equipment');
  const breaker = (await state(page)).project.configuration.components.find(c => c.id === 'QF1');
  assert.ok(breaker?.state);
  check(!breaker.state.on, 'A04 defaults to QF1 OFF');
  await click(page, page.locator('[data-sim-start]'));
  await energized(page, 'MC1', false);
  await press(page, 'PB3', () => energized(page, 'MC1', false));
  await toggleQF(page);
  await press(page, 'PB3', () => energized(page, 'MC1', true));
  await energized(page, 'MC1', true);
  await page.waitForFunction(() => {
    const lab = window.wiringLab;
    return lab && 'getProject' in lab && lab.getSimulation().result?.evaluation?.motors.find(m => m.component === 'M1')?.state === 'powered';
  }, undefined, {polling: 100});
  await toggleQF(page);
  await energized(page, 'MC1', false);
  await energized(page, 'HL4', false);
  await toggleQF(page);
  await energized(page, 'MC1', false);
  check(true, 'QF1 cuts coil and lamp, restoration with released ON does not restart');
  await press(page, 'PB3', () => energized(page, 'MC1', true));
  check(true, 'start, release, self-hold and three-phase motor');
  await press(page, 'PB5', () => energized(page, 'MC1', false));
  check(true, 'stop button');
  await press(page, 'PB3', () => energized(page, 'MC1', true));
  await page.locator('#component-select').selectOption('TH1');
  await click(page, page.locator('#details button').filter({hasText: 'TEST'}));
  await energized(page, 'MC1', false);
  await energized(page, 'HL3', true);
  await energized(page, 'BZ1', true);
  check(true, 'overload, red lamp and buzzer');
  await toggleQF(page);
  await energized(page, 'HL3', false);
  await energized(page, 'BZ1', false);
  await toggleQF(page);
  await energized(page, 'HL3', true);
  await energized(page, 'BZ1', true);
  check(true, 'QF1 also removes and restores the real overload-alarm supply');
  await page.locator('#component-select').selectOption('TH1');
  await click(page, page.locator('#details button').filter({hasText: 'RESET'}));
  await energized(page, 'MC1', false);
  await energized(page, 'HL3', false);
  check(true, 'RESET does not restart');
  const evaluated = (await state(page)).simulation.evaluatedCircuit;
  assert.ok(evaluated);
  assert.equal(evaluated.threePhaseSources?.length, 1);
  check(evaluated.sources.length === 0, 'actual solver has one original source, no CONTROL');
  await capture(page, 'a04-loaded.png');
  await click(page, page.locator('[data-sim-stop]'));
  for (let i = 0; i < 2; i++) {
    await click(page, page.locator('#flap-btn'));
    assert.equal((await state(page)).project.configuration.operationPanel?.state.open, true);
    await click(page, page.locator('#flap-btn'));
    assert.equal((await state(page)).project.configuration.operationPanel?.state.open, false);
  }
  check(true, 'two panel open-close cycles');
  const downloading = page.waitForEvent('download');
  await click(page, page.locator('[data-project-export]'));
  const target = join(OUT, 'browser-export.project.json');
  await (await downloading).saveAs(target);
  const exported: ProjectDocument = JSON.parse(readFileSync(target, 'utf8'));
  check(exported.format === 'wiring-panel-project' && exported.connections.length === 31 && exported.connections.every(w => JSON.stringify(Object.keys(w).sort()) === '["from","to"]'), 'download contains endpoints only');
  await load(page, 'custom-panel-less.project.json');
  check(await page.locator('#component-select option').count() === 2 && await page.locator('.equipment-card').count() === 0 && await page.locator('#flap-btn').isHidden(), 'different layout replaces old project');
  await page.locator('#component-select').selectOption('coil');
  await click(page, page.locator('#inspect-component'));
  assert.match(await page.locator('#inspect-component').innerText(), /返回/);
  await click(page, page.locator('#inspect-component'));
  check(true, 'generic component inspection');
  const before = (await state(page)).project;
  await page.locator('[data-project-file]').setInputFiles(join(ROOT, 'examples/a04-motor-start.project.json'));
  await page.waitForFunction(() => document.querySelector('[data-project-status]')?.textContent?.includes('自動走線'), undefined, {polling: 100, timeout: 30000});
  await click(page, page.locator('[data-project-cancel]'));
  await page.waitForFunction(() => document.querySelector('[data-project-status]')?.textContent?.includes('取消') && !document.querySelector<HTMLButtonElement>('[data-project-import]')?.disabled, undefined, {polling: 100, timeout: 30000});
  assert.deepEqual((await state(page)).project, before);
  check(true, 'cancel preserves previous project');
  await load(page, 'shared-source-drives.project.json');
  assert.equal(await page.locator('.equipment-card').count(), 1);
  await click(page, page.locator('[data-sim-start]'));
  await energized(page, 'coil', true);
  await energized(page, 'coil-B', false);
  await page.locator('#component-select').selectOption('thermal-B');
  await click(page, page.locator('#details button').filter({hasText: 'RESET'}));
  await energized(page, 'coil-B', true);
  await page.locator('#component-select').selectOption('thermal');
  await click(page, page.locator('#details button').filter({hasText: 'TEST'}));
  await energized(page, 'coil', false);
  await energized(page, 'coil-B', true);
  check(true, 'one shared source, two independent physical thermal contacts');
  await click(page, page.locator('[data-sim-stop]'));
  await click(page, page.locator('#reset-project'));
  await page.waitForFunction(() => {
    const lab = window.wiringLab;
    return lab && 'getProject' in lab && lab.getProject().name === 'BOARD 024' && document.querySelector<HTMLSelectElement>('#component-select')?.options.length === 22;
  }, undefined, {polling: 100});
  check((await state(page)).wires.length === 0, 'reset to default');
  await page.close();
  for (const [url, label] of [[BASE + '/wiring-panel.html', 'served standalone'], [pathToFileURL(join(ROOT, `downloads/wiring-panel-${MODEL_REVISION}.html`)).href, 'file-protocol standalone']]) {
    const offline = await browser.newPage({locale: 'zh-TW', viewport: {width: 1500, height: 1000}});
    offline.on('pageerror', error => errors.push(messageOf(error)));
    try {
      await offline.goto(url, {waitUntil: 'load'});
      await ready(offline);
      const boot = await state(offline);
      check(boot.revision === MODEL_REVISION && boot.project.format === 'wiring-panel-project', label + ' boot');
      await load(offline, 'custom-panel-less.project.json');
      check(await offline.locator('#component-select option').count() === 2, label + ' project import');
    } finally {await offline.close();}
  }
  check(errors.length === 0, 'no uncaught browser exceptions');
}
async function main(): Promise<void> {
  if (BASE === '--help') {
    console.log('Usage: npm run test:browser:project -- [production-base-url]');
    return;
  }
  mkdirSync(OUT, {recursive: true});
  const browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  const page = await browser.newPage({locale: 'zh-TW', viewport: {width: 1500, height: 1000}, acceptDownloads: true});
  page.on('pageerror', error => errors.push(messageOf(error)));
  page.on('console', message => messages.push(message.type() + ': ' + message.text()));
  try {
    await run(browser, page);
  } catch (error) {
    const details: Record<string, unknown> = {checks, error: messageOf(error), pageErrors: errors, console: messages.slice(-50)};
    if (!page.isClosed()) {
      try {
        details.ui = await page.evaluate(() => ({status: document.querySelector('[data-project-status]')?.textContent, selection: document.querySelector<HTMLSelectElement>('#component-select')?.value, inspector: document.querySelector<HTMLElement>('#details')?.innerText}));
        await capture(page, 'browser-failure.png');
      } catch (captureError) {details.captureError = messageOf(captureError);}
    }
    writeJSON('browser-failure.json', details);
    throw error;
  } finally {await browser.close();}
  writeJSON('browser-results.json', {status: 'passed', checks, pageErrors: errors, captureWarnings});
  console.log('PASS: browser acceptance and standalone entries');
}
await main();
