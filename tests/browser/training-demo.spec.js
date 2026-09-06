import { test, expect } from '@playwright/test';

async function step(page, id) {
  await expect.poll(() => page.locator('dot-bot').evaluate(el =>
    `${el.training.currentStep?.id}:${el.training.state}`)).toBe(`${id}:active`);
}
async function reachSave(page) {
  await page.getByRole('button', { name: 'Iniciar treinamento', exact: true }).click();
  await step(page, 'welcome');
  await page.getByRole('button', { name: 'Próximo', exact: true }).click();
  await step(page, 'open-form');
  await page.getByRole('button', { name: 'Novo cliente', exact: true }).click();
  await expect(page).toHaveURL(/#training\/new$/);
  await step(page, 'name');
  await page.getByLabel('Nome do cliente', { exact: true }).fill('Ana');
  await page.getByLabel('Nome do cliente', { exact: true }).press('Tab');
  await step(page, 'save');
  await expect(page.getByRole('status').filter({ hasText: 'Salve o cadastro.' })).toBeVisible();
}

test('demo completes a real sequential training across routes', async ({ page }) => {
  await page.goto('/');
  await reachSave(page);
  await page.getByRole('button', { name: 'Salvar cliente', exact: true }).click();
  await expect.poll(() => page.locator('dot-bot').evaluate(el => el.training.state)).toBe('completed');
  await expect(page.getByText('Cliente salvo com sucesso.', { exact: true })).toBeVisible();
});

test('demo keeps the save step after failure and accepts a later success', async ({ page }) => {
  await page.goto('/');
  await reachSave(page);
  await page.getByLabel('Simular falha ao salvar').check();
  await page.getByRole('button', { name: 'Salvar cliente', exact: true }).click();
  await expect(page.getByText('Não foi possível salvar o cliente.', { exact: true })).toBeVisible();
  await step(page, 'save');
  await expect(page.getByText('Não foi possível salvar. Desmarque a falha simulada e tente novamente.', { exact: true })).toBeVisible();
  await page.getByLabel('Simular falha ao salvar').uncheck();
  await page.getByRole('button', { name: 'Salvar cliente', exact: true }).click();
  await expect.poll(() => page.locator('dot-bot').evaluate(el => el.training.state)).toBe('completed');
});

test('demo restores exported progress paused and waits for user navigation', async ({ page }) => {
  await page.goto('/');
  await reachSave(page);
  await page.getByText('Salvar e restaurar o progresso', { exact: true }).click();
  await page.getByRole('button', { name: 'Exportar progresso', exact: true }).click();
  await page.getByRole('button', { name: 'Encerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Lista de clientes', exact: true }).click();
  await page.getByRole('button', { name: 'Restaurar progresso', exact: true }).click();
  await expect.poll(() => page.locator('dot-bot').evaluate(el => el.training.state)).toBe('paused');
  await page.locator('#training-resume').click();
  await expect.poll(() => page.locator('dot-bot').evaluate(el => el.training.state)).toBe('waiting-route');
  await expect(page).toHaveURL(/#training\/list$/);
  await page.getByRole('button', { name: 'Tela de cadastro', exact: true }).click();
  await step(page, 'save');
});

test('demo previous step can request automatic navigation', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Solicitar navegação automática entre as etapas').check();
  await reachSave(page);
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await step(page, 'name');
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await step(page, 'open-form');
  await expect(page).toHaveURL(/#training\/list$/);
});

test('invalid pasted progress leaves the running demo unchanged', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Iniciar treinamento', exact: true }).click();
  await step(page, 'welcome');
  const token = await page.locator('dot-bot').evaluate(el => el.training.token);
  await page.getByText('Salvar e restaurar o progresso', { exact: true }).click();
  await page.getByRole('button', { name: 'Exportar progresso', exact: true }).click();
  const progress = JSON.parse(await page.getByLabel('Progresso em JSON').inputValue());
  progress.status = 'invalid';
  await page.getByLabel('Progresso em JSON').fill(JSON.stringify(progress));
  await page.getByRole('button', { name: 'Restaurar progresso', exact: true }).click();
  await expect(page.locator('#training-feedback')).toContainText('Não foi possível restaurar');
  await step(page, 'welcome');
  expect(await page.locator('dot-bot').evaluate(el => el.training.token)).toBe(token);
});

test('double clicking save completes once', async ({ page }) => {
  await page.goto('/');
  await reachSave(page);
  await page.locator('dot-bot').evaluate(el => {
    window.completions = 0;
    el.addEventListener('ddocbot-trainingcomplete', () => window.completions++);
  });
  await page.getByRole('button', { name: 'Salvar cliente', exact: true }).dblclick();
  await expect.poll(() => page.locator('dot-bot').evaluate(el => el.training.state)).toBe('completed');
  expect(await page.evaluate(() => window.completions)).toBe(1);
});

test('ending training while saving ignores the later confirmation', async ({ page }) => {
  await page.goto('/');
  await reachSave(page);
  await page.getByRole('button', { name: 'Salvar cliente', exact: true }).click();
  await page.getByRole('button', { name: 'Encerrar', exact: true }).click();
  await expect(page.getByText('Cliente salvo com sucesso.', { exact: true })).toBeVisible();
  expect(await page.locator('dot-bot').evaluate(el => el.training.state)).toBe('cancelled');
});

test('unrelated page anchors preserve the active training screen', async ({ page }) => {
  await page.goto('/');
  await reachSave(page);
  await page.getByRole('link', { name: /Como integrar/ }).click();
  await expect(page).toHaveURL(/#integration$/);
  await step(page, 'save');
  await expect(page.getByLabel('Nome do cliente', { exact: true })).toHaveValue('Ana');
});

test('training demo choices and progress disclosure have 44 pixel hit areas', async ({ page }) => {
  await page.goto('/');
  for (const control of ['.training-check', '.training-copy summary']) {
    for (const box of await page.locator(control).evaluateAll(nodes => nodes.map(node => {
      const { width, height } = node.getBoundingClientRect(); return { width, height };
    }))) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  }
});
