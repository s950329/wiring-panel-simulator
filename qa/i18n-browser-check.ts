/** Optional DOM-only browser acceptance. No WebGL is created.
 * npm run test:browser:i18n -- http://127.0.0.1:5173
 * npm run test:browser:i18n -- --offline .
 * Install Chromium once: npx playwright install chromium
 */
import assert from 'node:assert/strict';
import {mkdir, readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import type {PreferenceStorage as LocaleStorage} from '../src/i18n/contracts.ts';
import type {installLocalization} from '../src/i18n/browser.ts';

interface FixtureState {
  storage: LocaleStorage;
  reference: Element;
  clicks: number;
  project: {name: string; connections: {from: {component: string; terminal: string}; to: {component: string; terminal: string}}[]};
  before: string;
  localization: ReturnType<typeof installLocalization>;
}
type FixtureWindow = Window & typeof globalThis & {i18nFixture: FixtureState};

async function main(): Promise<void> {
  const base = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/$/, '');
  if (base === '--help') {
    console.log('Usage: npm run test:browser:i18n -- [base-url [module-path] | --offline project-directory]');
    return;
  }
  const offline = base === '--offline';
  let moduleURL: string, css: string;
  if (offline) {
    const root = resolve(process.argv[3] ?? '.');
    // Bundle the real TypeScript module; browsers cannot execute TS annotations.
    const result = await build({entryPoints: [resolve(root, 'src/i18n/browser.ts')], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022'});
    assert.equal(result.outputFiles.length, 1);
    moduleURL = 'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64');
    css = '<style>' + await readFile(resolve(root, 'src/style.css'), 'utf8') + '</style>';
  } else {
    moduleURL = base + (process.argv[3] ?? '/src/i18n/browser.ts');
    css = `<link rel="stylesheet" href="${base}/src/style.css">`;
  }
  const fixture = '<div id="app"><header><div class="brand"><strong>配線實作台</strong></div><div class="header-actions"><a class="inspection-link">下載 HTML</a><button>載入預設盤面</button></div></header><main><section class="workspace"><button id="held">按住手動壓合</button><p id="status" role="status">起點 PB1:2 → 請點選終點</p><p id="project-meta" data-i18n-ignore>開始測試</p><span class="id">開始測試</span><input id="project-name" value="開始測試"><details id="expanded" open><summary>固定預接線與銅片</summary><p>尚未接線</p></details><button id="aria" aria-label="縮小">−</button></section><aside class="sidebar"><h1>元件與操作</h1></aside></main></div>';
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_EXECUTABLE, headless: true});
  try {
    const context = await browser.newContext({locale: 'en-US', viewport: {width: 1280, height: 800}});
    const page = await context.newPage();
    // Load only an asset to establish the Vite origin; never boot the renderer.
    if (!offline) await page.goto(base + '/src/style.css');
    await page.setContent(css + fixture);
    await page.evaluate(async url => {
      const {installLocalization, LocaleController}: typeof import('../src/i18n/browser.ts') = await import(url);
      const values = new Map<string, string>();
      const storage: LocaleStorage = {getItem: key => values.get(key) ?? null, setItem: (key, value) => {values.set(key, value);}, removeItem: key => {values.delete(key);}};
      const reference = document.querySelector('#held'), root = document.querySelector<HTMLElement>('#app');
      if (!reference || !root) throw Error('Missing localization fixture');
      const project = {name: '開始測試', connections: [{from: {component: 'PB1', terminal: '2'}, to: {component: 'HL1', terminal: '1'}}]};
      const state: FixtureState = {storage, reference, clicks: 0, project, before: JSON.stringify(project), localization: installLocalization(root, new LocaleController({languages: [...navigator.languages], storage: () => storage}))};
      reference.addEventListener('click', () => state.clicks++);
      (window as FixtureWindow).i18nFixture = state;
    }, moduleURL);
    const select = page.locator('#locale-select');
    assert.equal(await select.count(), 1);
    assert.equal(await select.inputValue(), 'auto');
    assert.equal(await page.locator('#status').innerText(), 'From PB1:2 → Select the destination');
    assert.equal(await page.locator('#aria').getAttribute('aria-label'), 'Zoom out');
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    await select.selectOption('zh-TW');
    assert.equal(await page.locator('#status').innerText(), '起點 PB1:2 → 請點選終點');
    assert.equal(await page.locator('html').getAttribute('lang'), 'zh-Hant');
    assert.equal(await page.evaluate(() => (window as FixtureWindow).i18nFixture.storage.getItem('wiring-panel.locale')), 'zh-TW');
    assert.equal(await select.locator('option[value=auto]').innerText(), '跟隨瀏覽器（English）');
    for (const choice of ['en', 'zh-TW', 'en']) await select.selectOption(choice);
    assert.ok(await page.evaluate(() => (window as FixtureWindow).i18nFixture.reference === document.querySelector('#held')));
    assert.notEqual(await page.locator('#expanded').getAttribute('open'), null);
    assert.equal(await page.locator('#project-meta').innerText(), '開始測試');
    assert.equal(await page.locator('.id').innerText(), '開始測試');
    assert.equal(await page.locator('#project-name').inputValue(), '開始測試');
    assert.ok(await page.evaluate(() => {const s = (window as FixtureWindow).i18nFixture; return JSON.stringify(s.project) === s.before && s.clicks === 0;}));
    await page.locator('#held').click();
    assert.equal(await page.evaluate(() => (window as FixtureWindow).i18nFixture.clicks), 1);
    await page.locator('#status').evaluate(el => {el.textContent = '正在檢查端子出口與走線…';});
    await page.waitForFunction(() => document.querySelector('#status')?.textContent === 'Checking terminal exits and routing…');
    await select.selectOption('zh-TW');
    assert.equal(await page.locator('#status').innerText(), '正在檢查端子出口與走線…');
    await select.selectOption('auto');
    assert.equal(await page.evaluate(() => (window as FixtureWindow).i18nFixture.storage.getItem('wiring-panel.locale')), null);
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    await page.setViewportSize({width: 390, height: 844});
    await mkdir('qa-results', {recursive: true});
    await page.screenshot({path: 'qa-results/i18n-phone.png'});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await select.isVisible());
    await page.evaluate(() => (window as FixtureWindow).i18nFixture.localization.dispose());
    assert.equal(await select.count(), 0);
    await page.locator('#status').evaluate(el => {el.textContent = '開始測試';});
    await page.waitForTimeout(40);
    assert.equal(await page.locator('#status').innerText(), '開始測試');
    console.log(JSON.stringify({passed: true, checks: ['browser default', 'manual preference', 'DOM identity', 'state preservation', 'raw user data', 'dynamic text', 'aria labels', 'automatic reset', 'mobile overflow', 'disposal']}));
  } finally {
    await browser.close();
  }
}
await main();
