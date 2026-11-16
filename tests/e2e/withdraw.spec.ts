import { expect, test, type Page } from '@playwright/test';

async function loginAs(page: Page, name: 'Radek' | 'Admin') {
  await page.goto('/dev-login');
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.waitForURL('**/');
}

test('admin edits a script in review, sends a new version and then withdraws it', async ({ page }, info) => {
  test.setTimeout(180_000);
  const title = `Stažení e2e ${info.project.name}`;
  await loginAs(page, 'Admin');
  await page.goto('/scenare/novy');
  await page.getByRole('button', { name: 'Vyplnit ručně' }).click();
  await page.waitForURL(/\/scenare\/V\d+\/upravit$/);
  const code = /\/scenare\/(V\d+)\/upravit/.exec(page.url())![1];
  await page.getByLabel('Název', { exact: true }).fill(title);
  await page.getByLabel('Kategorie').selectOption('trendy');
  await page.getByRole('region', { name: 'Údaje o videu' }).getByLabel('Natáčecí den').selectOption('2026-11');
  const scene = (n: number) => page.getByRole('region', { name: `Scéna ${n}` });
  for (const n of [1, 2]) {
    await scene(n).getByLabel('Co se děje').fill(`Co se děje ve scéně ${n}.`);
    await scene(n).getByLabel('Mluví').first().fill(n === 1 ? 'Radek' : 'Klient');
    await scene(n).getByLabel('Text repliky').first().fill(`Replika ${n}.`);
  }
  await expect(page.getByText(/^Uloženo \d{1,2}:\d{2}$/).filter({ visible: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Odeslat ke kontrole' }).filter({ visible: true }).click();
  await page.getByRole('dialog', { name: 'Odeslat ke kontrole' }).getByRole('button', { name: 'Odeslat ke kontrole' }).click();
  await page.waitForURL(new RegExp(`/scenare/${code}$`));

  // Edit while in review.
  await page.getByRole('link', { name: 'Upravit (scénář je v kontrole)' }).click();
  await page.waitForURL(/\/upravit$/);
  await expect(page.getByText('Scénář je právě v kontrole.')).toBeVisible();
  await scene(1).getByLabel('Text repliky').first().fill('Změněná replika.');
  await expect(page.getByText(/^Uloženo \d{1,2}:\d{2}$/).filter({ visible: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Odeslat novou verzi' }).filter({ visible: true }).click();
  await page.getByRole('dialog', { name: 'Odeslat ke kontrole' }).getByRole('button', { name: 'Odeslat ke kontrole' }).click();
  await page.waitForURL(new RegExp(`/scenare/${code}$`));
  await expect(page.getByText('v2').first()).toBeVisible();

  // Withdraw.
  await page.getByRole('button', { name: 'Další akce' }).click();
  await page.getByRole('menuitem', { name: 'Stáhnout z kontroly' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Stáhnout z kontroly' }).click();
  await expect(page.getByText('Rozpracováno').first()).toBeVisible();

  await loginAs(page, 'Radek');
  await page.goto('/kontrola');
  await expect(page.getByText(title)).toHaveCount(0);
});
