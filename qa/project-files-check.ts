import {FileElement as Element, domContainer, fixtureElement} from './helpers/file-dom.ts';
import {minimalProject} from './helpers/project-data.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as files from '../src/views/project-files.ts';
import {required} from './helpers/fixture-types.ts';
function make(overrides: Partial<Parameters<typeof files.createProjectFiles>[1]> = {}) {
    Object.defineProperty(globalThis, 'document', {configurable: true, writable: true, value: { createElement: () => new Element() }});
    const events: string[] = [];
    const handlers: Parameters<typeof files.createProjectFiles>[1] = { load: async (read) => { events.push('lock'); const text = await read(); events.push(text); return { connections: 3, convertedLegacy: false }; }, cancel: () => events.push('cancel'), export: () => ({...minimalProject(), name:'Test'}), changed: () => events.push('changed'), ...overrides };
    assert.equal(typeof files.createProjectFiles, 'function');
    const ui = files.createProjectFiles(domContainer(new Element()), handlers);
    return {...ui, input:fixtureElement(ui.input), importButton:fixtureElement(ui.importButton), cancelButton:fixtureElement(ui.cancelButton), status:fixtureElement(ui.status), events, handlers};
}
test('project file input locks through source callback, shows progress, cancels and clears the same chooser', async () => {
    let finish: ((value:string) => void) | undefined;
    const ui = make({ load: async (read, progress) => { progress({ phase: 'route', completed: 1, total: 3, detail: 'a:1 → b:2' }); await read(); return { connections: 3, convertedLegacy: true, conversionNotes: ["已移除未接線 CONTROL"] }; } });
    ui.input.files = [{ size: 20, text: () => new Promise(r => finish = r) }];
    const work = required(ui.input.onchange)();
    assert.equal(ui.importButton.disabled, true);
    assert.equal(ui.cancelButton.hidden, false);
    assert.match(ui.status.textContent, /1.*3/);
    ui.cancelButton.onclick();
    assert.ok(ui.events.includes('cancel'));
    required(finish)('{}');
    await work;
    assert.equal(ui.input.value, '');
    assert.equal(ui.importButton.disabled, false);
    assert.match(ui.status.textContent, /舊.*3|3.*舊/);
    assert.match(ui.status.textContent, /已移除未接線 CONTROL/);
});
test('oversized, read and reconstruction errors preserve the original and remain visible', async () => {
    let called = 0;
    const ui = make({ load: async (read) => { called++; await read(); throw new Error('第 2 條接線 a:1 → b:2 無路徑'); } });
    ui.input.files = [{ size: 11 * 1024 * 1024, text: async () => { throw Error('must not read'); } }];
    await ui.input.onchange();
    assert.equal(called, 0);
    assert.match(ui.status.textContent, /10 MB/);
    ui.input.files = [{ size: 20, text: async () => '{}' }];
    await ui.input.onchange();
    assert.equal(called, 1);
    assert.match(ui.status.textContent, /第 2 條.*原專案/);
    assert.equal(ui.importButton.disabled, false);
    ui.input.files = [{ size: 20, text: async () => { throw Error('read failed'); } }];
    await ui.input.onchange();
    assert.match(ui.status.textContent, /read failed/);
    assert.equal(ui.input.value, '');
});
test('normal download contains only project inputs and sanitized filename; debug export is a separate format', () => {
    assert.equal(typeof files.projectDownload, 'function');
    const project = { ...minimalProject(), name:'../../<Test>', connections: [{ from: { component: 'a', terminal: '1' }, to: { component: 'b', terminal: '2' } }] };
    const file = files.projectDownload(project);
    assert.deepEqual(JSON.parse(file.content), project);
    assert.ok(!file.filename.includes('/'));
    assert.ok(file.filename.endsWith('.json'));
    assert.equal(file.mimeType, 'application/json');
});
