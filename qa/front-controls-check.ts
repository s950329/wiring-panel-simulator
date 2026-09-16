import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {required} from './helpers/fixture-types.ts';
Object.defineProperty(globalThis, 'document', {configurable: true, writable: true, value: { createElement: () => ({ width: 256, height: 256, getContext: () => ({ fillRect() { }, strokeRect() { }, fillText() { } }) }) }});
const { buildModel } = await import('../src/scene.ts');
const { frontControls } = await import('../src/layout.ts');
const { components, world, flap } = buildModel(new T.Scene());
flap.rotation.x = Math.PI;
world.updateMatrixWorld(true);
const names = (id: string) => required(components.get(id)).terminals.map(t => t.displayName || t.id);
test('operation-panel terminal counts match photographed hardware', () => {
    assert.equal(required(components.get('BZ1')).terminals.length, 2);
    assert.equal(required(components.get('ES1')).terminals.length, 2);
    assert.equal(required(components.get('SA1')).terminals.length, 4);
    for (const id of ['PB1', 'PB2', 'PB3', 'PB4', 'PB5'])
        assert.equal(required(components.get(id)).terminals.length, 4, id);
    for (const id of ['HL1', 'HL2', 'HL3', 'HL4'])
        assert.equal(required(components.get(id)).terminals.length, 2, id);
    assert.equal(frontControls.reduce((n, c) => n + required(components.get(c.id)).terminals.length, 0), 36);
});
test('pushbuttons expose one NO pair and one NC pair', () => {
    for (const id of ['PB1', 'PB2', 'PB3', 'PB4', 'PB5']) {
        assert.deepEqual(names(id), ['1 · 常閉 NC', '2 · 常開 NO', '3 · 常開 NO', '4 · 常閉 NC']);
        assert.deepEqual(required(components.get(id)).terminals.map(t => t.group), ['NC', 'NO', 'NO', 'NC']);
        assert.equal(new Set(required(components.get(id)).terminals.map(t => t.local.join(','))).size, 4);
    }
});
test('emergency stop and selector keep distinct contact topology', () => {
    assert.deepEqual(names('ES1'), ['21 · 常閉 NC', '22 · 常閉 NC']);
    assert.deepEqual(names('SA1'), ['13 · 接點 A', '14 · 接點 A', '23 · 接點 B', '24 · 接點 B']);
});
