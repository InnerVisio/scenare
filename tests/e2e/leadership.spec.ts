import { expect, test, type Page } from '@playwright/test';

async function loginAsRadek(page: Page) {
  await page.goto('/dev-login');
  await page.getByRole('button', { name: /Radek/ }).click();
  await page.waitForURL('**/');
}

test.describe('leadership mode', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRadek(page);
  });

  test('home shows the review card and minimal navigation', async ({ page }, info) => {
    await expect(page.getByText(/Ke kontrole: \d+ scénář/)).toBeVisible();
    await expect(page.getByRole('link', { name: /Začít kontrolu/ })).toBeVisible();
    const nav = page.locator('nav[aria-label="Hlavní navigace"], aside[aria-label="Hlavní navigace"]');
    await expect(nav.getByRole('link')).toHaveCount(info.project.name === 'mobile' ? 3 : 4); // desktop rail also has the logo link
    await expect(nav.getByRole('link', { name: 'Ke kontrole', exact: false })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Natáčení', exact: false })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Scénáře', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nastavení' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Více' })).toHaveCount(0);
  });

  test('admin-only pages redirect to the home', async ({ page }) => {
    for (const path of ['/nastaveni', '/prehled', '/serie', '/publikace']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/$/);
    }
  });

  test('„Začít kontrolu“ opens the first queue item', async ({ page }) => {
    await page.getByRole('link', { name: /Začít kontrolu/ }).click();
    await page.waitForURL(/\/kontrola\/V\d+/);
  });

  test('shooting day is read-only', async ({ page }) => {
    await page.goto('/nataceni');
    await expect(page.getByRole('button', { name: /Sdílet se štábem/ })).toHaveCount(0);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
  });
});
