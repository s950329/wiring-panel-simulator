"""Browser acceptance against the production and standalone builds.
Run: python qa/project-browser-check.py http://127.0.0.1:4173
Controls receive real pointer events; no production test flags or fake results.
"""
from pathlib import Path
import json
import sys
import os
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173'
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'qa-results'
OUT.mkdir(exist_ok=True)
checks = []
errors = []
console = []
capture_warnings = []


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
    assert '模擬未執行' in page.locator('[data-project-status]').inner_text()


def energized(page, component, value):
    page.wait_for_function("([id,value])=>window.wiringLab.getSimulation().result?.evaluation?.loads.some(x=>x.component===id && (x.state==='energized')===value)", arg=[component, value], polling=100, timeout=10000)


def pointer_target(button):
    # Independent DOM geometry/hit checks retain real pointer semantics without
    # requiring a stable WebGL animation frame for a static HTML control.
    box = button.evaluate('''el=>{el.scrollIntoView({block:'center',behavior:'instant'});
      const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
      return {x:r.x,y:r.y,width:r.width,height:r.height,enabled:!el.disabled,
        hit:el.contains(document.elementFromPoint(x,y))};}''')
    assert box['enabled'] and box['hit'] and box['width'] > 0 and box['height'] > 0, box
    return box['x'] + box['width']/2, box['y'] + box['height']/2


def click(page, button):
    page.mouse.click(*pointer_target(button))


def toggle_qf(page):
    page.locator('#component-select').select_option('QF1')
    click(page, page.locator('#details .actions button').filter(has_text='切換 ON／OFF'))


def press(page, component, assertion):
    page.locator('#component-select').select_option(component)
    button = page.locator('#details .actions button').filter(has_text='按住手動壓合')
    page.mouse.move(*pointer_target(button))
    page.mouse.down()
    try:
        assertion()
    finally:
        page.mouse.up()


def capture(page, name):
    # Capturing a software-rendered frame must not prevent the remaining
    # functional checks from running. A timeout is recorded, never called a pass.
    try:
        page.screenshot(path=str(OUT / name), full_page=False, timeout=10000)
    except Exception as error:
        capture_warnings.append({'file': name, 'error': str(error)})
        print('CAPTURE WARNING:', name, str(error), flush=True)
        (OUT / 'capture-warnings.json').write_text(json.dumps(capture_warnings, indent=2))


def run(browser, page):
    page.goto(BASE, wait_until='networkidle')
    ready(page)
    check(page.evaluate('window.wiringLab.getRevision()') == 'WIRE-R17', 'R17 boot')
    check(page.locator('#component-select option').count() == 22, 'default 22 components')
    load(page, 'a04-motor-start.project.json')
    check(page.evaluate('window.wiringLab.getWires().length') == 28, 'A04 native route import')
    check(page.locator('[data-source], .supply-switches').count() == 0, 'no independent source controls')
    check(page.locator('.equipment-card').count() == 2 and page.locator('[data-equipment="CONTROL"]').count() == 0, 'only MAIN supply and M1 motor equipment')
    check(not page.evaluate("window.wiringLab.getProject().configuration.components.find(c=>c.id==='QF1').state.on"), 'A04 defaults to QF1 OFF')
    click(page, page.locator('[data-sim-start]'))
    energized(page, 'MC1', False)
    press(page, 'PB3', lambda: energized(page, 'MC1', False))
    toggle_qf(page)
    press(page, 'PB3', lambda: energized(page, 'MC1', True))
    energized(page, 'MC1', True)
    page.wait_for_function("window.wiringLab.getSimulation().result.evaluation.motors.find(m=>m.component==='M1').state==='powered'", polling=100)
    toggle_qf(page)
    energized(page, 'MC1', False)
    energized(page, 'HL4', False)
    toggle_qf(page)
    energized(page, 'MC1', False)
    check(True, 'QF1 cuts coil and lamp, restoration with released ON does not restart')
    press(page, 'PB3', lambda: energized(page, 'MC1', True))
    check(True, 'start, release, self-hold and three-phase motor')
    press(page, 'PB5', lambda: energized(page, 'MC1', False))
    check(True, 'stop button')
    press(page, 'PB3', lambda: energized(page, 'MC1', True))
    page.locator('#component-select').select_option('TH1')
    click(page, page.locator('#details button').filter(has_text='TEST'))
    energized(page, 'MC1', False)
    energized(page, 'HL3', True)
    energized(page, 'BZ1', True)
    check(True, 'overload, red lamp and buzzer')
    toggle_qf(page)
    energized(page, 'HL3', False)
    energized(page, 'BZ1', False)
    toggle_qf(page)
    energized(page, 'HL3', True)
    energized(page, 'BZ1', True)
    check(True, 'QF1 also removes and restores the real overload-alarm supply')
    page.locator('#component-select').select_option('TH1')
    click(page, page.locator('#details button').filter(has_text='RESET'))
    energized(page, 'MC1', False)
    energized(page, 'HL3', False)
    check(True, 'RESET does not restart')
    assert len(page.evaluate('window.wiringLab.getSimulation().evaluatedCircuit.threePhaseSources')) == 1
    check(page.evaluate('window.wiringLab.getSimulation().evaluatedCircuit.sources.length') == 0, 'actual solver has one original source, no CONTROL')
    capture(page, 'a04-loaded.png')
    click(page, page.locator('[data-sim-stop]'))
    for _ in range(2):
        click(page, page.locator('#flap-btn'))
        assert page.evaluate('window.wiringLab.getProject().configuration.operationPanel.state.open')
        click(page, page.locator('#flap-btn'))
        assert not page.evaluate('window.wiringLab.getProject().configuration.operationPanel.state.open')
    check(True, 'two panel open-close cycles')
    with page.expect_download() as download:
        click(page, page.locator('[data-project-export]'))
    target = OUT / 'browser-export.project.json'
    download.value.save_as(target)
    exported = json.loads(target.read_text())
    check(exported['format'] == 'wiring-panel-project' and len(exported['connections']) == 31 and all(set(w) == {'from', 'to'} for w in exported['connections']), 'download contains endpoints only')
    load(page, 'custom-panel-less.project.json')
    check(page.locator('#component-select option').count() == 2 and page.locator('.equipment-card').count() == 0 and page.locator('#flap-btn').is_hidden(), 'different layout replaces old project')
    page.locator('#component-select').select_option('coil')
    click(page, page.locator('#inspect-component'))
    assert '返回' in page.locator('#inspect-component').inner_text()
    click(page, page.locator('#inspect-component'))
    check(True, 'generic component inspection')
    before = page.evaluate('window.wiringLab.getProject()')
    page.locator('[data-project-file]').set_input_files(ROOT / 'examples/a04-motor-start.project.json')
    page.wait_for_function("document.querySelector('[data-project-status]').textContent.includes('自動走線')", polling=100, timeout=30000)
    click(page, page.locator('[data-project-cancel]'))
    page.wait_for_function("document.querySelector('[data-project-status]').textContent.includes('取消') && !document.querySelector('[data-project-import]').disabled", polling=100, timeout=30000)
    check(page.evaluate('window.wiringLab.getProject()') == before, 'cancel preserves previous project')
    load(page, 'shared-source-drives.project.json')
    assert page.locator('.equipment-card').count() == 1
    click(page, page.locator('[data-sim-start]'))
    energized(page, 'coil', True)
    energized(page, 'coil-B', False)
    page.locator('#component-select').select_option('thermal-B')
    click(page, page.locator('#details button').filter(has_text='RESET'))
    energized(page, 'coil-B', True)
    page.locator('#component-select').select_option('thermal')
    click(page, page.locator('#details button').filter(has_text='TEST'))
    energized(page, 'coil', False)
    energized(page, 'coil-B', True)
    check(True, 'one shared source, two independent physical thermal contacts')
    click(page, page.locator('[data-sim-stop]'))
    click(page, page.locator('#reset-project'))
    page.wait_for_function("window.wiringLab.getProject().name==='BOARD 024' && document.querySelector('#component-select').options.length===22", polling=100)
    check(page.evaluate('window.wiringLab.getWires().length') == 0, 'reset to default')
    page.close()
    # Opening through both HTTP and file:// checks the delivered offline artifact.
    for url, label in [(BASE + '/wiring-panel.html', 'served standalone'),
                       ((ROOT / 'downloads/wiring-panel-WIRE-R17.html').as_uri(), 'file-protocol standalone')]:
        offline = browser.new_page(viewport={'width': 1500, 'height': 1000})
        offline.on('pageerror', lambda error: errors.append(str(error)))
        offline.goto(url, wait_until='load')
        ready(offline)
        check(offline.evaluate("window.wiringLab.getRevision()==='WIRE-R17' && window.wiringLab.getProject().format==='wiring-panel-project'"), label + ' boot')
        load(offline, 'custom-panel-less.project.json')
        check(offline.locator('#component-select option').count() == 2, label + ' project import')
        offline.close()
    check(not errors, 'no uncaught browser exceptions')


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_EXECUTABLE'), args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
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
                capture(page, 'browser-failure.png')
            except Exception as capture_error:
                details['captureError'] = str(capture_error)
        (OUT / 'browser-failure.json').write_text(json.dumps(details, ensure_ascii=False, indent=2))
        raise
    finally:
        browser.close()
(OUT / 'browser-results.json').write_text(json.dumps({'status': 'passed', 'checks': checks, 'pageErrors': errors, 'captureWarnings': capture_warnings}, ensure_ascii=False, indent=2))
print('PASS: browser acceptance and standalone entries', flush=True)
