import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RETURN_DELAY_MS, NUDGE_MS, HELP_ICON_PATH,
  helpResting, helpAppearance, advanceHelpReturn, helpHomeX, helpSide
} from '../src/help.js';

const rest = { enabled: true, state: 'idle', navigationState: 'home', bubbleOpen: false, trainingRunning: false, returnRemaining: 0 };

test('help appears only when enabled, idle, home, quiet and past the return delay', () => {
  assert.equal(helpAppearance(rest), 'help');
  for (const [field, value] of [
    ['enabled', false], ['state', 'opening'], ['state', 'processing'], ['state', 'closing'],
    ['navigationState', 'flying'], ['navigationState', 'returning'],
    ['bubbleOpen', true], ['trainingRunning', true], ['returnRemaining', 1]
  ]) {
    assert.equal(helpAppearance({ ...rest, [field]: value }), 'bot', `${field}=${value}`);
  }
});

test('resting ignores the return delay', () => {
  assert.equal(helpResting({ ...rest, returnRemaining: 999 }), true);
  assert.equal(helpResting({ ...rest, bubbleOpen: true }), false);
});

test('return delay counts down only while resting and restarts otherwise', () => {
  assert.equal(RETURN_DELAY_MS, 1500);
  assert.equal(NUDGE_MS, 2000);
  assert.equal(advanceHelpReturn(1500, true, 400), 1100);
  assert.equal(advanceHelpReturn(100, true, 400), 0);
  assert.equal(advanceHelpReturn(0, true, 16), 0);
  assert.equal(advanceHelpReturn(300, false, 16), RETURN_DELAY_MS);
  assert.equal(advanceHelpReturn(0, false, 0), RETURN_DELAY_MS);
});

test('help home is the right edge of the band', () => {
  assert.equal(helpHomeX(160), 136);
  assert.equal(helpHomeX(24), 0);
  assert.equal(helpHomeX(10), 0);
});

test('help home is the left edge of the band on the start side', () => {
  assert.equal(helpHomeX(160, 'start'), 0);
  assert.equal(helpHomeX(160, 'end'), 136);
});

test('help side follows the viewport edge the band is closer to', () => {
  assert.equal(helpSide({ left: 16, right: 176 }, 1000), 'start');
  assert.equal(helpSide({ left: 824, right: 984 }, 1000), 'end');
  // A centered band keeps the original right-edge home.
  assert.equal(helpSide({ left: 420, right: 580 }, 1000), 'end');
});

test('icon path draws circle, hook and dot as three closed subpaths', () => {
  assert.match(HELP_ICON_PATH, /^M12 1a11 11 0 1 0 0 22/);
  assert.equal(HELP_ICON_PATH.match(/Z/g).length, 3);
});
