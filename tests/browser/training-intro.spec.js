import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { defineDdocBot } = await import('/src/index.js'); defineDdocBot();
    document.body.innerHTML = '<dot-bot></dot-bot>';
    window.bot = document.querySelector('dot-bot');
    window.part = selector => bot.shadowRoot.querySelector(selector);
    window.ringsPlaying = () => part('.intro').classList.contains('play');
    window.bubbleStyle = () => { const s = getComputedStyle(part('.bubble')); return { opacity: Number(s.opacity), pointer: s.pointerEvents }; };
    bot.training.load({ id: 'intro', version: 1, steps: [
      { id: 'welcome', text: 'Vamos cadastrar um cliente juntos.', advance: { type: 'manual' } },
      { id: 'second', text: 'Segundo passo.', advance: { type: 'manual' } }
    ] });
  });
});

const tailGeometry = page => page.evaluate(() => {
  const tail = part('.tail'), canvas = part('canvas'), bubble = part('.bubble');
  const t = tail.getBoundingClientRect(), c = canvas.getBoundingClientRect(), b = bubble.getBoundingClientRect();
  return { hidden: tail.hidden, tailX: t.left + t.width / 2, tailY: t.top + t.height / 2, dotX: c.left + c.width / 2,
    dotTop: c.top, dotBottom: c.bottom, bubbleTop: b.top, bubbleBottom: b.bottom };
});

test('training start pulses the dot first, then grows the bubble out of it', async ({ page }) => {
  await page.evaluate(() => bot.training.start());
  expect(await page.evaluate(() => ringsPlaying())).toBe(true);
  const early = await page.evaluate(() => bubbleStyle());
  expect(early.opacity).toBeLessThan(0.1);
  expect(early.pointer).toBe('none');
  await expect(page.getByText('Vamos cadastrar um cliente juntos.', { exact: true })).toBeAttached();
  await expect.poll(() => page.evaluate(() => bubbleStyle()), { timeout: 3000 }).toEqual({ opacity: 1, pointer: 'auto' });
  await expect.poll(() => page.evaluate(() => ringsPlaying())).toBe(false);
});

test('the tail points at the dot while training runs', async ({ page }) => {
  await page.evaluate(() => bot.training.start());
  await expect.poll(() => page.evaluate(() => bubbleStyle().opacity), { timeout: 3000 }).toBe(1);
  const above = await tailGeometry(page);
  expect(above.hidden).toBe(false);
  expect(Math.abs(above.tailX - above.dotX)).toBeLessThanOrEqual(2);
  expect(Math.abs(above.tailY - above.bubbleBottom)).toBeLessThanOrEqual(2);
  expect(above.tailY).toBeLessThan(above.dotTop);

  await page.evaluate(() => { bot.style.top = '8px'; bot.style.bottom = 'auto'; });
  await expect.poll(async () => { const g = await tailGeometry(page); return g.bubbleTop > g.dotBottom; }).toBe(true);
  const below = await tailGeometry(page);
  expect(below.hidden).toBe(false);
  expect(Math.abs(below.tailX - below.dotX)).toBeLessThanOrEqual(2);
  expect(Math.abs(below.tailY - below.bubbleTop)).toBeLessThanOrEqual(2);
  expect(below.tailY).toBeGreaterThan(below.dotBottom);

  await page.evaluate(() => bot.training.stop());
  expect(await page.evaluate(() => part('.tail').hidden)).toBe(true);
});

test('step changes and pause/resume do not replay the intro', async ({ page }) => {
  await page.evaluate(() => bot.training.start());
  await expect.poll(() => page.evaluate(() => ringsPlaying()), { timeout: 3000 }).toBe(false);
  await page.getByRole('button', { name: 'Próximo', exact: true }).click();
  await expect(page.getByText('Segundo passo.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => ringsPlaying())).toBe(false);
  await page.evaluate(() => { bot.training.pause(); bot.training.resume(); });
  expect(await page.evaluate(() => ringsPlaying())).toBe(false);
  expect((await page.evaluate(() => bubbleStyle())).opacity).toBe(1);
});

test('ordinary messages get neither intro nor tail', async ({ page }) => {
  await page.evaluate(() => bot.say('Oi', { duration: 0 }));
  expect(await page.evaluate(() => ringsPlaying())).toBe(false);
  expect(await page.evaluate(() => bubbleStyle())).toEqual({ opacity: 1, pointer: 'auto' });
  expect(await page.evaluate(() => part('.tail').hidden)).toBe(true);
});

test('reduced motion shows the bubble at once and a static ring', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => bot.training.start());
  expect(await page.evaluate(() => bubbleStyle())).toEqual({ opacity: 1, pointer: 'auto' });
  const ring = await page.evaluate(() => { const s = getComputedStyle(part('.intro i')); return { name: s.animationName, opacity: Number(s.opacity) }; });
  expect(ring.name).toBe('none');
  expect(ring.opacity).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => ringsPlaying()), { timeout: 3000 }).toBe(false);
});
