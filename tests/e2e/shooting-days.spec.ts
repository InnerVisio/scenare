import { expect, test, type Page } from '@playwright/test';

async function loginAdmin(page: Page) {
  await page.goto('/dev-login');
  await page.getByRole('button', { name: /Admin/ }).click();
  await page.waitForURL('**/');
}

/** A random day far in the future, so reruns and the two projects never collide. */
function futureDay(): { iso: string; label: RegExp } {
  const d = new Date(Date.now() + (400 + Math.floor(Math.random() * 6000)) * 86_400_000);
  const iso = d.toISOString().slice(0, 10);
  const [y, m, day] = iso.split('-').map(Number);
  return { iso, label: new RegExp(`${day}\\. ${m}\\. ${y}`) };
}

async function openEditor(page: Page) {
  await page.goto('/scenare/novy');
  await page.getByRole('button', { name: 'Vyplnit ručně' }).click();
  await page.waitForURL(/\/scenare\/V\d+\/upravit$/);
  await expect(page.getByRole('combobox', { name: 'Natáčecí den' })).toBeVisible();
}

test('admin adds a shooting day in settings and picks it in the editor', async ({ page }) => {
  await loginAdmin(page);
  const day = futureDay();
  await page.goto('/nastaveni');
  await expect(page.getByRole('heading', { name: 'Natáčecí dny' })).toBeVisible();
  await page.getByRole('button', { name: 'Přidat natáčecí den' }).click();
  await page.getByLabel('Datum natáčení').fill(day.iso);
  await page.getByLabel('Poznámka (kde se točí)').fill('Studio e2e');
  await page.getByRole('button', { name: 'Přidat den', exact: true }).click();
  await expect(page.getByRole('listitem').filter({ hasText: day.label })).toContainText('Studio e2e');

  await openEditor(page);
  const select = page.getByRole('combobox', { name: 'Natáčecí den' });
  await select.selectOption({ value: day.iso });
  await expect(select).toHaveValue(day.iso);
});

test('quick add from the editor select creates and selects a new day', async ({ page }) => {
  await loginAdmin(page);
  const day = futureDay();
  await openEditor(page);
  const select = page.getByRole('combobox', { name: 'Natáčecí den' });
  await select.selectOption({ label: '+ Přidat natáčecí den…' });
  const dialog = page.getByRole('dialog', { name: 'Přidat natáčecí den' });
  await dialog.getByLabel('Datum natáčení').fill(day.iso);
  await dialog.getByRole('button', { name: 'Přidat den' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(select).toHaveValue(day.iso);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
