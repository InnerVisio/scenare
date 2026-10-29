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

const toast = (page: Page) => page.getByRole('status').filter({ hasText: /Odesláno|Scénář/ });
/** „Uloženo 21:40“: only shown once something was actually saved. */
const saved = (page: Page) => page.getByText(/^Uloženo \d{1,2}:\d{2}$/).filter({ visible: true });

test.describe('script list', () => {
  test('shows every script, filters by status and search, and fits the screen', async ({ page }, info) => {
    await loginAs(page, 'Honza');
    await page.goto('/scenare');
    await expect(page.getByRole('heading', { level: 1, name: 'Scénáře' })).toBeVisible();
    const rows = page.locator(info.project.name === 'mobile' ? 'li[data-code]' : 'tr[data-code]');
    await expect(rows.first()).toBeVisible();
    await expect(rows.filter({ hasText: 'Klient s chybou: fixace hypotéky' })).toHaveCount(1);
    // Leaders do not write scripts.
    await expect(page.getByRole('button', { name: 'Nový scénář' })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: `test-results/list-${info.project.name}.png`, fullPage: true });

    await page.goto('/scenare?stav=draft');
    await expect(rows.filter({ hasText: 'Radek vs. Honza: kdo dřív' })).toHaveCount(1);
    await expect(rows.filter({ hasText: 'Pět Radků' })).toHaveCount(0);

    await page.goto('/scenare');
    await page.getByRole('searchbox', { name: 'Hledat scénář' }).fill('fixace');
    await expect(page).toHaveURL(/q=fixace/);
    await expect(rows.filter({ hasText: 'V031' })).toHaveCount(1);
    await expect(rows.filter({ hasText: 'V028' })).toHaveCount(0);

    await page.goto('/scenare?q=nic+takového+neexistuje');
    await expect(page.getByText('Žádný scénář neodpovídá filtrům.')).toBeVisible();
  });
});

test.describe('script detail', () => {
  test('leadership gets the review shortcut, version comparison and history, but no editing', async ({ page }, info) => {
    await loginAs(page, 'Honza');
    await page.goto('/scenare/V031');
    await expect(page.getByRole('heading', { level: 1, name: 'Klient s chybou: fixace hypotéky' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Otevřít v kontrole' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Upravit' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Historie' })).toContainText('Radek vrátil V031 v1 k dopracování');
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: `test-results/detail-${info.project.name}.png`, fullPage: true });

    await page.getByRole('tab', { name: 'Porovnat verze' }).click();
    await expect(page.getByLabel('Porovnat verzi')).toHaveValue('1');
    await expect(page.locator('ins', { hasText: 'Ze zákona.' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('a script outside the review cannot be opened in the editor by a leader', async ({ page }) => {
    await loginAs(page, 'Radek');
    await page.goto('/scenare/V036/upravit');
    await expect(page).toHaveURL(/\/scenare\/V036$/);
    await page.goto('/scenare/V999');
    await expect(page.getByText('Scénář jsme nenašli.')).toBeVisible();
  });
});

test.describe('script editor', () => {
  test('Admin writes a script, it autosaves and survives a reload, then goes to review', async ({ page }, info) => {
    const project = info.project.name;
    const title = `Editor ${project} ${Date.now()}`;
    await loginAs(page, 'Admin');

    await page.goto('/scenare');
    await page.getByRole('button', { name: 'Nový scénář' }).filter({ visible: true }).click();
    await page.waitForURL(/\/scenare\/V\d+\/upravit$/);
    const code = /\/scenare\/(V\d+)\/upravit/.exec(page.url())![1];
    await expect(page.getByLabel('Název', { exact: true })).toHaveValue('Nový scénář');
    await expectNoHorizontalScroll(page);

    await page.getByLabel('Název', { exact: true }).fill(title);
    if (project === 'mobile') await page.getByRole('button', { name: 'Detaily videa' }).click();
    await page.getByLabel('Kategorie').selectOption('trendy');
    await page.getByLabel('Cíl videa').selectOption('shares');

    await page.getByLabel('Co se divák dozví').fill('Fixace jde ukončit bez poplatku.');
    await page.getByLabel('Zdroj', { exact: true }).fill('Zákon č. 257/2016 Sb.');

    await page.getByRole('group', { name: 'Hook A' }).getByLabel('Text hooku').fill('Tak. Podepíšu a mám klid.');
    await page.getByRole('group', { name: 'Hook B' }).getByLabel('Text hooku').fill('Kolik platíš za fixaci?');

    const scene = (n: number) => page.getByRole('region', { name: `Scéna ${n}` });
    const times: [number, string, string, string][] = [
      [1, '0', '2', 'Radek'],
      [2, '2', '12', 'Klient'],
      [3, '12', '20', 'Honza'],
    ];
    for (const [n, from, to, speaker] of times) {
      await scene(n).getByLabel('Od (s)').fill(from);
      await scene(n).getByLabel('Do (s)').fill(to);
      await scene(n).getByLabel('Mluví').first().fill(speaker);
      await scene(n).getByLabel('Text repliky').first().fill(`Replika ${n} od ${speaker}.`);
    }
    await scene(3).getByRole('button', { name: 'Výzva' }).click();
    await expect(scene(3).getByLabel('Typ výzvy')).toHaveValue('share');

    const hashtags = page.getByRole('textbox', { name: 'Hashtagy' });
    await hashtags.fill('Hypotéka');
    await hashtags.press('Enter');
    await expect(page.getByText('#hypotéka', { exact: true })).toBeVisible();

    await expect(saved(page)).toBeVisible({ timeout: 15_000 });
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: `test-results/editor-${project}.png`, fullPage: true });

    // Everything is on the server: a fresh load shows the same values.
    await page.reload();
    await expect(page.getByLabel('Název', { exact: true })).toHaveValue(title);
    await expect(page.getByLabel('Kategorie')).toHaveValue('trendy');
    await expect(page.getByRole('group', { name: 'Hook B' }).getByLabel('Text hooku')).toHaveValue('Kolik platíš za fixaci?');
    await expect(scene(2).getByLabel('Do (s)')).toHaveValue('12');
    await expect(scene(3).getByLabel('Text repliky').first()).toHaveValue('Replika 3 od Honza.');
    await expect(scene(3).getByRole('button', { name: 'Výzva' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('#hypotéka', { exact: true })).toBeVisible();
    await expect(page.getByText('#vaskonzultant', { exact: true })).toBeVisible();

    // Live checks: the length is 20 s.
    if (project === 'mobile') await page.getByRole('button', { name: /Kontrolní seznam/ }).click();
    const length = page.getByRole('listitem').filter({ hasText: /^Délka 12–25 s/ });
    await expect(length).toContainText('20 s');
    await page.screenshot({ path: `test-results/editor-checks-${project}.png` });
    if (project === 'mobile') await page.keyboard.press('Escape');

    // Submit with a note.
    await page.getByRole('button', { name: 'Odeslat ke kontrole' }).filter({ visible: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Odeslat ke kontrole' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/Co jsem změnil/).fill('První verze');
    await page.screenshot({ path: `test-results/editor-submit-${project}.png` });
    await dialog.getByRole('button', { name: 'Odeslat ke kontrole' }).click();

    await page.waitForURL(new RegExp(`/scenare/${code}$`));
    await expect(toast(page)).toContainText('Odesláno ke kontrole (v1)');
    await expect(page.getByText('K připomínkám').first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Verze' })).toContainText('v1');
    await expect(page.getByRole('region', { name: 'Verze' })).toContainText('První verze');
    // In review the author waits: no editing.
    await expect(page.getByRole('link', { name: 'Upravit' })).toHaveCount(0);

    await loginAs(page, 'Honza');
    await page.goto(`/scenare/${code}`);
    await expect(page.getByRole('link', { name: 'Otevřít v kontrole' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Upravit' })).toHaveCount(0);
  });
});
