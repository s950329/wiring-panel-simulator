import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {createProjectRuntime} from '../src/project/runtime.ts';
import * as view from '../src/project/view-binding.ts';
import {collectSolids} from '../src/wiring/solids.ts';
import {required} from './helpers/fixture-types.ts';
import {minimalProject, withAssembly} from './helpers/project-data.ts';
if (!globalThis.document) Object.defineProperty(globalThis, 'document', {configurable: true, writable: true, value: { createElement: () => ({ getContext: () => ({ fillRect() { }, strokeRect() { }, fillText() { } }) }) }});
test('viewport replaces the whole model and can inspect any renamed assembly without hiding routing obstacles', () => {
    assert.equal(typeof view.ProjectViewBinding, 'function');
    const scene = new T.Scene(), first = createProjectRuntime(withAssembly()), binding = new view.ProjectViewBinding(scene, first.model);
    const before = collectSolids(first.world);
    binding.inspect('aux');
    assert.equal(binding.inspected, 'aux');
    assert.deepEqual(collectSolids(first.world), before);
    const host = first.components.get('coil');
    let visibleHost = 0, hiddenBreaker = 0;
    required(host).root.traverse(o => { if (o instanceof T.Mesh && o.layers.test(new T.Layers()))
        visibleHost++; });
    required(first.components.get('breaker')).root.traverse(o => { if (o instanceof T.Mesh && !o.layers.test(new T.Layers()))
        hiddenBreaker++; });
    assert.ok(visibleHost && hiddenBreaker);
    const p = minimalProject();
    p.configuration.components = [p.configuration.components[1]];
    p.configuration.components[0].id = 'other';
    const second = createProjectRuntime(p);
    binding.replace(second.model);
    assert.equal(first.world.parent, null);
    assert.equal(second.world.parent, scene);
    assert.equal(binding.components.has('other'), true);
    assert.equal(binding.components.has('coil'), false);
    assert.equal(binding.inspected, null);
    first.dispose();
    binding.inspect('other');
    binding.inspect(null);
    assert.equal(binding.inspected, null);
    second.dispose();
});
