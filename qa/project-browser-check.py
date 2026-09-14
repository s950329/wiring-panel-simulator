"""Browser acceptance against the production and standalone builds.
Run: python qa/project-browser-check.py http://127.0.0.1:4173
Controls receive real pointer events; no production test flags or fake results.
"""
from pathlib import Path
import json
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173'
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'qa-results'
OUT.mkdir(exist_ok=True)
checks = []
errors = []
console = []


def check(ok, label):
    assert ok, label
    checks.append(label)
    (OUT / 'browser-progress.json').write_text(json.dumps({'checks': checks}, indent=2))
    print('PASS:', label, flush=True)


def ready(page):
    page.wait_for_function('window.wiringLab && window.wiringLab.getProject', polling=100, timeout=30000)


def load(page, filename):
    page.locator('[data-project-file]').set_input_files(ROOT / 'examples' / filename)
    page.wait_for_function("document.querySelector('[data-project-status]').textContent.includes('已匯入')", polling=100, timeout=90000)
    assert '未送電' in page.locator('[data-project-status]').inner_text()


def energized(page, component, value):
    page.wait_for_function("([id,value])=>window.wiringLab.getSimulation().result?.evaluation?.loads.some(x=>x.component===id && (x.state==='energized')===value)", arg=[component, value], polling=100, timeout=10000)


def press(page, component, assertion):
    page.locator('#component-select').select_option(component)
    button = page.locator('#details .actions button').filter(has_text='按住手動壓合')
    # Keep the real hit-test and pointer events. SwiftShader can delay animation
    # frames, so scrolling a static HTML control does not depend on a RAF-based
    # stability wait. A hidden, disabled, covered or zero-size button still fails.
    box = button.evaluate('''el=>{el.scrollIntoView({block:'center',behavior:'instant'});
      const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
      return {x:r.x,y:r.y,width:r.width,height:r.height,enabled:!el.disabled,
        hit:el.contains(document.elementFromPoint(x,y))};}''')
    assert box['enabled'] and box['hit'] and box['width'] > 0 and box['height'] > 0, box
    page.mouse.move(box['x'] + box['width']/2, box['y'] + box['height']/2)
    page.mouse.down()
    try:
        assertion()
    finally:
        page.mouse.up()


def run(browser, page):
    page.goto(BASE, wait_until='networkidle')
    ready(page)
    check(page.evaluate('window.wiringLab.getRevision()') == 'WIRE-R13', 'R13 boot')
    check(page.locator('#component-select option').count() == 22, 'default 22 components')
    load(page, 'a04-motor-start.project.json')
    check(page.evaluate('window.wiringLab.getWires().length') == 26, 'A04 native route import')
    page.locator('[data-sim-start]').click()
    energized(page, 'MC1', False)
    press(page, 'PB3', lambda: energized(page, 'MC1', True))
    energized(page, 'MC1', True)
    page.wait_for_function("window.wiringLab.getSimulation().result.evaluation.motors.find(m=>m.component==='M1').state==='powered'", polling=100)
    check(True, 'start, release, self-hold and three-phase motor')
    press(page, 'PB5', lambda: energized(page, 'MC1', False))
    check(True, 'stop button')
    press(page, 'PB3', lambda: energized(page, 'MC1', True))
    page.locator('#component-select').select_option('TH1')
    page.locator('#details button').filter(has_text='TEST').click()
    energized(page, 'MC1', False)
    energized(page, 'HL3', True)
    energized(page, 'BZ1', True)
    check(True, 'overload, red lamp and buzzer')
    page.locator('#details button').filter(has_text='RESET').click()
    energized(page, 'MC1', False)
    energized(page, 'HL3', False)
    check(True, 'RESET does not restart')
    page.screenshot(path=str(OUT / 'a04-loaded.png'), full_page=True)
    page.locator('[data-sim-stop]').click()
    for _ in range(2):
        page.locator('#flap-btn').click()
        assert page.evaluate('window.wiringLab.getProject().configuration.operationPanel.state.open')
        page.locator('#flap-btn').click()
        assert not page.evaluate('window.wiringLab.getProject().configuration.operationPanel.state.open')
    check(True, 'two panel open-close cycles')
    with page.expect_download() as download:
        page.locator('[data-project-export]').click()
    target = OUT / 'browser-export.project.json'
    download.value.save_as(target)
    exported = json.loads(target.read_text())
    check(exported['format'] == 'wiring-panel-project' and len(exported['connections']) == 34 and all(set(w) == {'from', 'to'} for w in exported['connections']), 'download contains endpoints only')
    load(page, 'custom-panel-less.project.json')
    check(page.locator('#component-select option').count() == 2 and page.locator('.equipment-card').count() == 0 and page.locator('#flap-btn').is_hidden(), 'different layout replaces old project')
    page.locator('#component-select').select_option('coil')
    page.locator('#inspect-component').click()
    assert '返回' in page.locator('#inspect-component').inner_text()
    page.locator('#inspect-component').click()
    check(True, 'generic component inspection')
    before = page.evaluate('window.wiringLab.getProject()')
    page.locator('[data-project-file]').set_input_files(ROOT / 'examples/a04-motor-start.project.json')
    page.wait_for_function("document.querySelector('[data-project-status]').textContent.includes('自動走線')", polling=100, timeout=30000)
    page.locator('[data-project-cancel]').click()
    page.wait_for_function("document.querySelector('[data-project-status]').textContent.includes('取消') && !document.querySelector('[data-project-import]').disabled", polling=100, timeout=30000)
    check(page.evaluate('window.wiringLab.getProject()') == before, 'cancel preserves previous project')
    load(page, 'independent-drives.project.json')
    assert page.locator('.equipment-card').count() == 2
    page.locator('[data-sim-start]').click()
    energized(page, 'coil', True)
    energized(page, 'coil-B', False)
    page.locator('[data-source="source-B"]').check()
    energized(page, 'coil-B', True)
    check(True, 'independent source switches')
    page.locator('[data-sim-stop]').click()
    page.locator('#reset-project').click()
    page.wait_for_function("window.wiringLab.getProject().name==='BOARD 024' && document.querySelector('#component-select').options.length===22", polling=100)
    check(page.evaluate('window.wiringLab.getWires().length') == 0, 'reset to default')
    page.close()
    # Opening through both HTTP and file:// checks the delivered offline artifact.
    for url, label in [(BASE + '/wiring-panel.html', 'served standalone'),
                       ((ROOT / 'downloads/wiring-panel-WIRE-R13.html').as_uri(), 'file-protocol standalone')]:
        offline = browser.new_page(viewport={'width': 1500, 'height': 1000})
        offline.on('pageerror', lambda error: errors.append(str(error)))
        offline.goto(url, wait_until='load')
        ready(offline)
        check(offline.evaluate("window.wiringLab.getRevision()==='WIRE-R13' && window.wiringLab.getProject().format==='wiring-panel-project'"), label + ' boot')
        load(offline, 'custom-panel-less.project.json')
        check(offline.locator('#component-select option').count() == 2, label + ' project import')
        offline.close()
    check(not errors, 'no uncaught browser exceptions')


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width': 1500, 'height': 1000}, accept_downloads=True)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: console.append(message.type + ': ' + message.text))
    try:
        run(browser, page)
    except Exception as error:
        details = {'checks': checks, 'error': str(error), 'pageErrors': errors, 'console': console[-50:]}
        if not page.is_closed():
            try:
                details['ui'] = page.evaluate("({status:document.querySelector('[data-project-status]')?.textContent, selection:document.querySelector('#component-select')?.value, inspector:document.querySelector('#details')?.innerText})")
                page.screenshot(path=str(OUT / 'browser-failure.png'), timeout=15000)
            except Exception as capture_error:
                details['captureError'] = str(capture_error)
        (OUT / 'browser-failure.json').write_text(json.dumps(details, ensure_ascii=False, indent=2))
        raise
    finally:
        browser.close()
(OUT / 'browser-results.json').write_text(json.dumps({'status': 'passed', 'checks': checks, 'pageErrors': errors}, ensure_ascii=False, indent=2))
print('PASS: browser acceptance and standalone entries', flush=True)
