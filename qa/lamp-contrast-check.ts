import {stateOf} from './helpers/fixture-types.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {SimulationController} from '../src/application/simulation.ts';
import type {ComponentRuntime} from '../src/core/contracts.ts';
import {buildModel} from '../src/scene.ts';
import {required} from './helpers/fixture-types.ts';
if (!globalThis.document) Object.defineProperty(globalThis, 'document', {configurable: true, writable: true, value: { createElement: () => ({ getContext: () => ({ fillRect() { }, strokeRect() { }, fillText() { } }) }) }});
const luminance = (color: T.Color) => .2126 * color.r + .7152 * color.g + .0722 * color.b;
const sample = (c: ComponentRuntime|undefined) => {
    const m = required(c).parts.color;
    return { color: required(m).color.toArray(), emissive: required(m).emissive.toArray(),
        intensity: required(m).emissiveIntensity, roughness: required(m).roughness, clearcoat: required(m).clearcoat, environment: required(m).envMapIntensity };
};
test('scene environment is bound to actual lamp materials so the renderer uses each lamp reflection intensity', () => {
    const scene = new T.Scene();
    scene.environment = new T.Texture();
    scene.environment.mapping = T.CubeUVReflectionMapping;
    scene.environment.isRenderTargetTexture = true;
    scene.environmentIntensity = .65;
    const { components } = buildModel(scene);
    for (const id of ['HL1', 'HL2', 'HL3', 'HL4']) {
        const c = components.get(id), material = required(c).parts.color;
        assert.equal(required(material).envMap, scene.environment, `${id} must not fall back to scene.environmentIntensity`);
        const off = required(material).envMapIntensity;
        required(c).dispatch({ type: 'lamp' });
        required(c).updateView(undefined, true);
        assert.ok(required(material).envMapIntensity > off);
        assert.equal(required(material).envMap, scene.environment);
    }
    assert.equal(required(required(components.get('PB1')).parts.color).envMap, null, 'pushbutton material keeps the existing shared scene lighting');
});
test('each idle lamp retains a recognisable colour and brightens without changing its neighbours when tested', () => {
    const { components } = buildModel(new T.Scene());
    const lamps = ['HL1', 'HL2', 'HL3', 'HL4'].map(id => components.get(id));
    const idle = lamps.map(sample);
    for (const c of lamps) {
        const m = required(c).parts.color, base = new T.Color(required(c).definition.color), off = required(m).color.clone();
        const display = off.clone().convertLinearToSRGB();
        assert.ok(Math.max(display.r, display.g, display.b) >= .55, `${required(c).id} retains visible idle colour instead of looking black`);
        assert.ok(Math.max(display.r, display.g, display.b) <= .7, `${required(c).id} remains subdued when idle`);
        const hue = off.getHSL({h:0,s:0,l:0}), baseHue = base.getHSL({h:0,s:0,l:0});
        assert.ok(Math.abs(hue.h - baseHue.h) < .001, `${required(c).id} retains its catalogue hue`);
        assert.equal(required(m).emissiveIntensity, 0);
        assert.ok(required(m).envMapIntensity < .25, 'room reflections cannot make an idle lens look lit');
        const meshes = [];
        required(c).root.traverse(o => { if (o instanceof T.Mesh && o.material === m)
            meshes.push(o); });
        assert.ok(meshes.length >= 2);
        required(c).dispatch({ type: 'lamp' });
        required(c).updateView(undefined, true);
        const light = luminance(required(m).color) + luminance(required(m).emissive) * required(m).emissiveIntensity;
        assert.ok(light > 2 * luminance(off), `${required(c).id} still has visible on/off contrast`);
        for (const neighbour of lamps.filter(other => other !== c)) {
            assert.deepEqual(sample(neighbour), idle[lamps.indexOf(neighbour)], 'testing one lamp leaves its neighbours dark');
        }
        required(c).dispatch({ type: 'lamp' });
        required(c).updateView(undefined, true);
        assert.deepEqual(sample(c), idle[lamps.indexOf(c)]);
    }
});
test('a powered red lamp uses the bright style while yellow and green remain dark, then fully darkens on source loss', () => {
    const { components } = buildModel(new T.Scene()), simulation = new SimulationController(components, () => []);
    const red = components.get('HL3'), yellow = components.get('HL2'), green = components.get('HL4');
    const before = [red, yellow, green].map(sample);
    simulation.connectExternal({ component: 'CONTROL', terminal: 'L' }, { component: 'HL3', terminal: '1' });
    simulation.connectExternal({ component: 'CONTROL', terminal: 'N' }, { component: 'HL3', terminal: '2' });
    simulation.start();
    for (const c of components.values())
        c.updateView(undefined, true);
    assert.ok(required(required(red).parts.color).emissiveIntensity > 0);
    assert.equal(stateOf(required(red), 'toggle').on, false);
    assert.deepEqual(sample(yellow), before[1]);
    assert.deepEqual(sample(green), before[2]);
    simulation.setPower('control', false);
    required(red).updateView(undefined, true);
    assert.deepEqual(sample(red), before[0]);
});
// CPU reference for Three r180 ACESFilmicToneMapping at the scene's exposure 1.25.
// Neutral diffuse samples exercise colour compression; this is not a GPU render.
function mappedLens(material: T.MeshPhysicalMaterial|undefined, illumination: number) {
    const input = new T.Matrix3().set(.59719, .35458, .04823, .076, .90834, .01566, .02840, .13383, .83777);
    const output = new T.Matrix3().set(1.60475, -.53108, -.07367, -.10208, 1.10813, -.00605, -.00327, -.07276, 1.07602);
    const radiance = required(material).color.clone().multiplyScalar(illumination)
        .add(required(material).emissive.clone().multiplyScalar(required(material).emissiveIntensity));
    const v = new T.Vector3(...radiance.toArray()).addScalar(.015).multiplyScalar(1.25 / .6).applyMatrix3(input);
    v.fromArray(v.toArray().map(x => (x * (x + .0245786) - .000090537) / (x * (.983729 * x + .432951) + .238081)))
        .applyMatrix3(output);
    const [r,g,b] = v.toArray().map(x => Math.max(0, Math.min(1, x)));
    return new T.Color().setRGB(r,g,b).convertLinearToSRGB();
}
test('lit lenses retain distinct colours after ACES compression instead of washing out to white', () => {
    const { components } = buildModel(new T.Scene());
    for (const id of ['HL1', 'HL2', 'HL3', 'HL4']) {
        const c = components.get(id), m = required(c).parts.color;
        const idle = [.4, 1.5, 2.5].map(light => mappedLens(m, light));
        required(c).dispatch({ type: 'lamp' });
        required(c).updateView(undefined, true);
        for (const [i, illumination] of [.4, 1.5, 2.5].entries()) {
            const display = mappedLens(m, illumination), { r, g, b } = display;
            const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(r, g, b);
            assert.ok(luminance(display) > luminance(idle[i]) + .03, `${id} still visibly brightens at illumination ${illumination}`);
            if (id === 'HL1')
                assert.ok(Math.max(r, g, b) < .95, 'white lens retains headroom below clipped white');
            if (id === 'HL2')
                assert.ok(saturation > .5 && Math.min(r, g) > b + .35, 'yellow stays yellow');
            if (id === 'HL3')
                assert.ok(saturation > .5 && r > Math.max(g, b) + .3, 'red stays red');
            if (id === 'HL4')
                assert.ok(saturation > .2 && g > Math.max(r, b) + .1, 'green stays green');
        }
    }
});
