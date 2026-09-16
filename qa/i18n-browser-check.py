"""Optional DOM-only browser checks; no WebGL is created.
Serve the project with Vite, then run:
  python qa/i18n-browser-check.py http://127.0.0.1:5173
Requires Python Playwright and Chromium (not part of the Node CI suite).
"""
import json
import sys
import base64
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

base = sys.argv[1].rstrip('/') if len(sys.argv) > 1 else 'http://127.0.0.1:5173'
offline = base == '--offline'
module = sys.argv[2] if len(sys.argv) > 2 else '/src/i18n/browser.ts'
if offline:
    directory = Path(module).resolve()
    cache = {}
    def data_module(path):
        path = path.resolve()
        if path not in cache:
            source = path.read_text()
            source = re.sub(r'''from ['"]([^'"]+)['"]''', lambda m: 'from ' + json.dumps(data_module(path.parent / m[1])), source)
            cache[path] = 'data:text/javascript;base64,' + base64.b64encode(source.encode()).decode()
        return cache[path]
    module_url = data_module(directory / 'src/i18n/browser.ts')
    css = '<style>' + (directory / 'src/style.css').read_text() + '</style>'
else:
    module_url = base + module
    css = f'<link rel="stylesheet" href="{base}/src/style.css">'

fixture = '''<div id="app"><header><div class="brand"><strong>配線實作台</strong></div><div class="header-actions"><a class="inspection-link">下載 HTML</a><button>載入預設盤面</button></div></header><main><section class="workspace"><button id="held">按住手動壓合</button><p id="status" role="status">起點 PB1:2 → 請點選終點</p><p id="project-meta" data-i18n-ignore>開始測試</p><span class="id">開始測試</span><input id="project-name" value="開始測試"><details id="expanded" open><summary>固定預接線與銅片</summary><p>尚未接線</p></details><button id="aria" aria-label="縮小">−</button></section><aside class="sidebar"><h1>元件與操作</h1></aside></main></div>'''
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    context = browser.new_context(locale='en-US', viewport={'width': 1280, 'height': 800})
    page = context.new_page()
    # Request a same-origin asset, but do not execute the application's WebGL entry point.
    if not offline:
        page.goto(base + '/src/style.css')
    page.set_content(css + fixture)
    page.evaluate('''async module => {
      const {installLocalization, LocaleController} = await import(module);
      const values = new Map();
      window.localeStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
      window.reference = document.querySelector('#held');
      window.clicks = 0; reference.addEventListener('click', () => clicks++);
      window.project = {name:'開始測試',connections:[{from:{component:'PB1',terminal:'2'},to:{component:'HL1',terminal:'1'}}]};
      window.before = JSON.stringify(project);
      window.localization = installLocalization(document.querySelector('#app'), new LocaleController({languages:[...navigator.languages],storage:()=>localeStorage}));
    }''', module_url)
    select = page.locator('#locale-select')
    assert select.count() == 1
    assert select.input_value() == 'auto'
    assert page.locator('#status').inner_text() == 'From PB1:2 → Select the destination'
    assert page.locator('#aria').get_attribute('aria-label') == 'Zoom out'
    assert page.locator('html').get_attribute('lang') == 'en'
    select.select_option('zh-TW')
    assert page.locator('#status').inner_text() == '起點 PB1:2 → 請點選終點'
    assert page.locator('html').get_attribute('lang') == 'zh-Hant'
    assert page.evaluate('localeStorage.getItem("wiring-panel.locale")') == 'zh-TW'
    assert select.locator('option[value=auto]').inner_text() == '跟隨瀏覽器（English）'
    for choice in ['en', 'zh-TW', 'en']:
        select.select_option(choice)
    assert page.evaluate('reference === document.querySelector("#held")')
    assert page.locator('#expanded').get_attribute('open') is not None
    assert page.locator('#project-meta').inner_text() == '開始測試'
    assert page.locator('.id').inner_text() == '開始測試'
    assert page.locator('#project-name').input_value() == '開始測試'
    assert page.evaluate('JSON.stringify(project) === before && clicks === 0')
    page.locator('#held').click()
    assert page.evaluate('clicks') == 1
    page.evaluate('document.querySelector("#status").textContent="正在檢查端子出口與走線…"')
    page.wait_for_function('document.querySelector("#status").textContent === "Checking terminal exits and routing…"')
    select.select_option('zh-TW')
    assert page.locator('#status').inner_text() == '正在檢查端子出口與走線…'
    select.select_option('auto')
    assert page.evaluate('localeStorage.getItem("wiring-panel.locale")') is None
    assert page.locator('html').get_attribute('lang') == 'en'
    # English layout must not overflow horizontally at phone width.
    page.set_viewport_size({'width':390,'height':844})
    output = Path('qa-results/i18n-phone.png')
    output.parent.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(output))
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert page.locator('#locale-select').is_visible()
    page.evaluate('localization.dispose()')
    assert page.locator('#locale-select').count() == 0
    page.evaluate('document.querySelector("#status").textContent="開始測試"')
    page.wait_for_timeout(40)
    assert page.locator('#status').inner_text() == '開始測試'
    print(json.dumps({'passed': True, 'checks': ['browser default', 'manual preference', 'DOM identity', 'state preservation', 'raw user data', 'dynamic text', 'aria labels', 'automatic reset', 'mobile overflow', 'disposal']}))
    browser.close()
