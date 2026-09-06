import { expect, test } from '@playwright/test';

const frameworks = [
  { name: 'Vue', url: 'http://127.0.0.1:4174/' },
  { name: 'Angular', url: 'http://127.0.0.1:4175/' }
];

async function currentStep(page, id, state = 'active') {
  await expect.poll(() => page.locator('dot-bot').evaluate(element =>
    `${element.training.currentStep?.id}:${element.training.state}`
  )).toBe(`${id}:${state}`);
}

async function reachSave(page, example, { automatic = false } = {}) {
  await page.goto(example.url);
  if (automatic) {
    await page.getByLabel('Solicitar navegação automática entre as etapas', { exact: true }).check();
  }
  await page.getByRole('button', { name: 'Iniciar treinamento', exact: true }).click();
  await expect(page).toHaveURL(/#\/training\/clients$/);
  await currentStep(page, 'welcome');
  await page.getByRole('button', { name: 'Próximo', exact: true }).click();
  await currentStep(page, 'open-form');
  await page.getByRole('button', { name: 'Novo cliente', exact: true }).click();
  await expect(page).toHaveURL(/#\/training\/clients\/new$/);
  await currentStep(page, 'name');
  await page.getByLabel('Nome do cliente', { exact: true }).fill('Ana');
  await page.getByLabel('Nome do cliente', { exact: true }).press('Tab');
  await currentStep(page, 'save');
  await expect(page.getByText(
    'Salve o cadastro. Vou aguardar a confirmação do sistema antes de concluir.',
    { exact: true }
  )).toBeVisible();
}

for (const example of frameworks) {
  test(`${example.name} conclui o treinamento sequencial entre rotas`, async ({ page }) => {
    await reachSave(page, example);
    await page.getByRole('button', { name: 'Salvar cliente', exact: true }).click();

    await expect.poll(() => page.locator('dot-bot').evaluate(element => element.training.state)).toBe('completed');
    await expect(page.getByText('Cliente salvo com sucesso.', { exact: true })).toBeVisible();
  });

  test(`${example.name} mantém o passo de salvamento após uma falha`, async ({ page }) => {
    await reachSave(page, example);
    await page.getByLabel('Simular falha ao salvar', { exact: true }).check();
    await page.getByRole('button', { name: 'Salvar cliente', exact: true }).click();

    await expect(page.getByText('Não foi possível salvar o cliente.', { exact: true })).toBeVisible();
    await currentStep(page, 'save');
    await expect(page.getByText(
      'Não foi possível salvar. Desmarque a falha simulada e tente novamente.',
      { exact: true }
    )).toBeVisible();

    await page.getByLabel('Simular falha ao salvar', { exact: true }).uncheck();
    await page.getByRole('button', { name: 'Salvar cliente', exact: true }).click();
    await expect.poll(() => page.locator('dot-bot').evaluate(element => element.training.state)).toBe('completed');
  });

  test(`${example.name} aguarda a rota anterior quando o usuário volta um passo`, async ({ page }) => {
    await reachSave(page, example);
    await page.getByRole('button', { name: 'Voltar', exact: true }).click();
    await currentStep(page, 'name');
    await page.getByRole('button', { name: 'Voltar', exact: true }).click();

    await currentStep(page, 'open-form', 'waiting-route');
    await expect(page).toHaveURL(/#\/training\/clients\/new$/);
    await page.getByRole('link', { name: 'Lista de clientes', exact: true }).click();
    await expect(page).toHaveURL(/#\/training\/clients$/);
    await currentStep(page, 'open-form');
  });

  test(`${example.name} volta automaticamente à rota solicitada`, async ({ page }) => {
    await reachSave(page, example, { automatic: true });
    await page.getByRole('button', { name: 'Voltar', exact: true }).click();
    await currentStep(page, 'name');
    await page.getByRole('button', { name: 'Voltar', exact: true }).click();

    await expect(page).toHaveURL(/#\/training\/clients$/);
    await currentStep(page, 'open-form');
  });
}
