"""Diagnostic only: same production browser scenario, one larger reset deadline.
No application code, assertions or renderer settings are changed.
"""
from pathlib import Path

original = Path(__file__).with_name('project-browser-check.py')
source = original.read_text()
old = '''    click(page, page.locator('#reset-project'))
    page.wait_for_function("window.wiringLab.getProject().name==='BOARD 024' && document.querySelector('#component-select').options.length===22", polling=100)'''
new = '''    import time
    reset_started = time.monotonic()
    click(page, page.locator('#reset-project'))
    page.wait_for_function("window.wiringLab.getProject().name==='BOARD 024' && document.querySelector('#component-select').options.length===22", polling=100, timeout=90000)
    reset_seconds = time.monotonic() - reset_started
    (OUT / 'reset-timing.json').write_text(json.dumps({'seconds': reset_seconds, 'previousDeadlineSeconds': 30, 'diagnosticDeadlineSeconds': 90}))
    print('RESET TIMING:', reset_seconds, flush=True)'''
assert source.count(old) == 1
source = source.replace(old, new)
old_ui = '''({status:document.querySelector('[data-project-status]')?.textContent, selection:document.querySelector('#component-select')?.value, inspector:document.querySelector('#details')?.innerText})'''
new_ui = '''({status:document.querySelector('[data-project-status]')?.textContent, selection:document.querySelector('#component-select')?.value, inspector:document.querySelector('#details')?.innerText, toast:document.querySelector('.toast')?.textContent, name:window.wiringLab?.getProject().name, componentIds:window.wiringLab?.getProject().configuration.components.map(c=>c.id), optionCount:document.querySelector('#component-select')?.options.length, importDisabled:document.querySelector('[data-project-import]')?.disabled, resetDisabled:document.querySelector('#reset-project')?.disabled})'''
assert source.count(old_ui) == 1
source = source.replace(old_ui, new_ui)
exec(compile(source, str(original), 'exec'), {'__name__': '__main__', '__file__': str(original)})
