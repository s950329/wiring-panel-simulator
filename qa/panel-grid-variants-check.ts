import type {Vec3} from '../src/core/contracts.ts';
import type {RoutingBox} from '../src/wiring/panel-region.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import {CollisionWorld, distance, type CollisionBox} from '../src/wiring/collision.ts';
import {backsideGrid} from '../src/wiring/panel-grid.ts';
import {validateSelf} from '../src/wiring/router.ts';
const copy = (p: Vec3): [number,number,number] => [...p];
const start: Vec3 = [0.123456789, -10.765432123, 0.314159265], end: Vec3 = [100.987654321, -10.765432123, 0.314159265];
const bounds: RoutingBox = { min: [start[0], -22.345678901, -20.678901234], max: [end[0], -2.987654321, 20.765432109] };
function inspect(boxes: readonly CollisionBox[]) {
    const collision = new CollisionWorld(boxes), routes = [];
    let goalOutgoingEdges = 0;
    const originalClear = collision.clear.bind(collision);
    collision.clear = (a, b = a) => {
        if (distance(a, end) < 1e-10 && distance(b, end) > 1e-10)
            goalOutgoingEdges++;
        return originalClear(a, b);
    };
    for (let variant = 0; variant < 4; variant++) {
        const diagnostic = {}, options = { toLocal: copy, toWorld: copy, collision, validateSelf, bounds, variant, diagnostics: diagnostic };
        const points = backsideGrid({ anchors: [start] }, { anchors: [end] }, options);
        assert.ok(points, `variant ${variant}: ${JSON.stringify(diagnostic)}`);
        assert.deepEqual(points[0], start);
        assert.deepEqual(points.at(-1), end);
        assert.ok(points.every(p => p.every((x, i) => Number.isFinite(x) && x >= bounds.min[i] && x <= bounds.max[i])));
        assert.ok(collision.validate(points));
        assert.ok(validateSelf(points));
        const length = points.slice(1).reduce((sum, p, i) => sum + distance(points[i], p), 0);
        assert.ok(length < distance(start, end) + 80, `unnecessary detour: ${length}`);
        assert.deepEqual(backsideGrid({ anchors: [start] }, { anchors: [end] }, options), points, 'variant must be repeatable');
        routes.push(points);
    }
    assert.equal(new Set(routes.map(points => JSON.stringify(points))).size, 4, 'planner variants must offer distinct valid alternatives');
    assert.equal(goalOutgoingEdges, 0, 'reaching a terminal must end the candidate, not seed a goal U-turn');
    return routes;
}
test('fractional terminal anchors remain exact while four grid variants provide bounded valid alternatives', () => { inspect([]); });
test('fractional grid alternatives avoid a blocking solid and remain distinct', () => {
    const boxes: CollisionBox[] = [{ min: [44.123456789, -12.765432123, -2.685840735], max: [56.987654321, -8.765432123, 3.314159265] }];
    assert.equal(new CollisionWorld(boxes).clear(start, end), false, 'fixture must block the direct route');
    inspect(boxes);
});
