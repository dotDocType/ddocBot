import test from 'node:test';
import assert from 'node:assert/strict';

import { clampPosition, easeInOut, nearTarget, nearestPoint } from '../src/geometry.js';

test('clampPosition keeps the actor interactive area ten pixels inside the viewport', () => {
  assert.deepEqual(clampPosition({ x: -50, y: 999 }, { width: 320, height: 200 }), { x: 10, y: 166 });
  assert.deepEqual(clampPosition({ x: 42, y: 75 }, { width: 320, height: 200 }), { x: 42, y: 75 });
});

test('clampPosition centers the actor as a best effort when the viewport is too small', () => {
  assert.deepEqual(clampPosition({ x: 999, y: -999 }, { width: 20, height: 30 }), { x: -2, y: 3 });
});

test('nearTarget uses the side with the greatest usable room and centers the actor', () => {
  const viewport = { width: 400, height: 300 };
  assert.deepEqual(nearTarget({ x: 160, y: 200, width: 80, height: 30 }, viewport), { x: 188, y: 158 });
  assert.deepEqual(nearTarget({ x: 300, y: 100, width: 40, height: 40 }, viewport), { x: 258, y: 108 });
});

test('nearTarget clamps corner placements and falls back to the roomiest side', () => {
  assert.deepEqual(nearTarget({ x: 0, y: 0, width: 30, height: 30 }, { width: 100, height: 100 }), { x: 48, y: 10 });
  assert.deepEqual(nearTarget({ x: 15, y: 15, width: 10, height: 10 }, { width: 40, height: 40 }), { x: 8, y: 8 });
});

test('nearestPoint intersects the rectangle boundary toward cardinal and corner origins', () => {
  const rect = { x: 10, y: 20, width: 40, height: 20 };
  assert.deepEqual(nearestPoint(rect, { x: 100, y: 30 }), { x: 50, y: 30 });
  assert.deepEqual(nearestPoint(rect, { x: 70, y: 50 }), { x: 50, y: 40 });
  assert.deepEqual(nearestPoint(rect, { x: 30, y: 25 }), { x: 30, y: 20 });
});

test('nearestPoint chooses a deterministic nearest edge for an origin at the center', () => {
  assert.deepEqual(nearestPoint({ x: 10, y: 20, width: 40, height: 20 }, { x: 30, y: 30 }), { x: 30, y: 20 });
});

test('easeInOut is normalized, symmetric, and smooth at both endpoints', () => {
  assert.equal(easeInOut(0), 0);
  assert.equal(easeInOut(1), 1);
  assert.equal(easeInOut(.5), .5);
  assert.equal(easeInOut(.25), 1 - easeInOut(.75));
  assert.ok(easeInOut(.01) < .001);
  assert.ok(easeInOut(.99) > .999);
});
