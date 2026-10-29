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

/** Selects `phrase` inside one script field, the way a user drags over a line of dialog. */
async function selectPhrase(page: Page, fieldId: string, phrase: string) {
  await page.locator(`[data-field-id="${fieldId}"]`).scrollIntoViewIfNeeded();
  await page.evaluate(
    ([id, text]) => {
      const field = document.querySelector(`[data-field-id="${id}"]`)!;
      field.scrollIntoView({ block: 'center' });
      const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const at = (node as Text).data.indexOf(text);
        if (at === -1) continue;
        const range = document.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + text.length);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      throw new Error(`"${text}" not found in ${id}`);
    },
    [fieldId, phrase],
  );
  await expect(page.getByRole('toolbar', { name: 'Akce s označeným textem' })).toBeVisible();
}

/** On phones the comments live in a bottom sheet that starts collapsed. */
async function openComments(page: Page) {
  const handle = page.getByRole('button', { name: 'Rozbalit komentáře' });
  if (await handle.isVisible()) await handle.click();
  await expect(page.getByRole('tab', { name: /Komentáře/ })).toBeVisible();
}

const toast = (page: Page) => page.getByRole('status');
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Akce s označeným textem' });
const script = (page: Page) => page.getByRole('region', { name: 'Scénář' });

// The e2e database is shared by both projects and is not reset between them, so every flow that
// removes a script from the queue uses its own script per project.
const PLAN = {
  mobile: { comment: { field: 'line:v033-s1-l1:text', phrase: 'Volná pracovní doba' }, suggest: { field: 'line:v033-s3-l1:text', phrase: 'Souhlasíš?' }, number: 'kolik hodin', returnCode: 'V032', approveCode: 'V026', confirmUser: 'Honza' as const },
  desktop: { comment: { field: 'line:v033-s2-l1:text', phrase: 'kdy rozhoduješ ty' }, suggest: { field: 'line:v033-s2-l1:text', phrase: 'Jde o to' }, number: 'pracuješ ty', returnCode: 'V033', approveCode: 'V028', confirmUser: 'Radek' as const },
};
const planOf = (project: string) => (project === 'mobile' ? PLAN.mobile : PLAN.desktop);
const unique = (project: string) => `${project} ${Date.now()}`;

test.describe('review queue', () => {
  test('/kontrola lands on the first script and the screen fits the viewport', async ({ page }, info) => {
    const project = info.project.name;
    await loginAs(page, 'Radek');
    await page.goto('/kontrola');
    await expect(page).toHaveURL(/\/kontrola\/V0\d\d/);

    await page.goto('/kontrola/V031');
    await expect(page.getByRole('heading', { level: 1, name: 'Klient s chybou: fixace hypotéky' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /aktuální/ })).toHaveAttribute('aria-selected', 'true');
    await expectNoHorizontalScroll(page);

    if (project === 'mobile') {
      await expect(page.getByText('Ke kontrole', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Vrátit' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Schválit' })).toBeVisible();
      await page.screenshot({ path: 'test-results/review-item-mobile.png' });
      // The whole header row (not just the little handle) opens the sheet.
      await page.locator('aside h2', { hasText: 'Komentáře · 3' }).click();
      await expect(page.getByRole('tab', { name: /Komentáře · 3/ })).toBeVisible();
      await expect(page.getByText('Radek nemusí křičet')).toBeVisible();
      await expectNoHorizontalScroll(page);
      // Wait for the height transition before taking the picture.
      const sheet = page.getByRole('complementary', { name: 'Komentáře a kontrola' });
      await expect.poll(async () => (await sheet.boundingBox())?.height).toBeGreaterThan(600);
      await page.screenshot({ path: 'test-results/review-sheet-mobile.png' });
    } else {
      await expect(page.getByRole('navigation', { name: 'Fronta ke kontrole' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Vrátit k dopracování' })).toBeVisible();
      await expect(page.getByRole('tab', { name: /Komentáře · 3/ })).toBeVisible();
      await page.screenshot({ path: 'test-results/review-desktop.png' });
      await page.screenshot({ path: 'test-results/review-desktop-full.png', fullPage: true });

      // Keyboard: J moves to the next script, R opens the return dialog, Escape closes it.
      await page.keyboard.press('j');
      await expect(page).not.toHaveURL(/V031/);
      await page.keyboard.press('r');
      await expect(page.getByRole('dialog', { name: 'Vrátit k dopracování' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
  });

  test('phone: tapping the empty peek opens the composer', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'the bottom sheet exists on phones only');
    await loginAs(page, 'Radek');
    // V028 never receives comments in these tests.
    await page.goto('/kontrola/V028');
    await expect(page.getByRole('heading', { level: 1, name: 'Den za 15 sekund' })).toBeVisible();
    await page.getByTestId('comment-peek').getByRole('button', { name: /Zatím žádné komentáře/ }).click();
    const box = page.getByRole('textbox', { name: 'Komentář', exact: true });
    await expect(box).toBeVisible();
    await expect(box).toBeFocused();
    await expectNoHorizontalScroll(page);
  });

  test('versions tab compares an older version with the current one', async ({ page }) => {
    await loginAs(page, 'Radek');
    await page.goto('/kontrola/V031');
    await expect(page.getByRole('heading', { level: 1, name: 'Klient s chybou: fixace hypotéky' })).toBeVisible();

    await openComments(page);
    await page.getByRole('tab', { name: 'Verze' }).click();
    const older = page.getByRole('listitem').filter({ hasText: 'První odeslání' });
    await expect(older).toContainText('Radek vrátil');
    await older.getByRole('button', { name: 'Porovnat s aktuální' }).click();

    await expect(page.getByRole('tab', { name: 'Změny od v1' }).filter({ visible: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('ins', { hasText: 'Ze zákona.' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('select text → comment appears with the next number', async ({ page }, info) => {
    const project = info.project.name;
    const { comment } = planOf(project);
    await loginAs(page, 'Radek');
    await page.goto('/kontrola/V033');
    await expect(page.getByRole('heading', { level: 1, name: /Hot take/ })).toBeVisible();
    const before = await page.locator('article[data-comment-id]').count();

    await selectPhrase(page, comment.field, comment.phrase);
    await toolbar(page).getByRole('button', { name: 'Komentovat' }).click();
    await expect(page.getByText(`K textu „${comment.phrase}“`)).toBeVisible();
    const text = `Komentář ${unique(project)}`;
    await page.getByRole('textbox', { name: 'Komentář', exact: true }).fill(text);
    await page.getByRole('button', { name: 'Odeslat', exact: true }).click();

    await expect(toast(page)).toContainText('Komentář přidán');
    await expect(page.locator(`article[aria-label="Komentář ${before + 1}"]`)).toHaveCount(1);
    await expect(page.getByText(text).filter({ visible: true }).first()).toBeVisible();
    await expect(script(page).getByRole('button', { name: `Komentář ${before + 1}` })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('select text → suggest a change → struck old text and lime replacement', async ({ page }, info) => {
    const project = info.project.name;
    const { suggest } = planOf(project);
    await loginAs(page, 'Radek');
    await page.goto('/kontrola/V033');
    await expect(page.getByRole('heading', { level: 1, name: /Hot take/ })).toBeVisible();

    await selectPhrase(page, suggest.field, suggest.phrase);
    await toolbar(page).getByRole('button', { name: 'Navrhnout' }).click();
    const replacementField = page.getByRole('textbox', { name: 'Nový text' });
    await expect(replacementField).toHaveValue(suggest.phrase);
    const replacement = `Návrh ${unique(project)}`;
    await replacementField.fill(replacement);
    await page.getByRole('button', { name: 'Odeslat', exact: true }).click();

    await expect(toast(page)).toContainText('Návrh změny odeslán');
    await expect(page.locator(`[data-field-id="${suggest.field}"] .line-through`, { hasText: suggest.phrase })).toBeVisible();
    // The replacement follows the struck text inside the field (split in two spans so the badge can stay with the last word).
    await expect(page.locator(`[data-field-id="${suggest.field}"]`)).toContainText(replacement);
    await expectNoHorizontalScroll(page);
  });

  test('flag a number and confirm it in the Kontrola tab', async ({ page }, info) => {
    const project = info.project.name;
    const phrase = planOf(project).number;
    await loginAs(page, 'Radek');
    await page.goto('/kontrola/V033');
    await expect(page.getByRole('heading', { level: 1, name: /Hot take/ })).toBeVisible();

    await selectPhrase(page, 'line:v033-s3-l1:text', phrase);
    await toolbar(page).getByRole('button', { name: 'Číslo' }).click();
    await expect(toast(page)).toContainText('Číslo označeno ke kontrole');

    await openComments(page);
    await page.getByRole('tab', { name: 'Kontrola' }).click();
    const item = page.getByRole('listitem').filter({ hasText: `„${phrase}“` });
    await expect(item).toContainText('Čeká');
    await item.getByRole('button', { name: 'Potvrdit' }).click();
    await expect(item).toContainText('Potvrzeno');
  });

  test('admin accepts the suggestion and the script text changes', async ({ page }, info) => {
    const project = info.project.name;
    await loginAs(page, 'Admin');
    await page.goto('/kontrola/V033');
    await expect(page.getByRole('heading', { level: 1, name: /Hot take/ })).toBeVisible();
    // Admin can comment but never decide.
    await expect(page.getByRole('button', { name: /Schválit/ })).toHaveCount(0);

    await openComments(page);
    const card = page.locator('article[data-comment-id]', { hasText: `Návrh ${project}` }).last();
    await card.getByRole('button', { name: 'Přijmout' }).click();
    await expect(toast(page)).toContainText('Návrh přijat');
    // The accepted text goes into the author's draft; the version under review stays as it was.
    await expect(card).toContainText('Návrh přijat');
    await expect(card).toContainText('Zapracováno');
    await expect(card.getByRole('button', { name: 'Přijmout' })).toHaveCount(0);
  });

  test('return a script with a note → toast and the next script opens', async ({ page }, info) => {
    const project = info.project.name;
    const code = planOf(project).returnCode;
    await loginAs(page, 'Radek');
    await page.goto(`/kontrola/${code}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.getByRole('button', { name: 'Vrátit' }).click();
    const dialog = page.getByRole('dialog', { name: 'Vrátit k dopracování' });
    await expect(dialog).toBeVisible();
    // Without own comments on this version the note is required; with them it is optional.
    if (project === 'mobile') await expect(dialog.getByRole('button', { name: 'Vrátit k dopracování' })).toBeDisabled();
    else await expect(dialog).toContainText('Tvoje komentáře k této verzi se pošlou spolu s vrácením.');
    await page.screenshot({ path: `test-results/review-return-${project}.png` });
    await dialog.getByRole('textbox', { name: 'Co je potřeba upravit?' }).fill('Zkrátit úvod a ověřit zdroj.');
    await dialog.getByRole('button', { name: 'Vrátit k dopracování' }).click();

    await expect(toast(page)).toContainText('Vráceno k dopracování');
    await expect(page).toHaveURL(/\/kontrola\/V0\d\d/);
    await expect(page).not.toHaveURL(new RegExp(code));
  });

  test('both leaders approve a clean script; the first sees who is awaited', async ({ page }, info) => {
    const code = planOf(info.project.name).approveCode;
    await loginAs(page, 'Honza');
    await page.goto(`/kontrola/${code}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Schválit' }).click();
    await expect(toast(page)).toContainText('čeká na Radka');
    // Next script he has not approved yet, or the empty state when that was the last one.
    await page.waitForURL((url) => /^\/kontrola(\/V0\d\d)?$/.test(url.pathname) && !url.pathname.includes(code));
    if (new URL(page.url()).pathname === '/kontrola') {
      await expect(page.getByText('Všechno máš zkontrolované.')).toBeVisible();
      await page.screenshot({ path: `test-results/review-empty-${info.project.name}.png` });
    }

    // Honza has done his part: the button is disabled and says so.
    await page.goto(`/kontrola/${code}`);
    const line = page.getByText('Schválil jsi · čeká na Radka').filter({ visible: true });
    await expect(line).toBeVisible();
    if (info.project.name === 'mobile') {
      // The approval line sits above the buttons and must not overlap the peeking sheet content.
      const peek = await page.getByTestId('comment-peek').boundingBox();
      const text = await line.boundingBox();
      expect(text!.y).toBeGreaterThanOrEqual(peek!.y + peek!.height);
    }
    await page.screenshot({ path: `test-results/review-pending-${info.project.name}.png` });
    await expect(page.getByRole('button', { name: 'Schváleno' })).toBeDisabled();

    await loginAs(page, 'Radek');
    await page.goto(`/kontrola/${code}`);
    await expect(page.getByText('Schváleno 1/2 · čeká na tebe').filter({ visible: true })).toBeVisible();
    await page.getByRole('button', { name: 'Schválit' }).click();
    await expect(toast(page)).toContainText('Schváleno oběma');
  });

  test('approving over open comments asks first, „Zpět“ cancels, „Schválit i tak“ approves', async ({ page }, info) => {
    const project = info.project.name;
    await loginAs(page, planOf(project).confirmUser);
    await page.goto('/kontrola/V031');
    await expect(page.getByRole('heading', { level: 1, name: 'Klient s chybou: fixace hypotéky' })).toBeVisible();

    await page.getByRole('button', { name: 'Schválit' }).click();
    const dialog = page.getByRole('dialog', { name: 'Schválit i tak?' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('nevyřešené komentáře');
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: `test-results/review-confirm-${project}.png` });

    await dialog.getByRole('button', { name: 'Zpět' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/V031/);

    await page.getByRole('button', { name: 'Schválit' }).click();
    await page.getByRole('dialog', { name: 'Schválit i tak?' }).getByRole('button', { name: 'Schválit i tak' }).click();
    await expect(toast(page)).toContainText(/^Schváleno/);
    await expect(page).not.toHaveURL(/V031/);
  });
});
