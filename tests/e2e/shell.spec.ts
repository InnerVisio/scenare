import { expect, test, type Page } from '@playwright/test';

async function loginAsHonza(page: Page) {
  await page.goto('/dev-login');
  await page.getByRole('button', { name: /Honza/ }).click();
  await page.waitForURL('**/');
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('app shell', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsHonza(page);
  });

  test('/ui-kit renders without horizontal scroll', async ({ page }, info) => {
    await page.goto('/ui-kit');
    await expect(page.getByRole('heading', { name: 'UI kit' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: `test-results/ui-kit-${info.project.name}.png`, fullPage: true });
  });

  test('/ shows the shell without horizontal scroll', async ({ page }, info) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Dobr/);
    await expect(page.getByRole('button', { name: /Měsíc/ })).toContainText(/\d{4}/);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: `test-results/home-${info.project.name}.png` });
  });

  test('placeholder page, cycle picker and navigation', async ({ page }, info) => {
    await page.goto('/serie');
    await expect(page.getByText('Připravujeme')).toBeVisible();
    await page.getByRole('button', { name: /Cyklus/ }).click();
    await page.getByRole('list', { name: 'Cyklus' }).getByRole('button', { name: 'Cyklus 2026–11' }).click();
    await expect(page.getByRole('button', { name: /Cyklus:/ })).toBeFocused();
    await expect(page).toHaveURL(/\/serie\?.*cyklus=2026-11/);
    await expectNoHorizontalScroll(page);
    if (info.project.name === 'mobile') {
      await page.getByRole('button', { name: 'Více' }).click();
      await expect(page.getByRole('link', { name: 'Publikace' })).toBeVisible();
      await page.screenshot({ path: 'test-results/more-sheet-mobile.png' });
    }
  });

  test('invalid month parameter falls back instead of failing', async ({ page }) => {
    const response = await page.goto('/?mesic=abc&cyklus=zzz');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Dobr/);
    await expect(page.getByRole('button', { name: /Měsíc/ })).toContainText(/\d{4}/);
    await expect(page.getByRole('button', { name: /Cyklus/ })).toContainText('Cyklus 2026–11');
  });

  test('avatar menu opens, Escape closes it and focus returns to the avatar', async ({ page }) => {
    await page.goto('/');
    const avatar = page.getByRole('button', { name: /Účet: Honza/ });
    await avatar.click();
    await expect(avatar).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: 'Odhlásit se' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(avatar).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('button', { name: 'Odhlásit se' })).toBeHidden();
    await expect(avatar).toBeFocused();
  });
});
