import { expect, test } from '@playwright/test';

const examples = [
  { name: 'Vue', url: 'http://127.0.0.1:4174/', heading: 'DdocBot com Vue 3' },
  { name: 'Angular', url: 'http://127.0.0.1:4175/', heading: 'DdocBot com Angular' }
];

for (const example of examples) {
  test(`${example.name} integra o DdocBot compilado`, async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto(example.url);
    await expect(page.getByRole('heading', { name: example.heading })).toBeVisible();

    const bot = page.locator('dot-bot');
    await expect(bot).toBeVisible();
    await expect(bot).toHaveJSProperty('muted', true);

    const runButton = page.getByRole('button', { name: 'Executar tarefa' });
    await runButton.click();
    await expect(page.getByRole('button', { name: 'Executando…' })).toBeDisabled();
    await expect(bot.locator('.bubble')).toBeVisible();
    await expect(page.getByText('Concluído com sucesso')).toBeVisible({ timeout: 4_000 });
    await expect(page.getByRole('button', { name: 'Executar tarefa' })).toBeEnabled();
    expect(pageErrors).toEqual([]);
  });
}
