import { expect, test, type Page } from '@playwright/test';

async function loginAsHonza(page: Page) {
  await page.goto('/dev-login');
  await page.getByRole('button', { name: /Honza/ }).click();
  await page.waitForURL('**/');
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('script view', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsHonza(page);
    await page.goto('/ui-kit/scenar');
    await expect(page.getByRole('heading', { level: 1, name: 'Klient s chybou: fixace hypotéky' })).toBeVisible();
  });

  test('read mode renders anchors, suggestion and layout without horizontal scroll', async ({ page }, info) => {
    const project = info.project.name;
    await expect(page.getByText('Co se divák dozví', { exact: true })).toBeVisible();
    await expect(page.getByText('A · Problém v obraze')).toBeVisible();
    // Comment 2 is a pending suggestion: old text struck through, replacement after it, badge 2.
    await expect(page.locator('[data-thread-id="sample-v031-c2"]').first()).toContainText('Stop!');
    await expect(page.getByText('Počkej. Kolik ti nabídli jinde?')).toBeVisible();
    // Badges are numbered by the thread index (oldest comment first).
    await expect(page.getByRole('button', { name: 'Komentář 2' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Komentář 3' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: `test-results/script-view-${project}.png`, fullPage: true });

    // Tapping a highlight activates it (stronger violet).
    const first = page.locator('[data-thread-id="sample-v031-c1"]').first();
    await first.click();
    await expect(first).toHaveClass(/bg-violet/);
    await first.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/script-view-active-${project}.png` });
  });

  test('diff and dialog modes', async ({ page }, info) => {
    const project = info.project.name;
    await page.getByRole('tab', { name: 'Jen dialog' }).click();
    await expect(page.getByText('Scéna 1 · 0–11 s')).toBeVisible();
    await expect(page.getByText('Obraz:')).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: `test-results/script-view-dialog-${project}.png`, fullPage: true });

    await page.getByRole('tab', { name: 'Změny od v1' }).click();
    await expect(page.locator('ins', { hasText: 'Ze zákona.' })).toBeVisible();
    const collapsed = page.getByRole('button', { name: /beze změny/ }).first();
    await expect(collapsed).toBeVisible();
    await collapsed.click();
    await expect(collapsed).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('[data-field-id]')).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: `test-results/script-view-diff-${project}.png`, fullPage: true });
  });

  test('selecting text inside a field shows the toolbar; selecting across fields does not', async ({ page }, info) => {
    const project = info.project.name;
    // Comment 1 is anchored to „Ze zákona.“; its highlight may be split over several spans, so select across them.
    const select = (threadId: string) =>
      page.evaluate((id) => {
        const marks = [...document.querySelectorAll(`[data-thread-id="${id}"]`)];
        if (marks.length === 0) return false;
        const range = document.createRange();
        range.setStart(marks[0].firstChild!, 0);
        const lastText = marks.at(-1)!.firstChild!;
        range.setEnd(lastText, lastText.textContent!.length);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
      }, threadId);

    await page.locator('[data-thread-id="sample-v031-c1"]').first().scrollIntoViewIfNeeded();
    expect(await select('sample-v031-c1')).toBe(true);
    const toolbar = page.getByRole('toolbar', { name: 'Akce s označeným textem' });
    await expect(toolbar.getByRole('button', { name: 'Komentovat' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Navrhnout' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Číslo' })).toBeVisible();

    const box = await toolbar.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.height).toBeGreaterThanOrEqual(48);
    const target = await page.locator('[data-thread-id="sample-v031-c1"]').first().boundingBox();
    if (project === 'mobile') expect(box!.y).toBeGreaterThanOrEqual(target!.y + target!.height);
    else expect(box!.y + box!.height).toBeLessThanOrEqual(target!.y);
    await page.screenshot({ path: `test-results/script-view-toolbar-${project}.png` });

    // The emitted anchor holds exactly the source text, without the badge or the replacement text.
    const logged = page.waitForEvent('console', (message) => message.text().includes('komentovat'));
    await toolbar.getByRole('button', { name: 'Komentovat' }).click();
    const anchor = await (await logged).args()[1].jsonValue();
    expect(anchor).toMatchObject({ quotedText: 'Ze zákona.' });

    // A selection that runs across two lines yields no anchor, so the toolbar goes away.
    await page.evaluate(() => {
      const fields = [...document.querySelectorAll('[data-field-id^="line:"]')];
      const firstText = (el: Element) => document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode()!;
      const range = document.createRange();
      range.setStart(firstText(fields[0]), 2);
      range.setEnd(firstText(fields[1]), 3);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    });
    await expect(toolbar).toBeHidden();
  });
});
