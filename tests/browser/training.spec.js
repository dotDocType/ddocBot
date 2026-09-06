import { test, expect } from '@playwright/test';

async function mountRestored(page, command) {
  await page.goto('/');
  await page.evaluate(command => {
    document.querySelector('dot-bot').remove();
    const bot = document.createElement('dot-bot');
    bot.training.load({ id: 'offline', version: 1, steps: [
      { id: 'intro', text: 'Progresso preparado antes da montagem.', advance: { type: 'manual' } }
    ] });
    bot.training.restoreProgress({ schemaVersion: 1, trainingId: 'offline', version: 1,
      stepId: 'intro', status: 'in-progress' });
    if (command === 'say') bot.say('Mensagem externa antes da montagem.', { duration: 0 });
    if (command === 'dismissBubble') bot.dismissBubble();
    document.body.append(bot);
  }, command);
}

test('progress restored before connection presents resumable controls after mounting', async ({ page }) => {
  await mountRestored(page);
  expect(await page.locator('dot-bot').evaluate(el => el.training.state)).toBe('paused');
  await expect(page.getByText('Progresso preparado antes da montagem.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retomar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Concluir', exact: true })).toBeVisible();
});

for (const command of ['say', 'dismissBubble']) {
  test(`offline ${command} overrides staged training presentation until resume`, async ({ page }) => {
    await mountRestored(page, command);
    expect(await page.locator('dot-bot').evaluate(el => el.training.state)).toBe('paused');
    await expect(page.getByText('Progresso preparado antes da montagem.', { exact: true })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Retomar', exact: true })).not.toBeVisible();
    if (command === 'say') {
      await expect(page.getByText('Mensagem externa antes da montagem.', { exact: true })).toBeVisible();
    }
    await page.locator('dot-bot').evaluate(el => el.training.resume());
    await expect(page.getByText('Progresso preparado antes da montagem.', { exact: true })).toBeVisible();
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { defineDdocBot } = await import('/src/index.js'); defineDdocBot();
    document.body.innerHTML = '<button id="target" style="position:absolute;left:160px;top:150px;width:140px;height:60px">Alvo</button><dot-bot></dot-bot>';
    window.bot = document.querySelector('dot-bot');
    window.script = { id: 'intro', version: 1, steps: [{ id: 'welcome', text: 'Bem-vindo', advance: { type: 'manual' } }] };
  });
});

test('tasks continue after completing training', async ({ page }) => {
  await page.evaluate(() => { window.task = bot.beginTask(); bot.training.load(script); bot.training.start(); });
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await expect.poll(() => page.evaluate(() => bot.training.state)).toBe('completed');
  await expect.poll(() => page.evaluate(() => bot.navigationState)).toBe('home');
  await expect.poll(() => page.evaluate(() => bot.state)).toBe('processing');
  await page.evaluate(() => bot.endTask(task));
});

test('training cancels ordinary timer and feedback preserves instruction', async ({ page }) => {
  await page.evaluate(() => { bot.say('Anterior', { duration: 100 }); bot.training.load(script); bot.training.start(); });
  await expect(page.getByRole('button', { name: 'Concluir', exact: true })).toBeVisible();
  await page.evaluate(() => bot.training.message('Auxiliar', { token: bot.training.token, duration: 300 }));
  await expect(page.locator('.ddocbot-training-feedback')).toHaveText('Auxiliar');
  await expect(page.locator('.ddocbot-training-feedback')).toBeEmpty();
  await expect(page.getByRole('status')).toContainText('Bem-vindo');
  expect(await page.evaluate(() => bot.training.state)).toBe('active');
});

for (const command of ['say', 'flyTo', 'pointAt', 'stopPointing', 'returnHome', 'dismissBubble']) {
  test(`external ${command} pauses training`, async ({ page }) => {
    await page.evaluate(() => { bot.training.load(script); bot.training.start(); });
    await expect(page.getByRole('button', { name: 'Concluir', exact: true })).toBeVisible();
    await page.evaluate(command => {
      window.reasons = []; bot.addEventListener('ddocbot-trainingstatechange', e => reasons.push(e.detail.reason));
      if (command === 'say') bot.say('Externa', { duration: 0 });
      else if (command === 'flyTo') void bot.flyTo('#target', { duration: 0 });
      else if (command === 'pointAt') bot.pointAt('#target');
      else bot[command]();
    }, command);
    expect(await page.evaluate(() => bot.training.state)).toBe('paused');
    expect(await page.evaluate(() => reasons)).toContain('external-command');
    await expect(page.locator('.ddocbot-training-controls')).toBeHidden();
    if (command === 'say') await expect(page.getByRole('status')).toHaveText('Externa');
  });
}

test('pause during flight halts position and cancels its promise', async ({ page }) => {
  await page.evaluate(() => {
    script.steps[0].target = '#target';
    const fly = bot._navigation.flyTo.bind(bot._navigation);
    bot._navigation.flyTo = (...args) => { window.flight = fly(...args); return flight; };
    bot.training.load(script); bot.training.start();
  });
  await expect.poll(() => page.evaluate(() => bot.navigationState)).toBe('flying');
  await page.evaluate(() => bot.training.pause());
  expect(await page.evaluate(() => flight)).toBe('cancelled');
  expect(await page.evaluate(() => bot.navigationState)).toBe('hovering');
  const before = await page.locator('[data-ddocbot-layer] canvas').boundingBox();
  await page.waitForTimeout(150);
  expect(await page.locator('[data-ddocbot-layer] canvas').boundingBox()).toEqual(before);
});

test('waiting-target ticks at home and times out while task engine is idle', async ({ page }) => {
  await page.evaluate(() => { script.steps[0].target = '#missing'; script.steps[0].timeout = 150; bot.training.load(script); bot.training.start(); });
  await expect.poll(() => page.evaluate(() => bot.training.state)).toBe('paused');
  await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
  expect(await page.evaluate(() => bot.navigationState)).toBe('home');
});

test('completed task reaction is not replayed after immediate training completion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => { bot.training.load(script); bot.training.start(); });
  await expect(page.getByRole('button', { name: 'Concluir', exact: true })).toBeVisible();
  const result = await page.evaluate(() => {
    window.states = []; bot.addEventListener('ddocbot-statechange', e => states.push(e.detail.state));
    const task = bot.beginTask(); bot._engine.update(250); bot.endTask(task); bot.training.next(); bot._render();
    const canvas = bot.shadowRoot.querySelector('canvas');
    const pixels = [...canvas.getContext('2d').getImageData(0, 0, 24, 24).data];
    bot._engine.update(1100); bot._render();
    const idlePixels = [...canvas.getContext('2d').getImageData(0, 0, 24, 24).data];
    return { pixels, idlePixels, states };
  });
  expect(result.pixels).toEqual(result.idlePixels);
  expect(result.states).toContain('success');
  expect(result.states).toContain('idle');
});

test('reduced motion presents laser and waves; target loss pauses and restores ordinary bubble', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => { script.steps[0].target = '#target'; script.steps[0].laser = true; bot.training.load(script); bot.training.start(); });
  await expect.poll(() => page.evaluate(() => bot.training.state)).toBe('active');
  await expect(page.locator('.laser')).toBeVisible(); await expect(page.locator('.alert-waves')).toBeVisible();
  await page.evaluate(() => document.querySelector('#target').remove());
  await expect.poll(() => page.evaluate(() => bot.training.state)).toBe('paused');
  await expect(page.locator('.laser')).toBeHidden();
  await page.evaluate(() => { bot.training.stop(); bot.say('Comum', { duration: 0 }); });
  await expect(page.getByRole('button', { name: 'Fechar mensagem' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Comum');
});

test('hidden time suspends preparation and all frame activity then resumes', async ({ page }) => {
  await page.evaluate(() => { script.steps[0].target = '#missing'; script.steps[0].timeout = 400; bot.training.load(script); bot.training.start(); });
  await expect.poll(() => page.evaluate(() => bot.training.state)).toBe('waiting-target');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(550);
  expect(await page.evaluate(() => [bot.training.state, bot._raf])).toEqual(['waiting-target', null]);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => page.evaluate(() => bot.training.state)).toBe('paused');
});

test('ten disconnect cycles preserve controller identity and discard session resources', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (let index = 0; index < 10; index++) {
    await page.evaluate(() => { window.controller ||= bot.training; script.steps[0].target = '#target'; script.steps[0].laser = true; bot.training.load(script); bot.training.start(); });
    await expect.poll(() => page.evaluate(() => bot.training.state)).toBe('active');
    await page.evaluate(() => bot.remove());
    await expect(page.locator('[data-ddocbot-layer]')).toHaveCount(0);
    expect(await page.evaluate(() => [controller === bot.training, controller.state, bot._raf])).toEqual([true, 'idle', null]);
    await page.evaluate(() => document.body.append(bot));
    await expect(page.locator('.ddocbot-training-controls')).toHaveCount(1);
    await expect(page.locator('.ddocbot-training-controls')).toBeHidden();
  }
});

for (const reentrant of [false, true]) test(`step audio precedes alerts${reentrant ? ' during synchronous render reentry' : ''} and blocked sound never blocks controls`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(reentrant => {
    script.steps[0].target = '#target'; script.steps[0].laser = true; script.steps[0].audio = { sound: 'success' };
    window.sounds = [];
    const playSound = bot._audio.playSound.bind(bot._audio);
    bot._audio.playSound = name => { sounds.push(name); return playSound(name); };
    bot._audio.context = { state: 'running', currentTime: 0, destination: {}, close: () => Promise.resolve(),
      createGain: () => ({ gain: {}, connect() {}, disconnect() {} }),
      createOscillator: () => ({ frequency: {}, connect() {}, disconnect() {}, start() {}, stop() {} }) };
    if (reentrant) bot.addEventListener('ddocbot-trainingstatechange', e => { if (e.detail.state === 'active') bot.movementWidth = 200; });
    bot.muted = false; bot.alertSound = 'beep'; bot.training.load(script); bot.training.start();
  }, reentrant);
  await expect(page.getByRole('button', { name: 'Concluir', exact: true })).toBeVisible();
  expect(await page.evaluate(() => sounds)).toEqual(['success']);
  await page.evaluate(() => { bot.training.stop(); bot.muted = true; bot.training.load(script); bot.training.start(); });
  await expect(page.getByRole('button', { name: 'Concluir', exact: true })).toBeVisible();
  expect(await page.evaluate(() => bot.muted)).toBe(true);
});
