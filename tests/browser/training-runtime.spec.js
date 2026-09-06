import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { createTrainingRuntime } = await import('/src/training/runtime.js');
    window.makeRuntime = (steps, options = {}, overrides = {}) => {
      const host = document.createElement('div'); document.body.append(host);
      const events = [], calls = [];
      const runtime = createTrainingRuntime({ host,
        emit: (name, detail) => { events.push({ name, ...detail }); overrides.emit?.(name, detail); },
        presentation: {
          render: snapshot => calls.push(['render', snapshot.state, snapshot.token]),
          message: (text, options) => calls.push(['message', text, options]),
          clear: () => calls.push(['clear']), setVisible: value => calls.push(['visible', value])
        },
        navigation: {
          flyTo: target => { calls.push(['fly', target]); return overrides.flyTo?.(target) ?? Promise.resolve('arrived'); },
          pointAt: target => { calls.push(['point', target]); return overrides.pointAt?.(target) ?? true; },
          returnHome: () => { calls.push(['home']); return Promise.resolve('arrived'); },
          halt: () => { calls.push(['halt']); overrides.halt?.(); }
        },
        audio: { playTraining: spec => { calls.push(['audio', spec]); return Promise.resolve(false); },
          stopTraining: () => calls.push(['stop-audio']) }
      });
      Object.assign(window, { runtime, controller: runtime.controller, host, events, calls });
      runtime.controller.load({ id: 'tour', version: 1, steps }, options);
      return runtime;
    };
  });
});

test.afterEach(async ({ page }) => { await page.evaluate(() => window.runtime?.destroy()); });

test('confirms the current route and waits for a late rendered field', async ({ page }) => {
  await page.evaluate(() => {
    makeRuntime([{ id: 'field', route: 'form', target: '#late-field', text: 'Fill',
      advance: { type: 'change', condition: { kind: 'nonempty' } } }]);
    controller.start();
    controller.routeReady('form', { token: controller.token });
  });
  expect(await page.evaluate(() => controller.state)).toBe('waiting-target');
  await page.evaluate(() => {
    const input = document.createElement('input'); input.id = 'late-field'; document.body.append(input);
    const button = document.createElement('button'); button.textContent = 'Save'; document.body.append(button);
  });
  await expect.poll(() => page.evaluate(() => controller.state)).toBe('active');
  await page.locator('#late-field').fill('Cliente');
  await page.locator('#late-field').press('Tab');
  await expect(page.locator('#late-field')).not.toBeFocused();
  await expect.poll(() => page.evaluate(() => controller.state)).toBe('completed');
});

test('resolves shadow references by polling without document mutations', async ({ page }) => {
  await page.evaluate(() => {
    const root = document.createElement('div'); document.body.append(root);
    window.shadow = root.attachShadow({ mode: 'closed' });
    window.ref = null;
    makeRuntime([{ id: 'ref', target: { ref: 'save' }, text: 'Save', advance: { type: 'click' } }],
      { resolveTarget: (key, context) => { window.refArgs = [key, context]; return window.ref; } });
    controller.start();
  });
  await page.evaluate(() => {
    window.ref = document.createElement('button'); ref.textContent = 'Save'; shadow.append(ref);
  });
  await expect.poll(() => page.evaluate(() => controller.state)).toBe('active');
  expect(await page.evaluate(() => refArgs)).toEqual(['save', { stepId: 'ref' }]);
  await page.evaluate(() => ref.click());
  expect(await page.evaluate(() => controller.state)).toBe('completed');
});

for (const problem of ['ambiguous', 'throw', 'invalid', 'foreign', 'undefined']) {
  test(`pauses on ${problem} target resolution`, async ({ page }) => {
    await page.evaluate(problem => {
      document.body.insertAdjacentHTML('beforeend', '<button class="duplicate">A</button><button class="duplicate">B</button>');
      makeRuntime([{ id: 'bad', target: problem === 'ambiguous' ? '.duplicate' : { ref: 'bad' }, text: 'Bad', advance: { type: 'click' } }],
        { resolveTarget: () => {
          if (problem === 'throw') throw new Error('broken app');
          if (problem === 'undefined') return undefined;
          if (problem === 'foreign') return document.implementation.createHTMLDocument().createElement('button');
          return {};
        } });
      controller.start();
    }, problem);
    await expect.poll(() => page.evaluate(() => controller.state)).toBe('paused');
    expect(await page.evaluate(() => events.find(e => e.name === 'ddocbot-trainingerror').code))
      .toBe(problem === 'ambiguous' ? 'ambiguous-target' : 'target-resolution-failed');
    expect(await page.evaluate(() => calls.filter(c => c[0] === 'fly').length)).toBe(0);
  });
}

test('validates selector syntax and options before changing loaded script or view', async ({ page }) => {
  const result = await page.evaluate(() => {
    makeRuntime([{ id: 'ok', text: 'OK', advance: { type: 'manual' } }]);
    const before = calls.length;
    const errors = [];
    for (const [target, options] of [['[', {}], ['#valid', { resolveTarget: 42 }]]) {
      try { controller.load({ id: 'bad', version: 1, steps: [{ id: 'broken', target, text: 'Bad', advance: { type: 'manual' } }] }, options); }
      catch (error) { errors.push([error.name, error.message]); }
    }
    const unchanged = before === calls.length;
    controller.start();
    return { errors, unchanged, step: controller.currentStep.id };
  });
  expect(result.errors.map(e => e[0])).toEqual(['TypeError', 'TypeError']);
  expect(result.errors[0][1]).toContain('target');
  expect(result.unchanged).toBe(true);
  expect(result.step).toBe('ok');
});

test('resolver reentrancy cancels preparation even when it returns a valid element', async ({ page }) => {
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<button id="target">Action</button>');
    makeRuntime([{ id: 'a', target: { ref: 'a' }, text: 'Action', advance: { type: 'click' } }], {
      resolveTarget: () => { controller.pause(); return document.querySelector('#target'); }
    }); controller.start();
  });
  await expect.poll(() => page.evaluate(() => controller.state)).toBe('paused');
  expect(await page.evaluate(() => calls.filter(c => c[0] === 'fly').length)).toBe(0);
});

test('pointing callback can pause without installing listeners or playing narration', async ({ page }) => {
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<button id="target">Action</button>');
    makeRuntime([{ id: 'a', target: '#target', laser: true, audio: { sound: 'beep' }, text: 'Action', advance: { type: 'click' } }], {},
      { pointAt: () => { controller.pause(); return true; } }); controller.start();
  });
  await expect.poll(() => page.evaluate(() => controller.state)).toBe('paused');
  await page.locator('#target').click();
  expect(await page.evaluate(() => ({ state: controller.state, audio: calls.filter(c => c[0] === 'audio').length })))
    .toEqual({ state: 'paused', audio: 0 });
});

test('coordinate preparation passes document coordinates and enables manual completion', async ({ page }) => {
  await page.evaluate(() => {
    makeRuntime([{ id: 'a', target: { x: 120, y: 360 }, laser: true, text: 'Look', advance: { type: 'manual' } }]); controller.start();
  });
  await expect.poll(() => page.evaluate(() => controller.state)).toBe('active');
  expect(await page.evaluate(() => calls.filter(c => ['fly', 'point'].includes(c[0]))))
    .toEqual([['fly', { x: 120, y: 360 }], ['point', { x: 120, y: 360 }]]);
  expect(await page.evaluate(() => controller.next())).toBe(true);
});

test('shadow child change cannot satisfy a change listener on its host', async ({ page }) => {
  await page.evaluate(() => {
    const target = document.createElement('div'); target.id = 'target'; target.style.cssText = 'width:100px;height:100px'; document.body.append(target);
    const shadow = target.attachShadow({ mode: 'open' }); window.child = document.createElement('input'); shadow.append(child);
    makeRuntime([{ id: 'a', target: '#target', text: 'Change', advance: { type: 'change' } }]); controller.start();
  });
  await expect.poll(() => page.evaluate(() => controller.state)).toBe('active');
  expect(await page.evaluate(() => { child.dispatchEvent(new Event('change', { bubbles: true, composed: true })); return controller.state; })).toBe('active');
  expect(await page.evaluate(() => { document.querySelector('#target').dispatchEvent(new Event('change')); return controller.state; })).toBe('completed');
});

test('same click cannot complete the next step even when it targets the same ancestor', async ({ page }) => {
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<button id="target"><span>Action</span></button>');
    makeRuntime([{ id: 'a', target: '#target', text: 'One', advance: { type: 'click' } },
      { id: 'b', target: '#target', text: 'Two', advance: { type: 'click' } }]); controller.start();
  });
  await expect.poll(() => page.evaluate(() => controller.state)).toBe('active');
  await page.locator('#target span').click();
  await expect.poll(() => page.evaluate(() => controller.state)).toBe('active');
  expect(await page.evaluate(() => controller.currentStep.id)).toBe('b');
});

test('one native click cannot complete both an ancestor step and its descendant step', async ({ page }) => {
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<div id="outer"><button id="inner">Action</button></div>');
    makeRuntime([{ id: 'a', target: '#outer', text: 'One', advance: { type: 'click' } },
      { id: 'b', target: '#inner', text: 'Two', advance: { type: 'click' } }]); controller.start();
  });
  await expect.poll(() => page.evaluate(() => controller.state)).toBe('active');
  await page.click('#inner');
  await expect.poll(() => page.evaluate(() => controller.state)).toBe('active');
  expect(await page.evaluate(() => controller.currentStep.id)).toBe('b');
  await page.click('#inner');
  expect(await page.evaluate(() => controller.state)).toBe('completed');
});

test('listeners are ready before the active event and its synchronous action suppresses old audio', async ({ page }) => {
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<button id="target">Action</button>');
    makeRuntime([{ id: 'a', target: '#target', audio: { sound: 'beep' }, text: 'Act', advance: { type: 'click' } }], {},
      { emit: (name, detail) => {
        if (name === 'ddocbot-trainingstatechange' && detail.state === 'active') document.querySelector('#target').click();
      } }); controller.start();
  });
  await expect.poll(() => page.evaluate(() => controller.state)).toBe('completed');
  expect(await page.evaluate(() => calls.filter(c => c[0] === 'audio').length)).toBe(0);
});

test('shares route and target timeout and rejects old route confirmations', async ({ page }) => {
  const result = await page.evaluate(() => {
    makeRuntime([{ id: 'wait', route: 'form', target: '#missing', text: 'Wait', advance: { type: 'manual' } }]);
    controller.start(); const old = controller.token;
    runtime.update(10000); controller.routeReady('form', { token: old }); runtime.update(5000);
    const paused = controller.state;
    controller.resume();
    return { paused, stale: controller.routeReady('form', { token: old }), state: controller.state,
      errors: events.filter(e => e.name === 'ddocbot-trainingerror').map(e => e.code) };
  });
  expect(result).toEqual({ paused: 'paused', stale: false, state: 'waiting-route', errors: ['timeout'] });
});

for (const loss of ['remove', 'hide', 'replace']) {
  test(`detects ${loss} of the captured target with laser disabled`, async ({ page }) => {
    await page.evaluate(() => {
      document.body.insertAdjacentHTML('beforeend', '<button id="target">Action</button>');
      makeRuntime([{ id: 'a', target: '#target', text: 'Action', laser: false, advance: { type: 'click' } }]);
      controller.start();
    });
    await expect.poll(() => page.evaluate(() => controller.state)).toBe('active');
    await page.evaluate(loss => {
      const target = document.querySelector('#target');
      if (loss === 'remove') target.remove();
      if (loss === 'hide') target.style.display = 'none';
      if (loss === 'replace') target.replaceWith(target.cloneNode(true));
      runtime.update(100);
    }, loss);
    await expect.poll(() => page.evaluate(() => controller.state)).toBe('paused');
    expect(await page.evaluate(() => events.find(e => e.name === 'ddocbot-trainingerror').code)).toBe('target-lost');
  });
}

test('offscreen target remains actionable and is not revealed again', async ({ page }) => {
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<button id="target">Action</button>');
    makeRuntime([{ id: 'a', target: '#target', text: 'Action', advance: { type: 'click' } }]); controller.start();
  });
  await expect.poll(() => page.evaluate(() => controller.state)).toBe('active');
  const result = await page.evaluate(() => {
    const target = document.querySelector('#target'); target.style.transform = 'translateY(10000px)'; runtime.update(100);
    const state = controller.state; target.click();
    return { state, after: controller.state, flights: calls.filter(c => c[0] === 'fly').length };
  });
  expect(result).toEqual({ state: 'active', after: 'completed', flights: 1 });
});

test('captures click before bubbling route navigation and never reuses that click', async ({ page }) => {
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<button id="target"><span>Action</span></button>');
    makeRuntime([
      { id: 'a', target: '#target', text: 'Open', advance: { type: 'click' } },
      { id: 'b', route: 'next', target: '#target', text: 'Again', advance: { type: 'click' } }
    ]);
    document.body.addEventListener('click', () => {
      controller.routeChanged('next'); controller.routeReady('next', { token: controller.token });
    });
    controller.start();
  });
  await expect.poll(() => page.evaluate(() => controller.state)).toBe('active');
  await page.locator('#target span').click();
  await expect.poll(() => page.evaluate(() => controller.state)).toBe('active');
  expect(await page.evaluate(() => controller.currentStep.id)).toBe('b');
  await page.locator('#target span').click();
  expect(await page.evaluate(() => controller.state)).toBe('completed');
});

test('change waits for its own event and evaluates exact text and boolean conditions', async ({ page }) => {
  const result = await page.evaluate(async () => {
    document.body.insertAdjacentHTML('beforeend', '<input id="field" value="empresa"><input id="check" type="checkbox" checked>');
    makeRuntime([
      { id: 'a', target: '#field', text: 'Type', advance: { type: 'change', condition: { kind: 'equals', value: 'empresa' } } },
      { id: 'b', target: '#check', text: 'Check', advance: { type: 'change', condition: { kind: 'checked', value: true } } }
    ]); controller.start();
    await new Promise(resolve => setTimeout(resolve, 20));
    const initial = controller.currentStep.id;
    const field = document.querySelector('#field'); field.value = ' empresa'; field.dispatchEvent(new Event('change', { bubbles: true }));
    const mismatch = controller.currentStep.id;
    field.value = 'empresa'; field.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 20));
    const check = document.querySelector('#check'); check.checked = false; check.dispatchEvent(new Event('change'));
    const unchecked = controller.state; check.checked = true; check.dispatchEvent(new Event('change'));
    return { initial, mismatch, unchecked, end: controller.state };
  });
  expect(result).toEqual({ initial: 'a', mismatch: 'a', unchecked: 'active', end: 'completed' });
});

test('paused continuation cannot fly, point, listen or play even with unchanged token', async ({ page }) => {
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<button id="target">Action</button>');
    makeRuntime([{ id: 'a', target: '#target', laser: true, audio: { sound: 'beep' }, text: 'Action', advance: { type: 'click' } }], {},
      { emit: (name, detail) => { if (name === 'ddocbot-trainingstatechange' && detail.state === 'presenting') controller.pause(); } });
    controller.start();
  });
  await expect.poll(() => page.evaluate(() => controller.state)).toBe('paused');
  expect(await page.evaluate(() => calls.filter(c => ['fly', 'point', 'audio'].includes(c[0])).length)).toBe(0);
  await page.locator('#target').click();
  expect(await page.evaluate(() => controller.state)).toBe('paused');
});

test('ignores flight completion after pause and after visibility operation replacement', async ({ page }) => {
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<button id="target">Action</button>');
    window.flights = [];
    makeRuntime([{ id: 'a', target: '#target', laser: true, text: 'Action', advance: { type: 'click' } }], {},
      { flyTo: () => new Promise(resolve => flights.push(resolve)) }); controller.start();
  });
  await expect.poll(() => page.evaluate(() => flights.length)).toBe(1);
  await page.evaluate(() => { controller.pause(); flights[0]('arrived'); });
  expect(await page.evaluate(() => controller.state)).toBe('paused');
  await page.evaluate(() => controller.resume());
  await expect.poll(() => page.evaluate(() => flights.length)).toBe(2);
  await page.evaluate(() => { runtime.visibilityChanged(false); runtime.visibilityChanged(true); });
  await expect.poll(() => page.evaluate(() => flights.length)).toBe(3);
  await page.evaluate(() => flights[1]('arrived'));
  expect(await page.evaluate(() => controller.state)).toBe('presenting');
  await page.evaluate(() => flights[2]('arrived'));
  await expect.poll(() => page.evaluate(() => controller.state)).toBe('active');
  expect(await page.evaluate(() => calls.filter(c => c[0] === 'point').length)).toBe(1);
});

test('visibility preserves captured target and never replays audio or flight after arrival', async ({ page }) => {
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<button id="target">Action</button>');
    makeRuntime([{ id: 'a', target: '#target', laser: true, audio: { sound: 'beep' }, text: 'Action', advance: { type: 'click' } }]); controller.start();
  });
  await expect.poll(() => page.evaluate(() => controller.state)).toBe('active');
  await page.evaluate(() => { runtime.visibilityChanged(false); document.querySelector('#target').click(); runtime.update(20000); runtime.visibilityChanged(true); });
  await expect.poll(() => page.evaluate(() => calls.filter(c => c[0] === 'point').length)).toBe(2);
  expect(await page.evaluate(() => ({ state: controller.state, flights: calls.filter(c => c[0] === 'fly').length, audio: calls.filter(c => c[0] === 'audio').length })))
    .toEqual({ state: 'active', flights: 1, audio: 1 });
  await page.evaluate(() => { runtime.visibilityChanged(false); const old = document.querySelector('#target'); old.replaceWith(old.cloneNode(true)); runtime.visibilityChanged(true); });
  await expect.poll(() => page.evaluate(() => controller.state)).toBe('paused');
});

test('hidden route confirmation defers work and hidden signal advances only on return', async ({ page }) => {
  await page.evaluate(() => {
    makeRuntime([{ id: 'a', route: 'form', text: 'Save', advance: { type: 'signal', name: 'saved' } },
      { id: 'b', text: 'Done', advance: { type: 'manual' } }]); controller.start(); runtime.visibilityChanged(false);
    controller.routeReady('form', { token: controller.token }); runtime.update(20000);
  });
  expect(await page.evaluate(() => controller.state)).toBe('presenting');
  await page.evaluate(() => runtime.visibilityChanged(true));
  await expect.poll(() => page.evaluate(() => controller.state)).toBe('active');
  expect(await page.evaluate(() => {
    runtime.visibilityChanged(false); const token = controller.token;
    return [controller.signal('saved', { token }), controller.signal('saved', { token }), controller.currentStep.id];
  })).toEqual([true, false, 'a']);
  await page.evaluate(() => runtime.visibilityChanged(true));
  await expect.poll(() => page.evaluate(() => controller.currentStep.id)).toBe('b');
});

test('message validation, external commands and destroy preserve facade contracts', async ({ page }) => {
  await page.evaluate(() => { makeRuntime([{ id: 'a', text: 'Info', advance: { type: 'manual' } }]); controller.start(); });
  await expect.poll(() => page.evaluate(() => controller.state)).toBe('active');
  const result = await page.evaluate(() => {
    const token = controller.token;
    const message = controller.message('Feedback', { token });
    runtime.externalCommand();
    const paused = controller.state;
    const cleared = calls.some(call => call[0] === 'clear');
    const stale = controller.message('Stale', { token: 'old' });
    const emptyToken = controller.message('Idle', { token: null });
    let error; try { controller.message('Bad', { token, duration: -1 }); } catch (e) { error = e.name; }
    const options = calls.find(c => c[0] === 'message')[2];
    runtime.destroy(); runtime.destroy();
    return { message, paused, cleared, stale, emptyToken, error, options, state: controller.state,
      cancel: events.filter(e => e.name === 'ddocbot-trainingcancel').map(e => e.reason) };
  });
  expect(result).toEqual({ message: true, paused: 'paused', cleared: true, stale: false, emptyToken: false, error: 'TypeError',
    options: { token: expect.any(String), duration: 6000 }, state: 'idle', cancel: ['disconnected'] });
});

test('disconnected hosts reject work while preserving argument validation and staged loading', async ({ page }) => {
  const result = await page.evaluate(() => {
    makeRuntime([{ id: 'a', text: 'Info', advance: { type: 'manual' } }]); host.remove();
    const start = controller.start();
    const signal = controller.signal('ok', { token: null });
    const message = controller.message('Info', { token: null });
    let error; try { controller.signal('ok', { token: 5 }); } catch (e) { error = e.name; }
    document.body.append(host);
    return { start, signal, message, error, connectedStart: controller.start() };
  });
  expect(result).toEqual({ start: false, signal: false, message: false, error: 'TypeError', connectedStart: true });
});

test('returning to a visible waiting route resumes the cancelled trip home', async ({ page }) => {
  const result = await page.evaluate(() => {
    makeRuntime([{ id: 'a', route: 'form', text: 'Wait', advance: { type: 'manual' } }]);
    controller.start(); const token = controller.token;
    runtime.visibilityChanged(false); runtime.visibilityChanged(true);
    return { state: controller.state, sameToken: token === controller.token,
      home: calls.filter(c => c[0] === 'home').length };
  });
  expect(result).toEqual({ state: 'waiting-route', sameToken: true, home: 2 });
});

test('reference polling is throttled and stops while hidden and after destroy', async ({ page }) => {
  await page.evaluate(() => {
    window.resolutions = 0;
    makeRuntime([{ id: 'a', target: { ref: 'late' }, text: 'Wait', advance: { type: 'manual' } }],
      { resolveTarget: () => { resolutions++; return null; } }); controller.start();
  });
  const result = await page.evaluate(async () => {
    for (let i = 0; i < 8; i++) {
      document.body.dataset.poll = String(i);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const firstWindow = resolutions;
    runtime.visibilityChanged(false); const hiddenStart = resolutions;
    await new Promise(resolve => setTimeout(resolve, 150));
    const hiddenEnd = resolutions;
    runtime.visibilityChanged(true);
    await new Promise(resolve => setTimeout(resolve, 20));
    runtime.destroy(); const destroyedStart = resolutions;
    await new Promise(resolve => setTimeout(resolve, 150));
    return { firstWindow, hiddenStart, hiddenEnd, destroyedStart, destroyedEnd: resolutions };
  });
  expect(result.firstWindow).toBeLessThanOrEqual(2);
  expect(result.hiddenEnd).toBe(result.hiddenStart);
  expect(result.destroyedEnd).toBe(result.destroyedStart);
});

test('render carries attempt identity so feedback survives pause but clears on resume', async ({ page }) => {
  await page.evaluate(() => {
    makeRuntime([{ id: 'a', text: 'Info', advance: { type: 'manual' } }]); controller.start();
  });
  await expect.poll(() => page.evaluate(() => controller.state)).toBe('active');
  const result = await page.evaluate(() => {
    const oldToken = controller.token;
    const initial = calls.filter(c => c[0] === 'render').at(-1)[2];
    controller.pause();
    const paused = calls.filter(c => c[0] === 'render').at(-1)[2];
    controller.resume();
    const resumed = calls.filter(c => c[0] === 'render').at(-1)[2];
    return { initialMatches: initial === oldToken, pausedMatches: paused === oldToken,
      resumedMatches: resumed === controller.token, changed: resumed !== oldToken };
  });
  expect(result).toEqual({ initialMatches: true, pausedMatches: true, resumedMatches: true, changed: true });
});

test('empty message text clears feedback while non-string text stays invalid', async ({ page }) => {
  await page.evaluate(() => {
    makeRuntime([{ id: 'a', text: 'Info', advance: { type: 'manual' } }]); controller.start();
  });
  await expect.poll(() => page.evaluate(() => controller.state)).toBe('active');
  const result = await page.evaluate(() => {
    const token = controller.token;
    let error; try { controller.message(42, { token }); } catch (e) { error = e.name; }
    return { accepted: controller.message('', { token, duration: 0 }), error,
      message: calls.filter(c => c[0] === 'message').at(-1).slice(1) };
  });
  expect(result).toEqual({ accepted: true, error: 'TypeError', message: ['', { token: expect.any(String), duration: 0 }] });
});
