import { expect, test } from '@playwright/test';

test('admin creates a team link, Radek picks his profile; a new link voids the old one', async ({ page, browser }) => {
  page.on('dialog', (dialog) => void dialog.accept());
  await page.goto('/dev-login');
  await page.getByRole('button', { name: /Admin/ }).first().click();
  await page.waitForURL('**/');

  await page.goto('/nastaveni');
  const create = page.getByRole('button', { name: 'Vytvořit odkaz', exact: true });
  if (await create.isVisible({ timeout: 30_000 }).catch(() => false)) await create.click();
  const field = page.getByLabel('Odkaz pro vedení', { exact: true });
  await expect(field).toBeVisible({ timeout: 30_000 });
  const oldUrl = await field.inputValue();
  expect(oldUrl).toMatch(/\/tym\/[A-Za-z0-9_-]{32}$/);

  const context = await browser.newContext();
  const guest = await context.newPage();
  await guest.goto(oldUrl);
  await expect(guest.getByRole('heading', { name: 'Kdo jsi?' })).toBeVisible();
  await expect(guest.getByRole('button', { name: /Honza/ })).toBeVisible();
  await expect(guest.getByRole('button', { name: /Admin/ })).toHaveCount(0);
  await guest.getByRole('button', { name: /Radek/ }).click();
  await guest.waitForURL((url) => url.pathname === '/');
  await expect(guest.getByText('Radek').first()).toBeVisible();
  await context.close();

  await page.getByRole('button', { name: 'Vytvořit nový odkaz (starý přestane platit)' }).click();
  await expect(field).not.toHaveValue(oldUrl, { timeout: 30_000 });

  const fresh = await browser.newContext();
  const stale = await fresh.newPage();
  await stale.goto(oldUrl);
  await expect(stale.getByText('Tenhle odkaz už neplatí. Požádej Admina o nový.')).toBeVisible();
  await fresh.close();
});
