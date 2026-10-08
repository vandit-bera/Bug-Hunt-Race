import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 375, height: 700 } });

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Every visible link, button and radio must be at least 44px tall. */
async function expectTapTargets(page: Page) {
  const small = await page
    .locator("a:visible, button:visible, input[type=radio]")
    .evaluateAll((nodes) =>
      nodes
        .map((node) => {
          const box = node.getBoundingClientRect();
          // The radio inputs overlay their card, so they have the card's size.
          return {
            name: node.textContent?.trim(),
            h: box.height,
            w: box.width,
          };
        })
        .filter(({ h, w }) => w > 0 && (h < 44 || w < 44)),
    );
  expect(small).toEqual([]);
}

test("Home fits a phone and explains the game", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "How to play" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Levels" })).toBeVisible();
  await expect(page.getByText("Coming soon")).toBeVisible();
  await expect(page.getByRole("link", { name: "Report a bug" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectTapTargets(page);
});

/** The text of every option card must stay inside the card. */
async function expectOptionLabelsFit(page: Page) {
  const overflowing = await page
    .locator("input[type=radio] + span")
    .evaluateAll((cards) =>
      cards
        .map((card) => {
          const range = document.createRange();
          range.selectNodeContents(card);
          const text = range.getBoundingClientRect();
          const box = card.getBoundingClientRect();
          return {
            name: card.textContent?.trim(),
            fits: text.left >= box.left && text.right <= box.right,
          };
        })
        .filter(({ fits }) => !fits),
    );
  expect(overflowing).toEqual([]);
}

for (const width of [360, 375, 414, 640]) {
  test(`Solo setup fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.goto("/solo");
    await expect(page.getByRole("link", { name: "Start" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectTapTargets(page);
    await expectOptionLabelsFit(page);
  });
}

test("Styleguide fits a phone", async ({ page }) => {
  await page.goto("/styleguide");
  await expect(
    page.getByRole("heading", { level: 1, name: "Styleguide" }),
  ).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("Rules modal matches the scoring rules and closes with Escape", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "How scoring works" }).click();
  const dialog = page.getByRole("dialog", { name: "How scoring works" });
  await expect(dialog).toContainText("up to +50% of the base points");
  await expect(dialog).toContainText("costs 25% of the base points");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("Solo game shows a laptop banner that can be dismissed", async ({
  page,
}) => {
  await page.goto("/solo/play?language=javascript&level=easy&round=0");
  const banner = page.getByRole("note");
  await expect(banner).toContainText("best on a laptop");
  await page.getByRole("button", { name: "Continue anyway" }).click();
  await expect(banner).toBeHidden();
});

test("Solo result fits a phone and links to the rules", async ({ page }) => {
  await page.goto("/solo/play?language=javascript&level=easy&round=0");
  await page.getByRole("button", { name: "Give up" }).click();
  await page
    .getByRole("dialog", { name: "Give up?" })
    .getByRole("button", { name: "Give up" })
    .click();
  await expect(
    page.getByRole("heading", { name: "You gave up" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "How scoring works" }),
  ).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectTapTargets(page);
});
