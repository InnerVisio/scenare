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
  await expect(toolbar(page)).toBeVisible();
}

const toast = (page: Page) => page.locator('[role=status][aria-live=polite]');
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Akce s označeným textem' });

test('Admin → Radek → Admin → Honza → Radek: a script goes from draft to approved', async ({ page }, info) => {
  test.setTimeout(240_000);
  const project = info.project.name;
  const mobile = project === 'mobile';
  const title = `E2E test ${project}`;
  const comment = `Komentář e2e ${project}`;
  const replacement = 'kdykoli a bez sankce';

  // 1. Admin writes the script in the editor and sends it to review.
  await loginAs(page, 'Admin');
  await page.goto('/scenare');
  await page.getByRole('button', { name: 'Nový scénář' }).filter({ visible: true }).click();
  await page.waitForURL(/\/scenare\/V\d+\/upravit$/);
  const code = /\/scenare\/(V\d+)\/upravit/.exec(page.url())![1];
  await expectNoHorizontalScroll(page);

  await page.getByLabel('Název', { exact: true }).fill(title);
  if (mobile) await page.getByRole('button', { name: 'Detaily videa' }).click();
  await page.getByLabel('Kategorie').selectOption('trendy');
  await page.getByLabel('Cíl videa').selectOption('shares');
  await page.getByLabel('Co se divák dozví').fill('Fixace jde ukončit bez poplatku.');
  await page.getByLabel('Zdroj', { exact: true }).fill('Zákon č. 257/2016 Sb.');
  await page.getByRole('group', { name: 'Hook A' }).getByLabel('Text hooku').fill('Tak. Podepíšu a mám klid.');
  await page.getByRole('group', { name: 'Hook B' }).getByLabel('Text hooku').fill('Kolik platíš za fixaci?');

  const scene = (n: number) => page.getByRole('region', { name: `Scéna ${n}` });
  const scenes: [number, string, string, string, string][] = [
    [1, '0', '2', 'Radek', 'Podepsal jsem fixaci.'],
    [2, '2', '12', 'Klient', 'Fixaci jde ukončit bez poplatku kdykoliv chceš.'],
    [3, '12', '20', 'Honza', 'Pošli to dál, ať to ví i ostatní.'],
  ];
  for (const [n, from, to, speaker, text] of scenes) {
    await scene(n).getByLabel('Od (s)').fill(from);
    await scene(n).getByLabel('Do (s)').fill(to);
    await scene(n).getByLabel('Mluví').first().fill(speaker);
    await scene(n).getByLabel('Text repliky').first().fill(text);
  }
  await scene(3).getByRole('button', { name: 'Výzva' }).click();
  await expect(scene(3).getByLabel('Typ výzvy')).toHaveValue('share');
  const hashtags = page.getByRole('textbox', { name: 'Hashtagy' });
  await hashtags.fill('Hypotéka');
  await hashtags.press('Enter');
  await expect(page.getByText('#hypotéka', { exact: true })).toBeVisible();
  await expect(page.getByText(/^Uloženo \d{1,2}:\d{2}$/).filter({ visible: true })).toBeVisible({ timeout: 15_000 });
  await expectNoHorizontalScroll(page);

  const submit = async (summary: string) => {
    await page.getByRole('button', { name: 'Odeslat ke kontrole' }).filter({ visible: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Odeslat ke kontrole' });
    await expect(dialog).toBeVisible();
    if (summary) await dialog.getByLabel(/Co jsem změnil/).fill(summary);
    await dialog.getByRole('button', { name: 'Odeslat ke kontrole' }).click();
    await page.waitForURL(new RegExp(`/scenare/${code}$`));
  };
  await submit('První verze');
  await expect(page.getByText('K připomínkám').first()).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Honza reads v1 now, so that later he is shown what changed since then.
  await loginAs(page, 'Honza');
  await page.goto(`/kontrola/${code}`);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expectNoHorizontalScroll(page);

  // 2. Radek comments, suggests a change and returns the script.
  await loginAs(page, 'Radek');
  await page.goto('/kontrola');
  await expectNoHorizontalScroll(page);
  await page.goto(`/kontrola/${code}`);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expectNoHorizontalScroll(page);
  const fieldId = (await page.locator('[data-field-id^="line:"][data-field-id$=":text"]').nth(1).getAttribute('data-field-id'))!;

  await selectPhrase(page, fieldId, 'poplatku');
  await toolbar(page).getByRole('button', { name: 'Komentovat' }).click();
  await page.getByRole('textbox', { name: 'Komentář', exact: true }).fill(comment);
  await page.getByRole('button', { name: 'Odeslat', exact: true }).click();
  await expect(toast(page)).toContainText('Komentář přidán');

  await selectPhrase(page, fieldId, 'kdykoliv');
  await toolbar(page).getByRole('button', { name: 'Navrhnout' }).click();
  await page.getByRole('textbox', { name: 'Nový text' }).fill(replacement);
  await page.getByRole('button', { name: 'Odeslat', exact: true }).click();
  await expect(toast(page)).toContainText('Návrh změny odeslán');
  await expectNoHorizontalScroll(page);

  await page.getByRole('button', { name: 'Vrátit' }).click();
  const returnDialog = page.getByRole('dialog', { name: 'Vrátit k dopracování' });
  await returnDialog.getByRole('textbox', { name: 'Co je potřeba upravit?' }).fill('Zpřesnit a použít moje znění.');
  await returnDialog.getByRole('button', { name: 'Vrátit k dopracování' }).click();
  await expect(toast(page)).toContainText('Vráceno k dopracování');

  // 3. Admin accepts the suggestion, answers the comment, marks it addressed and resubmits.
  await loginAs(page, 'Admin');
  await page.goto(`/scenare/${code}`);
  await expect(page.getByText('K dopracování').first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.goto(`/scenare/${code}/upravit`);
  await expect(page.getByLabel('Název', { exact: true })).toHaveValue(title);
  await expectNoHorizontalScroll(page);
  if (mobile) await page.getByRole('button', { name: /^Komentáře, / }).click();
  else await page.getByRole('tab', { name: /^Komentáře/ }).click();

  const suggestionCard = page.locator('article[data-comment-id]', { hasText: replacement }).filter({ visible: true });
  await suggestionCard.getByRole('button', { name: 'Přijmout' }).click();
  await expect(toast(page)).toContainText('Návrh přijat');

  const card = page.locator('article[data-comment-id]', { hasText: comment }).filter({ visible: true });
  await card.getByRole('button', { name: 'Odpovědět' }).click();
  await card.getByRole('textbox', { name: 'Odpověď' }).fill('Doplněno.');
  await card.getByRole('button', { name: 'Odeslat odpověď' }).click();
  await expect(card).toContainText('Doplněno.');
  await card.getByRole('button', { name: 'Zapracováno' }).click();
  await expect(card.getByRole('button', { name: 'Zapracováno' })).toHaveCount(0);
  if (mobile) await page.keyboard.press('Escape');

  await submit('Zapracoval jsem připomínky Radka.');
  await expect(page.getByText('K finálnímu schválení').first()).toBeVisible();

  // 4. Honza lands on the diff against v1 and approves.
  await loginAs(page, 'Honza');
  await page.goto(`/kontrola/${code}`);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Změny od v1' }).filter({ visible: true })).toHaveAttribute('aria-selected', 'true');
  // The diff splits the replacement into word-level insertions („kdykoli“ + „a bez sankce“).
  await expect(page.locator('ins', { hasText: 'a bez sankce' })).toBeVisible();
  await expect(page.locator('del', { hasText: 'kdykoliv' })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Schválit' }).click();
  await expect(toast(page)).toContainText('čeká na Radka');

  // 5. Radek gives the second approval (asking first if something is still open).
  await loginAs(page, 'Radek');
  await page.goto(`/kontrola/${code}`);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Schválit' }).click();
  const confirm = page.getByRole('dialog', { name: 'Schválit i tak?' });
  if (await confirm.waitFor({ timeout: 2_000 }).then(() => true, () => false)) {
    await confirm.getByRole('button', { name: 'Schválit i tak' }).click();
  }
  await expect(toast(page)).toContainText('Schváleno');

  // 6. The detail shows the result and the whole history, oldest first when read bottom-up.
  await page.goto(`/scenare/${code}`);
  await expect(page.getByText('Schváleno', { exact: true }).first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  const history = (await page.getByRole('region', { name: 'Historie' }).getByRole('listitem').allInnerTexts()).reverse().join('\n');
  const expected = [
    /odeslal V\d+ v1 ke kontrole/,
    /Radek okomentoval/,
    /Radek navrhl změnu/,
    /Radek vrátil V\d+ v1/,
    /přijal návrh/,
    /odeslal V\d+ v2 ke kontrole/,
    /Honza schválil/,
    /Radek schválil/,
  ];
  let from = 0;
  for (const pattern of expected) {
    const rest = history.slice(from);
    const match = pattern.exec(rest);
    expect(match, `history should contain ${pattern} after position ${from}:\n${history}`).not.toBeNull();
    from += match!.index + match![0].length;
  }
});
