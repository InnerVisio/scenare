import { expect, test } from '@playwright/test';

// Relies on review-flow.spec.ts, which leaves the script "E2E test <project>" approved in cycle 2026-11 (spoken lines included).
test('admin sees the countdown and the approved scripts, marks one as shot and shares a crew link', async ({ page, browser, baseURL }, info) => {
  const title = `E2E test ${info.project.name}`;
  await page.goto('/dev-login');
  await page.getByRole('button', { name: /Admin/ }).click();
  await page.waitForURL('**/');

  await page.goto('/nataceni?cyklus=2026-11');
  await expect(page.getByRole('heading', { level: 1, name: 'Natáčecí den' })).toBeVisible();
  await expect(page.getByText('Dní do natáčení')).toBeVisible();
  await expect(page.getByText('Dní do termínu schválení')).toBeVisible();
  await expect(page.getByTestId('countdown')).toHaveCount(2);
  const item = page.getByRole('listitem').filter({ hasText: title });
  await expect(item).toBeVisible();
  await expect(page.getByRole('region').first()).toBeVisible(); // at least one location group

  await item.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Natočeno', exact: true }).click();
  await expect(page.getByText(/Označeno: Natočeno/)).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: title })).toContainText('Natočeno');

  await page.getByRole('button', { name: 'Sdílet se štábem' }).click();
  const url = await page.getByLabel('Odkaz pro štáb').inputValue();
  expect(url).toContain('/stab/');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // A fresh, logged-out context: spoken lines and hooks, no comments.
  const crew = await browser.newContext({ baseURL, viewport: page.viewportSize() ?? undefined });
  const crewPage = await crew.newPage();
  await crewPage.goto(new URL(url).pathname);
  await expect(crewPage).toHaveURL(/\/stab\//);
  await expect(crewPage.getByRole('heading', { level: 1, name: 'Natáčecí den' })).toBeVisible();
  await expect(crewPage.getByText(title).first()).toBeVisible();
  await expect(crewPage.getByRole('list', { name: 'Mluvený text' }).first()).toBeVisible();
  await expect(crewPage.getByText(/Komentář e2e/)).toHaveCount(0);
  await expect(crewPage.getByRole('button', { name: 'Tisk / uložit PDF' })).toBeVisible();
  const crewOverflow = await crewPage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(crewOverflow).toBeLessThanOrEqual(0);

  await crewPage.goto('/stab/neplatny');
  await expect(crewPage.getByText('Odkaz už není platný')).toBeVisible();
  await crew.close();
});
