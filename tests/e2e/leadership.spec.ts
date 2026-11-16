import { expect, test, type Page } from "@playwright/test";

async function loginAsRadek(page: Page) {
  await page.goto("/dev-login");
  await page.getByRole("button", { name: /Radek/ }).click();
  await page.waitForURL((url) => url.pathname === "/");
}

test.describe("desktop screenshots (Honza)", () => {
  test("home default and Všechny", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop");
    await page.goto("/dev-login");
    await page.getByRole("button", { name: /Honza/ }).click();
    await page.waitForURL((url) => url.pathname === "/");
    await expect(page.locator("[data-detail]")).toBeVisible();
    await page.screenshot({ path: "test-results/pc-home.png", fullPage: true });
    await page.goto("/?zobrazit=vse");
    await expect(
      page.getByRole("heading", { name: /^Listopad 2026/ }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/pc-home-all.png",
      fullPage: true,
    });
  });
});

test.describe("leadership mode", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRadek(page);
  });

  test("lands on the home and has exactly two navigation items", async ({
    page,
  }, info) => {
    await page.goto("/");
    const nav = page.locator(
      'nav[aria-label="Hlavní navigace"], aside[aria-label="Hlavní navigace"]',
    );
    await expect(nav.getByRole("link")).toHaveCount(
      info.project.name === "mobile" ? 2 : 3,
    ); // desktop rail also has the logo link
    await expect(
      nav.getByRole("link", { name: "Scénáře", exact: true }),
    ).toBeVisible();
    await expect(nav.getByRole("link", { name: /Ke kontrole/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Nastavení" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Více" })).toHaveCount(0);
  });

  test("„?“ opens „Jak kontrolovat“", async ({ page }, info) => {
    await page.goto("/kontrola/V031");
    if (info.project.name === "mobile")
      await page.screenshot({
        path: "test-results/leadership-review-mobile.png",
      });
    await page
      .getByRole("button", { name: "Nápověda" })
      .filter({ visible: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Jak kontrolovat" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Co znamenají stavy?")).toBeVisible();
  });

  test("home: category boxes; mobile accordion expands, desktop shows the right-hand list", async ({
    page,
  }, info) => {
    const mobile = info.project.name === "mobile";
    await page.goto("/scenare");
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page
        .getByText(/\d+ z \d+ hotových/)
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Listopad", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.getByText(/žlutá = čeká na tvou kontrolu/)).toBeVisible();
    if (mobile)
      await page.screenshot({
        path: "test-results/leadership-home-mobile.png",
        fullPage: true,
      });
    else {
      expect(
        await page.locator("[data-master]").count(),
      ).toBeGreaterThanOrEqual(4);
      await expect(page.locator("[data-detail]")).toBeVisible();
      await expect(
        page.locator("[data-detail] a", { hasText: "Ke kontrole" }).first(),
      ).toBeVisible();
    }

    let yellow;
    if (mobile) {
      const box = page
        .locator("[data-box]")
        .filter({ hasText: /ke kontrole/ })
        .first();
      await box.getByRole("link").first().click();
      await expect(page).toHaveURL(/kategorie=/);
      yellow = box.locator("ul a", { hasText: "Ke kontrole" }).first();
      await expect(yellow).toBeVisible();
      await page.screenshot({
        path: "test-results/leadership-home-expanded-mobile.png",
        fullPage: true,
      });
    } else {
      const other = page.locator("[data-master] a").nth(1);
      await other.click();
      await expect(page).toHaveURL(/kategorie=/);
      await expect(page.locator("[data-detail]")).toBeVisible();
      yellow = page
        .locator("[data-detail] a", { hasText: "Ke kontrole" })
        .first();
      if (!(await yellow.count())) {
        await page
          .locator("[data-master] a", { hasText: /ke kontrole/ })
          .first()
          .click();
        yellow = page
          .locator("[data-detail] a", { hasText: "Ke kontrole" })
          .first();
      }
      await expect(yellow).toBeVisible();
    }
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
    await yellow.click();
    await page.waitForURL(/\/kontrola\/V\d+/);
    if (mobile) {
      await page.getByRole("link", { name: /Zpět na scénáře/ }).click();
      await page.waitForURL((url) => url.pathname === "/");
    }
  });

  test("„Všechny“: scripts grouped by month, no „hotových“ counters", async ({
    page,
  }) => {
    await page.goto("/?zobrazit=vse");
    await expect(
      page.getByRole("heading", { name: /^Listopad 2026/ }).first(),
    ).toBeVisible();
    await expect(page.getByText(/hotových/)).toHaveCount(0);
    await expect(page.getByText(/\d+ scénář/).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Všechny" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("review: help mentions text marking and „Odeslat připomínky“ is offered", async ({
    page,
  }, info) => {
    await page.goto("/kontrola/V031");
    await expect(
      page
        .getByRole("button", { name: "Odeslat připomínky" })
        .filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page
        .getByText(/Schválit = je to OK · Odeslat připomínky = Admin to opraví/)
        .filter({ visible: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Nápověda" })
      .filter({ visible: true })
      .click();
    await expect(
      page.getByText("Podrž prst na slově a táhni pro označení části textu."),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    if (info.project.name !== "mobile") return;
    // Phone: mark a phrase, comment, and see it in the sheet.
    await page.goto("/kontrola/V026");
    const field = page.locator('[data-field-id^="line:v026"]').first();
    await field.scrollIntoViewIfNeeded();
    const phrase = await field.evaluate((el) =>
      (el.textContent ?? "").trim().split(/\s+/).slice(0, 2).join(" "),
    );
    await page.evaluate(
      ([fieldId, text]) => {
        const f = document.querySelector(`[data-field-id="${fieldId}"]`)!;
        const walker = document.createTreeWalker(f, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const at = (n as Text).data.indexOf(text);
          if (at === -1) continue;
          const r = document.createRange();
          r.setStart(n, at);
          r.setEnd(n, at + text.length);
          const s = window.getSelection()!;
          s.removeAllRanges();
          s.addRange(r);
          return;
        }
      },
      [(await field.getAttribute("data-field-id")) ?? "", phrase] as [
        string,
        string,
      ],
    );
    const toolbar = page.getByRole("toolbar", {
      name: "Akce s označeným textem",
    });
    await expect(toolbar).toBeVisible();
    await toolbar.getByRole("button", { name: "Komentovat" }).click();
    const text = `Poznámka z mobilu ${Date.now()}`;
    await page
      .getByRole("textbox", { name: "Komentář", exact: true })
      .fill(text);
    await page.getByRole("button", { name: "Odeslat", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Komentář přidán");
    await page.getByRole("button", { name: "Rozbalit komentáře" }).click();
    await expect(page.getByText(text)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Napsat komentář" }),
    ).toBeVisible();
  });

  test("admin-only pages redirect to the review", async ({ page }) => {
    for (const path of ["/nastaveni", "/prehled", "/serie", "/publikace"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/$|\/kontrola/);
    }
  });

  test("shooting day is read-only", async ({ page }) => {
    await page.goto("/nataceni");
    await expect(
      page.getByRole("button", { name: /Sdílet se štábem/ }),
    ).toHaveCount(0);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
  });
});
