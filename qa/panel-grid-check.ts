import {required} from './helpers/fixture-types.ts';
import type {Vec3} from '../src/core/contracts.ts';
import type {RoutingBox} from '../src/wiring/panel-region.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {distance, segmentBox} from '../src/wiring/collision.ts';
import {backsideGrid} from '../src/wiring/panel-grid.ts';
import {validateSelf} from '../src/wiring/router.ts';
const bounds: RoutingBox = { min: [-20.123456, -13.987654, -15.123456], max: [20.654321, -2.500041, 15.567891] };
function fixture(angle = 0, obstacles: RoutingBox[] = []) {
    const frame = new T.Matrix4().compose(new T.Vector3(103.123456, 52.234567, 637.345678), new T.Quaternion().setFromEuler(new T.Euler(angle, 37 * Math.PI / 180, 0)), new T.Vector3(1, 1, 1));
    const inverse = frame.clone().invert(), toWorld = (p: Vec3) => new T.Vector3(...p).applyMatrix4(frame).toArray(), toLocal = (p: Vec3) => new T.Vector3(...p).applyMatrix4(inverse).toArray();
    const inside = (p: Vec3) => p.every((x: number, i: number) => x >= bounds.min[i] - 1e-10 && x <= bounds.max[i] + 1e-10);
    const collision: import('../src/wiring/panel-candidates.ts').PanelRouteOptions['collision'] = { searchDiagnostics: [], clear: (a, b = a) => {
            const x = toLocal(a), y = toLocal(b);
            return inside(x) && inside(y) && obstacles.every(box => !segmentBox(x, y, box));
        }, validate(points) { return points.slice(1).every((p, i: number) => this.clear(points[i], p)); } };
    const from = toWorld([-16.234567, bounds.max[1], -10.112233]), to = toWorld([16.543219, bounds.max[1], 10.667788]);
    return { from, to, options: { toLocal, toWorld, collision, validateSelf, bounds }, diagnostics: {} as Partial<import('../src/wiring/panel-grid.ts').GridDiagnostic> };
}
test('grid preserves fractional anchors on an exact backside boundary in both rotated poses', () => {
    for (const angle of [0, Math.PI]) {
        const obstacles: RoutingBox[] = [{ min: [-2.987654, bounds.min[1], -4.432198], max: [3.456789, bounds.max[1], 4.654321] }];
        const f = fixture(angle, obstacles), points = backsideGrid({ anchors: [f.from] }, { anchors: [f.to] }, { ...f.options, diagnostics: f.diagnostics });
        assert.ok(points);
        assert.equal(f.diagnostics.status, 'found');
        assert.ok(distance(points[0], f.from) < 1e-10, 'source retains actual world anchor');
        assert.ok(distance(required(points.at(-1)), f.to) < 1e-10, 'destination retains actual world anchor');
        assert.ok(points.every(p => p.every(Number.isFinite)), 'all nodes have real coordinates');
        assert.ok(f.options.collision.validate(points), 'complete route stays behind face and clears obstacle');
        assert.ok(validateSelf(points));
        for (const p of points)
            assert.ok(f.options.toLocal(p)[1] <= bounds.max[1] + 1e-10);
    }
});
test('grid reports finite search budget separately from fully blocked endpoints', () => {
    for (const limit of [0, 1]) {
        const f = fixture(), result = backsideGrid({ anchors: [f.from] }, { anchors: [f.to] }, { ...f.options, limit, diagnostics: f.diagnostics });
        assert.equal(result, null);
        assert.equal(f.diagnostics.status, 'budget');
        assert.ok(required(f.diagnostics.frontier) > 0);
        assert.equal(f.diagnostics.expanded, limit);
        assert.deepEqual(f.options.collision.searchDiagnostics, [{ status: 'budget', expanded: limit, frontier: f.diagnostics.frontier, limit }]);
    }
    const f = fixture(0, [{ min: [-20.123456, -13.987654, -15.123456], max: [20.654321, -2.500041, 15.567891] }]);
    assert.equal(backsideGrid({ anchors: [f.from] }, { anchors: [f.to] }, { ...f.options, diagnostics: f.diagnostics }), null);
    assert.equal(f.diagnostics.status, 'exhausted');
    assert.equal(f.diagnostics.frontier, 0);
    assert.equal(f.diagnostics.expanded, 0);
});
test('grid cancellation propagates at entry, after graph construction, and during expansion', () => {
    for (const stopAt of [1, 2, 4]) {
        // Disconnected half-boxes force enough expansion to reach the periodic checkpoint.
        const f = fixture(0, [{ min: [-2, bounds.min[1] - 1, bounds.min[2] - 1], max: [2, bounds.max[1] + 1, bounds.max[2] + 1] }]);
        const cancelled = new Error('cancelled'), before = JSON.stringify([f.from, f.to]);
        let calls = 0;
        assert.throws(() => backsideGrid({ anchors: [f.from] }, { anchors: [f.to] }, { ...f.options,
            checkpoint: () => { if (++calls === stopAt)
                throw cancelled; } }), error => error === cancelled);
        assert.equal(calls, stopAt);
        assert.equal(JSON.stringify([f.from, f.to]), before);
    }
});
test('default grid work and alternatives are unchanged by slower elapsed time below the operation deadline', () => {
    const clock = Date.now;
    try {
        for (const variant of [0, 3]) {
            const run = (step: number) => {
                let ticks = 0;
                Date.now = () => ticks++ * step;
                const f = fixture(0, [{ min: [-2.987654, bounds.min[1], -4.432198], max: [3.456789, bounds.max[1], 4.654321] }]);
                const points = backsideGrid({ anchors: [f.from] }, { anchors: [f.to] }, { ...f.options, variant, diagnostics: f.diagnostics,
                    checkpoint: () => assert.ok(ticks * step < 20000, 'the shared operation deadline remains available') });
                assert.ok(points, `variant ${variant} at ${step} ms per clock read should complete the same bounded work`);
                assert.ok(f.options.collision.validate(points));
                assert.ok(validateSelf(points));
                const { status, expanded, nodes, checks } = f.diagnostics;
                return { points, status, expanded, nodes, checks };
            };
            assert.deepEqual(run(600), run(0), 'elapsed time must not change the default search frontier or selected alternative');
        }
    }
    finally {
        Date.now = clock;
    }
});
