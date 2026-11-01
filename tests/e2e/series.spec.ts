import { expect, test } from '@playwright/test';

test('admin sees series S01, its detail with two episodes and a disabled close button with a reason', async ({ page }) => {
  await page.goto('/dev-login');
  await page.getByRole('button', { name: /Admin/ }).click();
  await page.waitForURL('**/');

  await page.goto('/serie');
  await expect(page.getByRole('heading', { level: 1, name: 'Série' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Nová série/ })).toBeVisible();
  await page.getByRole('link', { name: /S01/ }).click();

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Mýty o hypotékách');
  await expect(page.getByRole('link', { name: /Díl 1/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Díl 2/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Uzavřít sérii' })).toBeDisabled();
  await expect(page.getByText(/Publikováno 0 z 3\./)).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
