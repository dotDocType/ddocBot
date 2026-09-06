import { test, expect } from '@playwright/test';

async function setup(page, advance = { type: 'signal', name: 'saved' }) {
  await page.goto('/');
  await page.evaluate(async advance => {
    document.querySelector('dot-bot')?.remove();
    const { TrainingView } = await import('/src/training/view.js');
    const host = document.createElement('div'); host.setAttribute('data-training-view-fixture', '');
    host.attachShadow({ mode: 'open' });
    host.shadowRoot.innerHTML = `<style>.bubble{max-width:280px;overflow-wrap:anywhere}</style><button id="trigger">ddocBot</button><div class="bubble"><div role="status"></div><button class="close">Fechar</button></div>`;
    document.body.prepend(host);
    const outside = document.createElement('input'); outside.id = 'outside';
    document.body.prepend(outside);
    window.viewActions = [];
    window.trainingView = new TrainingView({
      bubble: host.shadowRoot.querySelector('.bubble'), status: host.shadowRoot.querySelector('[role=status]'),
      closeButton: host.shadowRoot.querySelector('.close'), trigger: host.shadowRoot.querySelector('#trigger'),
      onAction: action => window.viewActions.push(action), onResize() {}
    });
    window.viewSnapshot = { state: 'active', index: 1, total: 3,
      step: { id: 'save', text: 'Salve o cadastro', advance } };
    trainingView.render(viewSnapshot);
  }, advance);
}

test('practical instruction persists after feedback expires and offers no bypass', async ({ page }) => {
  await setup(page);
  await page.mouse.move(1200, 700);
  await page.getByRole('button', { name: 'Pausar', exact: true }).focus();
  await page.evaluate(() => trainingView.message('Confira os dados', { duration: 100 }));
  await expect(page.getByText('Confira os dados', { exact: true })).toBeVisible();
  await page.locator('#outside').focus();
  await expect(page.getByText('Confira os dados', { exact: true })).not.toBeVisible();
  await expect(page.locator('[data-training-view-fixture]').getByRole('status')).toContainText('Salve o cadastro');
  await expect(page.getByText('Passo 2 de 3')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Próximo', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Encerrar', exact: true })).toBeVisible();
});

test('native keyboard actions and first/last step controls', async ({ page }) => {
  await setup(page, { type: 'manual' });
  await page.evaluate(() => trainingView.render({ ...viewSnapshot, index: 0 }));
  await expect(page.getByRole('button', { name: 'Voltar', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Próximo', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => viewActions)).toEqual(['next']);
  await page.evaluate(() => trainingView.render({ ...viewSnapshot, index: 2 }));
  await page.getByRole('button', { name: 'Concluir', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => viewActions)).toEqual(['next', 'next']);
});

test('pausing shows retry and preserves outside focus', async ({ page }) => {
  await setup(page);
  await page.locator('#outside').focus();
  await page.evaluate(() => trainingView.render({ ...viewSnapshot, state: 'paused', reason: 'timeout' }));
  await expect(page.locator('#outside')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Tentar novamente', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect.poll(() => page.evaluate(() => viewActions)).toEqual(['resume']);
});

test('feedback expiry pauses during focus and hidden state, and cleanup restores normal bubble', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Pausar', exact: true }).focus();
  await page.evaluate(() => trainingView.message('Ainda aqui', { duration: 100 }));
  await page.waitForTimeout(160);
  await expect(page.getByText('Ainda aqui', { exact: true })).toBeVisible();
  await page.evaluate(() => trainingView.setVisible(false));
  await page.locator('#outside').focus();
  await page.mouse.move(1200, 700);
  await page.waitForTimeout(160);
  await expect(page.getByText('Ainda aqui', { exact: true })).toBeVisible();
  await page.evaluate(() => trainingView.setVisible(true));
  await expect(page.getByText('Ainda aqui', { exact: true })).not.toBeVisible();
  await page.evaluate(() => trainingView.clear());
  await expect(page.getByRole('button', { name: 'Encerrar', exact: true })).toHaveCount(0);
  await page.evaluate(() => trainingView.destroy());
});

test('controls meet touch size and long plain text wraps on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await setup(page, { type: 'manual' });
  await page.evaluate(() => trainingView.render({ ...viewSnapshot,
    step: { ...viewSnapshot.step, text: '<img src=x>' + 'palavra'.repeat(80) } }));
  const control = page.getByRole('button', { name: 'Pausar', exact: true });
  const rect = await control.boundingBox();
  expect(rect.width).toBeGreaterThanOrEqual(44);
  expect(rect.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('[data-training-view-fixture]').getByRole('status')).toContainText('<img src=x>');
  await expect(page.locator('[role=status] img')).toHaveCount(0);
  const width = await page.locator('[data-training-view-fixture]').getByRole('status').evaluate(el => el.scrollWidth);
  expect(width).toBeLessThanOrEqual(280);
});


test('feedback expiry pauses on hover and resumes after leaving', async ({ page }) => {
  await setup(page);
  await page.getByText('Salve o cadastro', { exact: true }).hover();
  await page.evaluate(() => trainingView.message('Leia com calma', { duration: 120 }));
  await page.waitForTimeout(200);
  await expect(page.getByText('Leia com calma', { exact: true })).toBeVisible();
  await page.mouse.move(1200, 700);
  await expect(page.getByText('Leia com calma', { exact: true })).not.toBeVisible();
});

test('focus is managed against the current shadow root after moving the bubble', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const portal = document.createElement('div'); portal.attachShadow({ mode: 'open' });
    document.body.prepend(portal);
    portal.shadowRoot.append(trainingView.bubble);
  });
  await page.getByRole('button', { name: 'Pausar', exact: true }).focus();
  await page.evaluate(() => trainingView.render({ ...viewSnapshot, state: 'paused', reason: 'user' }));
  await expect(page.getByRole('button', { name: 'Retomar', exact: true })).toBeFocused();
  await page.evaluate(() => trainingView.clear());
  await expect(page.getByRole('button', { name: 'ddocBot', exact: true })).toBeFocused();
});

test('new attempt clears feedback while pause on the same token preserves it', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    trainingView.render({ ...viewSnapshot, token: 'attempt-1' });
    trainingView.message('Mensagem antiga', { duration: 0 });
    trainingView.render({ ...viewSnapshot, token: 'attempt-1', state: 'paused', reason: 'user' });
  });
  await expect(page.getByText('Mensagem antiga', { exact: true })).toBeVisible();
  await page.evaluate(() => trainingView.render({ ...viewSnapshot, token: 'attempt-2', state: 'presenting' }));
  await expect(page.getByText('Mensagem antiga', { exact: true })).not.toBeVisible();
});

test('live regions are exposed before instruction and feedback updates', async ({ page }) => {
  await setup(page);
  const initial = await page.evaluate(() => {
    trainingView.clear();
    trainingView.render({ ...viewSnapshot, step: { ...viewSnapshot.step, text: 'Nova instrução acessível' } });
    return { hidden: trainingView.bubble.hidden, alreadyChanged: trainingView.status.textContent.includes('Nova instrução acessível') };
  });
  expect(initial).toEqual({ hidden: false, alreadyChanged: false });
  await expect(page.locator('[data-training-view-fixture]').getByRole('status')).toContainText('Nova instrução acessível');
  const feedback = await page.evaluate(() => {
    trainingView.message('Novo aviso acessível', { duration: 0 });
    return { hidden: trainingView.feedback.hidden, text: trainingView.feedback.textContent };
  });
  expect(feedback).toEqual({ hidden: false, text: '' });
  await expect(page.getByText('Novo aviso acessível', { exact: true })).toBeVisible();
});

test('clear notifies layout after hiding the training bubble', async ({ page }) => {
  await setup(page);
  const hiddenAtLayout = await page.evaluate(() => {
    let hidden;
    trainingView.onResize = () => { hidden = trainingView.bubble.hidden; };
    trainingView.clear();
    return hidden;
  });
  expect(hiddenAtLayout).toBe(true);
});
