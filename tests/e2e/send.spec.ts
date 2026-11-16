import { expect, test } from '@playwright/test';

const body = (title: string) => `${title}

HOOK A: Tohle ti banka neřekne.

SCÉNA 1 (0–2 s)
Radek (do kamery): Víš, kolik ti banka sebrala?

SCÉNA 2 (2–12 s)
Honza: Spočítal jsem to a vyšlo mi to hůř.

Popisek: Test.
#test`;

test('admin pastes two scripts, sends them right away and Radek sees both', async ({ page, browser }) => {
  const a = `Odeslání A ${Date.now()}`;
  const b = `Odeslání B ${Date.now()}`;
  await page.goto('/dev-login');
  await page.getByRole('button', { name: /Admin/ }).click();
  await page.waitForURL('**/');
  await page.goto('/scenare/novy');
  await page.getByLabel(/Vlož celý text scénáře/).fill(`${body(a)}\n\n---\n\n${body(b)}`);
  await page.getByRole('button', { name: 'Rozdělit scénář' }).click();
  await expect(page.getByRole('heading', { name: /Zkontroluj scénáře \(2\)/ })).toBeVisible();
  for (const summary of await page.locator('details > summary').all()) await summary.click();
  const selects = page.getByLabel('Kategorie');
  for (let i = 0; i < 2; i++) await selects.nth(i).selectOption({ index: 1 });
  await page.getByLabel(/Cyklus natáčení/).selectOption({ index: 1 });
  await page.getByLabel('Rovnou odeslat ke kontrole').check();
  await page.getByRole('button', { name: /Uložit všechny/ }).click();

  await expect(page.getByText('Odesláno ke kontrole: 2')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dej vědět Honzovi a Radkovi' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', /wa\.me.*%2Fkontrola/);

  const ctx = await browser.newContext();
  const radek = await ctx.newPage();
  await radek.goto('/dev-login');
  await radek.getByRole('button', { name: /Radek/ }).click();
  await radek.waitForURL('**/');
  await radek.goto('/kontrola');
  await expect(radek.getByText(a).first()).toBeAttached();
  await expect(radek.getByText(b).first()).toBeAttached();
  await ctx.close();
});
