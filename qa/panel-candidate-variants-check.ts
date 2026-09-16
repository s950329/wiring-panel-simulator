import type {Vec3} from '../src/core/contracts.ts';
import type {RoutingBox} from '../src/wiring/panel-region.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import {CollisionWorld, distance} from '../src/wiring/collision.ts';
import {backsideCandidates} from '../src/wiring/panel-candidates.ts';
import {validateSelf} from '../src/wiring/router.ts';
test('trunk-stage alternatives cannot repeat the first monotone panel route', () => {
    const a: import('../src/wiring/panel-candidates.ts').TerminalAnchors = { anchors: [[0, -10, 6.3], [0, -10, -6.3]] }, b: import('../src/wiring/panel-candidates.ts').TerminalAnchors = { anchors: [[20, -10, -6.3]] };
    const collision = new CollisionWorld([{ min: [5, -20, -8], max: [15, 0, -5] }]);
    const bounds: RoutingBox = { min: [0, -10.1, -10], max: [20, -9.9, 10] }, copy = (p: Vec3): [number,number,number] => [...p];
    const results = [];
    for (let variant = 0; variant < 4; variant++) {
        const points = backsideCandidates(a, b, { toLocal: copy, toWorld: copy, collision, validateSelf, bounds, variant });
        assert.ok(points);
        assert.ok(collision.validate(points));
        assert.ok(validateSelf(points));
        const cost = points.slice(1).reduce((s, p, i) => s + distance(points[i], p), 0) + (points.length - 2) * 4;
        results.push(points);
        assert.ok(cost < 45);
        assert.ok(a.anchors.some(p => distance(p, points[0]) < 1e-10));
        assert.deepEqual(points.at(-1), b.anchors[0]);
    }
    assert.equal(new Set(results.map(p => JSON.stringify(p))).size, 4, 'each planning retry must use a distinct candidate');
});
