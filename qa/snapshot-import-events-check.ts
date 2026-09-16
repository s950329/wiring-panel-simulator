import {FileElement as Element, domContainer, fixtureElement} from './helpers/file-dom.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createSnapshotImport} from '../src/views/snapshot-import.ts';
import {required} from './helpers/fixture-types.ts';
function make(apply: Parameters<typeof createSnapshotImport>[1]) {
    Object.defineProperty(globalThis, 'document', {configurable: true, writable: true, value: { createElement: () => new Element() }});
    const container = new Element(), messages: string[] = [];
    const ui = createSnapshotImport(domContainer(container), apply, text => messages.push(text));
    return {...ui, input:fixtureElement(ui.input), button:fixtureElement(ui.button), status:fixtureElement(ui.status), messages};
}
test('file selection awaits complete text, blocks repeated submission and resets the chooser for the same file', async () => {
    let finish: ((value:string) => void) | undefined, imported: unknown;
    const ui = make((source: string) => { imported = JSON.parse(source); return { wireCount: 2 }; });
    ui.input.files = [{ size: 32, text: () => new Promise(resolve => { finish = resolve; }) }];
    ui.button.onclick();
    assert.equal(ui.input.clicked, 1);
    const reading = required(ui.input.onchange)();
    assert.equal(ui.button.disabled, true);
    assert.equal(imported, undefined);
    required(finish)('{"wires":2}');
    await reading;
    assert.deepEqual(imported, { wires: 2 });
    assert.equal(ui.button.disabled, false);
    assert.equal(ui.input.value, '');
    assert.match(ui.status.textContent, /2/);
});
test('file read and import errors remain visible, and oversized files never reach parsing', async () => {
    let called = 0;
    const ui = make(() => { called++; throw new Error('W02 路徑與元件碰撞'); });
    ui.input.files = [{ size: 20, text: async () => '{}' }];
    await ui.input.onchange();
    assert.equal(called, 1);
    assert.match(ui.status.textContent, /W02/);
    assert.equal(ui.button.disabled, false);
    ui.input.files = [{ size: 11 * 1024 * 1024, text: () => { throw new Error('must not read'); } }];
    await ui.input.onchange();
    assert.equal(called, 1);
    assert.match(ui.status.textContent, /10 MB/);
    ui.input.files = [{ size: 20, text: async () => { throw new Error('檔案無法讀取'); } }];
    await ui.input.onchange();
    assert.equal(called, 1);
    assert.match(ui.status.textContent, /無法讀取/);
    assert.equal(ui.input.value, '');
});
