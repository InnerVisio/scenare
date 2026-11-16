import { expect, test, type Page } from '@playwright/test';

async function loginAsRadek(page: Page) {
  await page.goto('/dev-login');
  await page.getByRole('button', { name: /Radek/ }).click();
  await page.waitForURL(/\/kontrola\/V\d+/);
}

test.describe('leadership mode', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRadek(page);
  });

  test('lands on the review and has exactly two navigation items', async ({ page }, info) => {
    await page.goto('/scenare');
    const nav = page.locator('nav[aria-label="Hlavní navigace"], aside[aria-label="Hlavní navigace"]');
    await expect(nav.getByRole('link')).toHaveCount(info.project.name === 'mobile' ? 2 : 3); // desktop rail also has the logo link
    await expect(nav.getByRole('link', { name: 'Scénáře', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nastavení' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Více' })).toHaveCount(0);
  });

  test('„?“ opens „Jak kontrolovat“', async ({ page }, info) => {
    if (info.project.name === 'mobile') await page.screenshot({ path: 'test-results/leadership-review-mobile.png' });
    await page.getByRole('button', { name: 'Nápověda' }).filter({ visible: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Jak kontrolovat' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Co znamenají stavy?')).toBeVisible();
  });

  test('Scénáře: next shooting day grouped by plain status, toggle shows every cycle', async ({ page }, info) => {
    await page.goto('/scenare');
    await expect(page.getByRole('button', { name: /Listopad|Natáčení \d/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Všechny scénáře', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Příští natáčení' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { name: /Čeká na tebe/ })).toBeVisible();
    if (info.project.name === 'mobile') await page.screenshot({ path: 'test-results/leadership-scenare-mobile.png', fullPage: true });
    await page.getByRole('link', { name: 'Všechny scénáře', exact: true }).click();
    await page.waitForURL(/zobrazit=vse/);
    await expect(page.getByText(/Bez termínu natáčení|Starší natáčení|Natáčení [a-zá-ž]+ \d/).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });

  test('admin-only pages redirect to the review', async ({ page }) => {
    for (const path of ['/nastaveni', '/prehled', '/serie', '/publikace']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/$|\/kontrola/);
    }
  });

  test('shooting day is read-only', async ({ page }) => {
    await page.goto('/nataceni');
    await expect(page.getByRole('button', { name: /Sdílet se štábem/ })).toHaveCount(0);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
  });
});
