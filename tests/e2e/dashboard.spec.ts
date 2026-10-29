import { expect, test, type Page } from '@playwright/test';

async function loginAs(page: Page, name: 'Honza' | 'Admin') {
  await page.goto('/dev-login');
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.waitForURL('**/');
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('dashboard and settings', () => {
  test('Honza sees the review card and the kanban', async ({ page }, info) => {
    await loginAs(page, 'Honza');
    await expect(page.getByText('Čeká na tvou kontrolu')).toBeVisible();
    await expect(page.getByRole('link', { name: /Začít kontrolu/ })).toBeVisible();
    await expect(page.getByText('kde co vázne')).toBeVisible();
    await expect(page.getByText('Přehled mixu přijde ve fázi 3')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: `test-results/dashboard-${info.project.name}.png`, fullPage: true });
  });

  test('Admin saves a parameter', async ({ page }) => {
    await loginAs(page, 'Admin');
    await page.goto('/nastaveni');
    await page.getByLabel('Měsíční cíl videí').fill('17');
    await page.getByRole('button', { name: 'Uložit parametry' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Uloženo.' })).toBeVisible();
    await page.getByLabel('Měsíční cíl videí').fill('16');
    await page.getByRole('button', { name: 'Uložit parametry' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Uloženo.' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('Honza has no access to settings', async ({ page }) => {
    await loginAs(page, 'Honza');
    await page.goto('/nastaveni');
    await expect(page.getByText('Sem nemáš přístup.')).toBeVisible();
  });
});
