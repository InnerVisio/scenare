import { expect, test, type Page } from '@playwright/test';

async function loginAs(page: Page, name: 'Honza' | 'Radek' | 'Admin') {
  await page.goto('/dev-login');
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.waitForURL('**/');
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('references (ukázky)', () => {
  test('Admin adds a sample to scene 2 in the editor, Radek sees it in the review and opens it in a new tab', async ({ page }, info) => {
    const note = `Ukázka ${info.project.name} ${Date.now()}`;
    const url = 'https://www.instagram.com/reel/Cabc123/';

    await loginAs(page, 'Admin');
    await page.goto('/scenare/V036/upravit');
    const samples = page.getByRole('region', { name: 'Ukázky' });
    await page.getByRole('region', { name: 'Scéna 2' }).getByRole('button', { name: /ukázka/ }).click();
    await expect(samples.getByLabel('Ke které části')).toHaveValue(/.+/);

    await samples.getByLabel('Odkaz na ukázku').fill('neni-odkaz');
    await samples.getByLabel('Poznámka (co si z ní vzít)').fill(note);
    await samples.getByRole('button', { name: 'Přidat ukázku' }).click();
    await expect(samples.getByRole('alert')).toHaveText('Vlož odkaz začínající https://');

    await samples.getByLabel('Odkaz na ukázku').fill(url);
    await samples.getByRole('button', { name: 'Přidat ukázku' }).click();
    const card = samples.getByRole('link', { name: new RegExp(note) });
    await expect(card).toBeVisible();
    await expect(card).toContainText('Scéna 2');
    await expect(card).toContainText('Instagram');
    await expectNoHorizontalScroll(page);

    await page.context().clearCookies();
    await loginAs(page, 'Radek');

    // Seeded sample on V031.
    await page.goto('/kontrola/V031');
    const seeded = page.getByRole('region', { name: 'Ukázky' }).getByRole('link', { name: /Takhle rychlý střih na začátku/ });
    await expect(seeded).toHaveAttribute('target', '_blank');
    await expect(seeded).toHaveAttribute('rel', /noopener/);
    await expect(seeded).toContainText('TikTok');
    expect((await seeded.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    await expectNoHorizontalScroll(page);

    // The sample Admin just added, with the link in the header of scene 2.
    await page.goto('/kontrola/V036');
    const added = page.getByRole('region', { name: 'Ukázky' }).getByRole('link', { name: new RegExp(note) });
    await expect(added).toHaveAttribute('target', '_blank');
    await expect(added).toHaveAttribute('href', url);
    await expect(page.getByRole('link', { name: '▶ ukázka' })).toHaveAttribute('target', '_blank');
    // Radek did not add it, so he cannot remove it.
    await expect(page.getByRole('button', { name: /Odebrat ukázku/ })).toHaveCount(0);
    await expectNoHorizontalScroll(page);

    // Clean up so the next project run starts from the same state.
    await page.context().clearCookies();
    await loginAs(page, 'Admin');
    await page.goto('/scenare/V036/upravit');
    const mine = page.getByRole('region', { name: 'Ukázky' }).locator('li', { hasText: note });
    await mine.getByRole('button', { name: /Odebrat ukázku/ }).click();
    await expect(mine).toHaveCount(0);
  });
});
