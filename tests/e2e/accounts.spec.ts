import { expect, test } from '@playwright/test';

test('admin creates a personal login link that signs Radek in', async ({ page, browser }) => {
  await page.goto('/dev-login');
  await page.getByRole('button', { name: /Admin/ }).first().click();
  await page.waitForURL('**/');

  await page.goto('/nastaveni');
  const buttons = page.getByRole('button', { name: 'Přihlašovací odkaz', exact: true });
  await expect(buttons.first()).toBeVisible({ timeout: 30_000 });
  const emails = page.getByRole('textbox', { name: 'E-mail' });
  let index = -1;
  for (let i = 0; i < (await emails.count()); i++) {
    if ((await emails.nth(i).inputValue()) === 'radek@gta.local') index = i;
  }
  expect(index).toBeGreaterThanOrEqual(0);
  await buttons.nth(index).click();
  const field = page.getByLabel('Přihlašovací odkaz', { exact: true });
  await expect(field).toBeVisible();
  const link = await field.inputValue();
  expect(link).toMatch(/\/auth\/[A-Za-z0-9_-]{43}$/);
  await expect(page.getByText('Odkaz platí 7 dní')).toBeVisible();

  const context = await browser.newContext();
  const radek = await context.newPage();
  await radek.goto(link);
  await radek.getByRole('button', { name: 'Přihlásit se' }).click();
  await radek.waitForURL('**/');
  await expect(radek.getByText('Radek').first()).toBeVisible();
  await context.close();
});
