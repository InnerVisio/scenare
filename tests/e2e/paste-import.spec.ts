import { expect, test } from '@playwright/test';

const SCRIPT = `Klient s chybou: fixace hypotéky

HOOK A: Tohle ti banka neřekne.
HOOK B – Fixace, která tě stála 200 tisíc.

SCÉNA 1 (0–2 s)
Radek (do kamery): Víš, kolik ti banka sebrala?

SCÉNA 2 (2–12 s)
Honza: Spočítal jsem to a vyšlo mi to hůř.
Klient: To snad ne!

SCÉNA 3 (12–20 s)
Radek: Pošli to kolegovi, který řeší hypotéku.

Popisek: Fixace hypotéky bez stresu.
#hypotéka #fixace`;

test('admin pastes a script, checks the split and saves it as a draft', async ({ page }) => {
  await page.goto('/dev-login');
  await page.getByRole('button', { name: /Admin/ }).click();
  await page.waitForURL('**/');
  await page.goto('/scenare');
  await page.getByRole('link', { name: 'Nový scénář' }).click();
  await page.waitForURL('**/scenare/novy**');

  await page.getByLabel(/Vlož celý text scénáře/).fill(SCRIPT);
  await page.getByRole('button', { name: 'Rozdělit scénář' }).click();
  await expect(page.getByRole('heading', { name: 'Zkontroluj scénář' })).toBeVisible();
  await expect(page.getByText('Tohle ti banka neřekne.').first()).toBeVisible();
  await expect(page.getByText('Fixace, která tě stála 200 tisíc.').first()).toBeVisible();
  await expect(page.getByText('Spočítal jsem to a vyšlo mi to hůř.').first()).toBeVisible();

  await page.getByRole('button', { name: 'Uložit a otevřít editor' }).click();
  await page.waitForURL('**/upravit');
  await expect(page.locator('textarea').filter({ hasText: 'Tohle ti banka neřekne.' }).first()).toBeVisible();
});
