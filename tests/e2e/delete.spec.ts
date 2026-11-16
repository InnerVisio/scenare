import { expect, test, type Page } from '@playwright/test';

async function loginAdmin(page: Page) {
  await page.goto('/dev-login');
  await page.getByRole('button', { name: /Admin/ }).click();
  await page.waitForURL('**/');
}

async function createBlank(page: Page, title: string): Promise<string> {
  await page.goto('/scenare/novy');
  await page.getByRole('button', { name: 'Vyplnit ručně' }).click();
  await page.waitForURL(/\/scenare\/V\d+\/upravit$/);
  const code = /\/scenare\/(V\d+)\/upravit/.exec(page.url())![1];
  await page.getByLabel('Název', { exact: true }).fill(title);
  await expect(page.getByText(/^Uloženo \d{1,2}:\d{2}$/).filter({ visible: true })).toBeVisible({ timeout: 15_000 });
  return code;
}

test.use({ viewport: { width: 390, height: 844 } });

test('admin home has no horizontal scroll at 390 px', async ({ page }) => {
  await loginAdmin(page);
  const wide = await page.evaluate(() => {
    const limit = window.innerWidth;
    const offenders = [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > limit + 1)
      .slice(0, 5)
      .map((el) => `${el.tagName}.${String(el.className).slice(0, 60)} ${Math.round(el.getBoundingClientRect().right)}`);
    return { overflow: document.documentElement.scrollWidth - limit, offenders };
  });
  expect(wide, JSON.stringify(wide.offenders)).toMatchObject({ overflow: 0 });
});

test('admin opens „Další akce“, deletes a script and it leaves the list', async ({ page }) => {
  const title = `Ke smazání ${Date.now()}`;
  await loginAdmin(page);
  const code = await createBlank(page, title);
  await page.goto(`/scenare/${code}`);
  await page.getByRole('button', { name: 'Další akce' }).click();
  await expect(page.getByRole('menuitem', { name: 'Odložit' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Zrušit scénář' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Smazat scénář' }).click();
  await expect(page.getByText('Scénář, jeho verze i komentáře se smažou natrvalo.')).toBeVisible();
  await page.getByRole('button', { name: 'Smazat', exact: true }).click();
  await page.waitForURL('**/scenare');
  await expect(page.getByText(`Scénář ${code} smazán`)).toBeVisible();
  await expect(page.getByText(title)).toHaveCount(0);
});

test('admin bulk-deletes two drafts', async ({ page }) => {
  const stamp = Date.now();
  await loginAdmin(page);
  const a = await createBlank(page, `Hromadně A ${stamp}`);
  const b = await createBlank(page, `Hromadně B ${stamp}`);
  await page.goto('/scenare');
  await page.getByLabel(`Vybrat ${a}`).filter({ visible: true }).check();
  await page.getByLabel(`Vybrat ${b}`).filter({ visible: true }).check();
  await expect(page.getByRole('button', { name: 'Smazat (2)' })).toBeVisible();
  await page.getByRole('button', { name: 'Smazat (2)' }).click();
  await page.getByRole('button', { name: 'Smazat', exact: true }).click();
  await expect(page.getByText(`Hromadně A ${stamp}`)).toHaveCount(0);
  await expect(page.getByText(`Hromadně B ${stamp}`)).toHaveCount(0);
});
