import { expect, test } from '@playwright/test';

const examples = [
  { name: 'Vue', url: 'http://127.0.0.1:4174/' },
  { name: 'Angular', url: 'http://127.0.0.1:4175/' }
];

for (const example of examples) {
  test(`${example.name} guia o DdocBot até um alvo e volta para casa`, async ({ page }) => {
    await page.goto(example.url);

    const bot = page.locator('dot-bot');
    await bot.evaluate(element => {
      window.exampleNavigationStates = [];
      element.addEventListener('ddocbot-navigationchange', event => window.exampleNavigationStates.push(event.detail.state));
    });
    await page.getByRole('button', { name: 'Guiar até o destaque' }).click();

    await expect(page.getByRole('status')).toContainText('Cheguei ao destaque');
    await expect.poll(() => bot.evaluate(element => element.navigationState)).toBe('pointing');
    expect(await page.evaluate(() => window.exampleNavigationStates)).toEqual(expect.arrayContaining(['flying', 'hovering', 'pointing']));

    await page.getByRole('button', { name: 'Voltar para casa' }).click();
    await expect.poll(() => bot.evaluate(element => element.navigationState)).toBe('home');
  });
}
