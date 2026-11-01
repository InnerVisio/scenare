import { expect, test } from '@playwright/test';

// Uses the approved demo script V020 (Nábor začíná u šéfa); the second project run adds a second publication, which is fine.
test('admin adds a publication with 7-day metrics and finds it on /publikace', async ({ page }, info) => {
  const url = `https://www.tiktok.com/@gta/video/e2e-${info.project.name}`;
  await page.goto('/dev-login');
  await page.getByRole('button', { name: /Admin/ }).click();
  await page.waitForURL('**/');

  await page.goto('/scenare/V020');
  const block = page.getByRole('region', { name: 'Publikace' });
  await block.getByRole('button', { name: 'Přidat publikaci' }).click();
  await block.getByLabel('Odkaz na publikaci').fill(url);
  await block.getByLabel('Dosah').last().fill('1000');
  await block.getByLabel('Sdílení').last().fill('50');
  await block.getByRole('button', { name: 'Přidat publikaci' }).click();
  await expect(block.getByRole('link', { name: url })).toBeVisible();
  await expect(block.getByText('Sdílení/dosah 5 %').first()).toBeVisible();
  await expect(page.getByText('Výroba: Publikováno').or(page.getByLabel('Stav výroby'))).toBeVisible();

  await page.goto('/publikace?mesic=2026-11');
  await expect(page.getByRole('heading', { level: 1, name: 'Publikace' })).toBeVisible();
  const row = page.getByRole('listitem').filter({ hasText: 'V020' }).filter({ has: page.getByRole('link', { name: /Odkaz/ }) }).first();
  await expect(row).toContainText('Nábor začíná u šéfa');
  await expect(row).toContainText('5 %');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
