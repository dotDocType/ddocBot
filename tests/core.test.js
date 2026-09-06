import test from 'node:test';
import assert from 'node:assert/strict';

import { BotEngine } from '../src/engine.js';
import { drawBot, getLaserOrigin, getPixels } from '../src/pixels.js';

const sequence = (...values) => {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
};

test('tasks open the bot, aggregate outcomes, react, and close on exact boundaries', () => {
  const changes = [];
  const engine = new BotEngine({ random: () => 0, onStateChange: state => changes.push(state) });
  const first = engine.beginTask();
  const second = engine.beginTask();
  assert.notEqual(first, second);
  assert.deepEqual(engine.snapshot(), { state: 'opening', motion: 'rest', phase: 0, extension: 0, x: 0 });

  engine.update(125);
  assert.equal(engine.snapshot().extension, 0.5);
  engine.update(125);
  assert.equal(engine.snapshot().state, 'processing');
  assert.equal(engine.snapshot().extension, 1);

  engine.endTask(first, { outcome: 'error' });
  engine.endTask(first, { outcome: 'success' });
  assert.equal(engine.snapshot().state, 'processing');
  engine.endTask(second, { outcome: 'success' });
  assert.equal(engine.snapshot().state, 'error');
  engine.update(799);
  assert.equal(engine.snapshot().state, 'error');
  engine.update(1);
  assert.equal(engine.snapshot().state, 'closing');
  engine.update(250);
  assert.equal(engine.snapshot().state, 'idle');
  assert.equal(engine.snapshot().extension, 0);
  assert.deepEqual(changes, ['opening', 'processing', 'error', 'closing', 'idle']);
});

test('success reacts while an all-cancelled batch closes directly', () => {
  const engine = new BotEngine();
  const id = engine.beginTask();
  engine.update(250);
  engine.endTask(id);
  assert.equal(engine.snapshot().state, 'success');
  engine.reset();
  const a = engine.beginTask();
  const b = engine.beginTask();
  engine.endTask(a, { outcome: 'cancelled' });
  engine.endTask(b, { outcome: 'cancelled' });
  assert.equal(engine.snapshot().state, 'closing');
});

test('a task completed while opening finishes opening before reacting', () => {
  const engine = new BotEngine();
  const id = engine.beginTask();
  engine.update(50);
  engine.endTask(id, { outcome: 'success' });
  assert.equal(engine.snapshot().state, 'opening');
  assert.equal(engine.snapshot().extension, .2);
  engine.update(199);
  assert.equal(engine.snapshot().state, 'opening');
  engine.update(1);
  assert.equal(engine.snapshot().state, 'success');
  assert.equal(engine.snapshot().extension, 1);
});

test('beginning during a reaction or close opens continuously from the current extension', () => {
  const engine = new BotEngine();
  let id = engine.beginTask();
  engine.update(250);
  engine.endTask(id);
  engine.update(800);
  engine.update(100);
  const before = engine.snapshot().extension;
  id = engine.beginTask();
  assert.equal(engine.snapshot().state, 'opening');
  assert.equal(engine.snapshot().extension, before);
  engine.update(1000);
  assert.equal(engine.snapshot().state, 'processing');

  engine.endTask(id);
  const duringReaction = engine.snapshot().extension;
  engine.beginTask();
  assert.equal(engine.snapshot().extension, duringReaction);
  assert.equal(engine.snapshot().state, 'opening');
});

test('processing picks non-repeating motions after 2-5 second pauses and stays in bounds', () => {
  const engine = new BotEngine({ random: sequence(0, 0, 0, 0.99, 0, 0, 0) });
  engine.beginTask();
  engine.update(250);
  engine.update(1999, { width: 40 });
  assert.equal(engine.snapshot().motion, 'rest');
  engine.update(1, { width: 40 });
  const first = engine.snapshot().motion;
  assert.ok(['walk', 'wave', 'jump', 'tap'].includes(first));
  for (let i = 0; i < 20; i++) {
    engine.update(100, { width: 40 });
    assert.ok(engine.snapshot().x >= 0 && engine.snapshot().x <= 16);
    assert.ok(engine.snapshot().phase >= 0 && engine.snapshot().phase <= 1);
  }
  engine.update(5000, { width: 40 });
  assert.notEqual(engine.snapshot().motion, first);
});

test('reduced motion is static during processing and a visible bubble freezes x', () => {
  const engine = new BotEngine({ random: () => 0 });
  engine.beginTask();
  engine.update(250);
  engine.update(2000, { reducedMotion: true, width: 160 });
  assert.deepEqual(engine.snapshot(), { state: 'processing', motion: 'rest', phase: 0, extension: 1, x: 0 });
  engine.update(2000, { width: 160 });
  engine.update(300, { width: 160 });
  const x = engine.snapshot().x;
  engine.update(500, { bubbleVisible: true, width: 160 });
  assert.equal(engine.snapshot().x, x);
});

test('reset clears tasks and restores the initial snapshot', () => {
  const engine = new BotEngine();
  const id = engine.beginTask();
  engine.update(100);
  engine.reset();
  assert.deepEqual(engine.snapshot(), { state: 'idle', motion: 'rest', phase: 0, extension: 0, x: 0 });
  engine.endTask(id, { outcome: 'error' });
  assert.equal(engine.snapshot().state, 'idle');
});

test('pixel frames are unique integer coordinates contained in a 24px square', () => {
  const states = ['idle', 'opening', 'processing', 'success', 'error', 'closing'];
  const motions = ['rest', 'walk', 'wave', 'jump', 'tap', 'fly', 'hover', 'point'];
  for (const state of states) for (const motion of motions) for (const phase of [0, .25, .5, .75, 1]) {
    const pixels = getPixels({ state, motion, phase, extension: phase });
    const keys = new Set(pixels.map(([x, y]) => `${x},${y}`));
    assert.equal(keys.size, pixels.length);
    for (const [x, y] of pixels) {
      assert.equal(Number.isInteger(x) && Number.isInteger(y), true);
      assert.ok(x >= 0 && x < 24 && y >= 0 && y < 24, `${state}/${motion}/${phase}: ${x},${y}`);
    }
  }
});

test('idle is a 10px square and active frames have eye holes and limbs', () => {
  const idle = getPixels();
  assert.equal(idle.length, 100);
  assert.deepEqual(new Set(idle.map(([x]) => x)), new Set([7, 8, 9, 10, 11, 12, 13, 14, 15, 16]));
  assert.deepEqual(new Set(idle.map(([, y]) => y)), new Set([7, 8, 9, 10, 11, 12, 13, 14, 15, 16]));

  const active = getPixels({ state: 'processing', extension: 1, motion: 'wave', phase: .5 });
  const keys = new Set(active.map(([x, y]) => `${x},${y}`));
  assert.equal(keys.has('10,10'), false);
  assert.equal(keys.has('14,10'), false);
  assert.ok(active.some(([x]) => x < 7));
  assert.ok(active.some(([x]) => x > 16));
});

test('extension zero is the closed square and unfolding changes partial and full frames', () => {
  const idle = getPixels();
  const closed = getPixels({ state: 'opening', extension: 0, motion: 'wave', phase: .5 });
  assert.deepEqual(closed, idle);

  const partial = getPixels({ state: 'opening', extension: .5, motion: 'wave', phase: .5 });
  const full = getPixels({ state: 'processing', extension: 1, motion: 'wave', phase: .5 });
  assert.notDeepEqual(new Set(partial.map(String)), new Set(idle.map(String)));
  assert.notDeepEqual(new Set(full.map(String)), new Set(partial.map(String)));
});

test('success and error reactions animate visibly across phase', () => {
  for (const state of ['success', 'error']) {
    const early = new Set(getPixels({ state, extension: 1, phase: .25 }).map(String));
    const late = new Set(getPixels({ state, extension: 1, phase: .75 }).map(String));
    assert.notDeepEqual(early, late, `${state} should change pose`);
  }
  const success = new Set(getPixels({ state: 'success', extension: 1, phase: .25 }).map(String));
  const error = new Set(getPixels({ state: 'error', extension: 1, phase: .25 }).map(String));
  assert.notDeepEqual(success, error);
});

test('tap animates a foot as well as an arm', () => {
  const early = getPixels({ state: 'processing', extension: 1, motion: 'tap', phase: .25 });
  const late = getPixels({ state: 'processing', extension: 1, motion: 'tap', phase: .75 });
  const earlyFeet = new Set(early.filter(([, y]) => y >= 17).map(String));
  const lateFeet = new Set(late.filter(([, y]) => y >= 17).map(String));
  assert.notDeepEqual(earlyFeet, lateFeet);
});

test('fly has bent legs and outstretched arms across its animation', () => {
  for (const phase of [0, .25, .5, .75, 1]) {
    const pixels = new Set(getPixels({ state: 'processing', extension: 1, motion: 'fly', phase }).map(String));
    assert.ok(pixels.has('3,12') && pixels.has('20,12'), `arms at phase ${phase}`);
    assert.ok(pixels.has('8,18') && pixels.has('6,17'), `bent left leg at phase ${phase}`);
    assert.ok(pixels.has('15,18') && pixels.has('17,17'), `bent right leg at phase ${phase}`);
  }
});

test('hover uses a subtle one-pixel bob and has a static phase-zero frame', () => {
  const zero = new Set(getPixels({ state: 'processing', extension: 1, motion: 'hover', phase: 0 }).map(String));
  const middle = new Set(getPixels({ state: 'processing', extension: 1, motion: 'hover', phase: .5 }).map(String));
  const end = new Set(getPixels({ state: 'processing', extension: 1, motion: 'hover', phase: 1 }).map(String));
  assert.notDeepEqual(zero, middle);
  assert.deepEqual(zero, end);
  const minY = frame => Math.min(...[...frame].map(point => Number(point.split(',')[1])));
  assert.equal(Math.abs(minY(zero) - minY(middle)), 1);
});

test('point extends its hand to the exact laser origin for every aim direction', () => {
  for (const aim of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }, { x: 1, y: 1 }]) {
    const origin = getLaserOrigin({ aim });
    const pixels = new Set(getPixels({ state: 'processing', extension: 1, motion: 'point', aim }).map(String));
    assert.ok(pixels.has(String(origin)), `${JSON.stringify(aim)} should end at ${origin}`);
  }
  assert.deepEqual(getLaserOrigin(), getLaserOrigin({ aim: { x: 1, y: 0 } }));
});

test('new poses preserve transparent eye pixels', () => {
  for (const [motion, eyeY] of [['fly', 10], ['hover', 9], ['point', 10]]) {
    const pixels = new Set(getPixels({ state: 'processing', extension: 1, motion, phase: .5 }).map(String));
    assert.equal(pixels.has(`10,${eyeY}`), false, `${motion} left eye`);
    assert.equal(pixels.has(`14,${eyeY}`), false, `${motion} right eye`);
  }
});

test('drawBot clears and paints every opaque pixel', () => {
  const calls = [];
  const ctx = {
    canvas: { width: 24, height: 24 },
    clearRect: (...args) => calls.push(['clear', ...args]),
    fillRect: (...args) => calls.push(['fill', ...args]),
    set fillStyle(value) { calls.push(['color', value]); },
    set imageSmoothingEnabled(value) { calls.push(['smoothing', value]); }
  };
  const snapshot = { state: 'idle', extension: 0, motion: 'rest', phase: 0 };
  drawBot(ctx, snapshot, '#123456');
  assert.deepEqual(calls[0], ['smoothing', false]);
  assert.deepEqual(calls[1], ['clear', 0, 0, 24, 24]);
  assert.deepEqual(calls[2], ['color', '#123456']);
  assert.equal(calls.filter(call => call[0] === 'fill').length, getPixels(snapshot).length);
});
