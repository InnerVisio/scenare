import { expect, test, type Page } from '@playwright/test';

async function loginAsHonza(page: Page) {
  await page.goto('/dev-login');
  await page.getByRole('button', { name: /Honza/ }).click();
  await page.waitForURL('**/');
}

test.describe('overview (Čísla)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsHonza(page);
  });

  test('shows seven sections and a Navrženo count links to a filtered list', async ({ page }) => {
    await page.goto('/prehled?mesic=2026-11&cyklus=2026-11');
    for (const n of [1, 2, 3, 4, 5, 6, 7]) {
      await expect(page.getByRole('heading', { level: 2, name: new RegExp(`^${n}\\. `) })).toBeVisible();
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    const section = page.getByRole('heading', { level: 2, name: /^1\. / }).locator('xpath=ancestor::div[contains(@class,"rounded-card")][1]');
    const link = section.locator('a[href*="aktivni=1"]:visible').first();
    await link.click();
    await page.waitForURL(/\/scenare\?.*aktivni=1/);
    await expect(page).toHaveURL(/mesic=2026-11/);
    await expect(page).toHaveURL(/kategorie=/);
  });
});
