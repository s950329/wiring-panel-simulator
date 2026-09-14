"""Browser acceptance against a served production build (requires Playwright).
Run: python qa/project-browser-check.py http://127.0.0.1:4173
No production test flags or synthetic circuit results are used.
"""
from pathlib import Path
import json
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173'
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'qa-results'
OUT.mkdir(exist_ok=True)

def ready(page):
    page.wait_for_function('window.wiringLab && window.wiringLab.getProject', timeout=30000)

def load(page, filename):
    page.locator('[data-project-file]').set_input_files(ROOT / 'examples' / filename)
    page.wait_for_function("document.querySelector('[data-project-status]').textContent.includes('已匯入')", timeout=90000)
    assert '未送電' in page.locator('[data-project-status]').inner_text()

def energized(page, component, value):
    page.wait_for_function("([id,value])=>window.wiringLab.getSimulation().result?.evaluation?.loads.some(x=>x.component===id && (x.state==='energized')===value)", arg=[component, value], timeout=10000)

def press(page, component, assertion):
    page.locator('#component-select').select_option(component)
    button = page.locator('#details .actions button').filter(has_text='按住手動壓合')
    button.scroll_into_view_if_needed()
    box = button.bounding_box()
    assert box
    page.mouse.move(box['x'] + box['width']/2, box['y'] + box['height']/2)
    page.mouse.down()
    try:
        assertion()
    finally:
        page.mouse.up()

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width': 1500, 'height': 1000}, accept_downloads=True)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE, wait_until='networkidle')
    ready(page)
    assert page.evaluate('window.wiringLab.getRevision()') == 'WIRE-R13'
    assert page.locator('#component-select option').count() == 22
    load(page, 'a04-motor-start.project.json')
    assert page.evaluate('window.wiringLab.getWires().length') == 26
    page.locator('[data-sim-start]').click()
    energized(page, 'MC1', False)
    press(page, 'PB3', lambda: energized(page, 'MC1', True))
    energized(page, 'MC1', True)
    page.wait_for_function("window.wiringLab.getSimulation().result.evaluation.motors.find(m=>m.component==='M1').state==='powered'")
    press(page, 'PB5', lambda: energized(page, 'MC1', False))
    press(page, 'PB3', lambda: energized(page, 'MC1', True))
    page.locator('#component-select').select_option('TH1')
    page.locator('#details button').filter(has_text='TEST').click()
    energized(page, 'MC1', False)
    energized(page, 'HL3', True)
    energized(page, 'BZ1', True)
    page.locator('#details button').filter(has_text='RESET').click()
    energized(page, 'MC1', False)
    energized(page, 'HL3', False)
    page.screenshot(path=str(OUT / 'a04-loaded.png'), full_page=True)
    page.locator('[data-sim-stop]').click()
    for _ in range(2):
        page.locator('#flap-btn').click()
        assert page.evaluate('window.wiringLab.getProject().configuration.operationPanel.state.open')
        page.locator('#flap-btn').click()
        assert not page.evaluate('window.wiringLab.getProject().configuration.operationPanel.state.open')
    with page.expect_download() as download:
        page.locator('[data-project-export]').click()
    target = OUT / 'browser-export.project.json'
    download.value.save_as(target)
    exported = json.loads(target.read_text())
    assert exported['format'] == 'wiring-panel-project'
    assert len(exported['connections']) == 34
    assert all(set(w) == {'from', 'to'} for w in exported['connections'])
    load(page, 'custom-panel-less.project.json')
    assert page.locator('#component-select option').count() == 2
    assert page.locator('.equipment-card').count() == 0
    assert page.locator('#flap-btn').is_hidden()
    page.locator('#component-select').select_option('coil')
    page.locator('#inspect-component').click()
    assert '返回' in page.locator('#inspect-component').inner_text()
    page.locator('#inspect-component').click()
    before = page.evaluate('window.wiringLab.getProject()')
    page.locator('[data-project-file]').set_input_files(ROOT / 'examples/a04-motor-start.project.json')
    page.wait_for_function("document.querySelector('[data-project-status]').textContent.includes('自動走線')", timeout=30000)
    page.locator('[data-project-cancel]').click()
    page.wait_for_function("document.querySelector('[data-project-status]').textContent.includes('取消') && !document.querySelector('[data-project-import]').disabled", timeout=30000)
    assert page.evaluate('window.wiringLab.getProject()') == before
    load(page, 'independent-drives.project.json')
    assert page.locator('.equipment-card').count() == 2
    page.locator('[data-sim-start]').click()
    energized(page, 'coil', True)
    energized(page, 'coil-B', False)
    page.locator('[data-source="source-B"]').check()
    energized(page, 'coil-B', True)
    page.locator('[data-sim-stop]').click()
    page.locator('#reset-project').click()
    page.wait_for_function("window.wiringLab.getProject().name==='BOARD 024' && document.querySelector('#component-select').options.length===22")
    assert page.evaluate('window.wiringLab.getWires().length') == 0
    # Verify the exact standalone build is bootable and shares the same schema/revision.
    offline = browser.new_page()
    offline.on('pageerror', lambda error: errors.append(str(error)))
    offline.goto(BASE + '/wiring-panel.html', wait_until='networkidle')
    ready(offline)
    assert offline.evaluate('window.wiringLab.getRevision()') == 'WIRE-R13'
    assert offline.evaluate('window.wiringLab.getProject().format') == 'wiring-panel-project'
    assert not errors, errors
    (OUT / 'browser-results.json').write_text(json.dumps({'status':'passed','checks':['default','import','start','self-hold','stop','overload','alarm','reset','panel-cycles','export','dynamic-layout','generic-inspection','cancel','independent-sources','reset-default','standalone'],'pageErrors':errors}, ensure_ascii=False, indent=2))
    browser.close()
print('PASS: project browser acceptance and standalone entry')
