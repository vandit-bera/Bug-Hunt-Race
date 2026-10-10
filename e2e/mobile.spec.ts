import { expect, test, type Page } from "@playwright/test";
import {
  PHONE_WIDTHS,
  expectEditorWraps,
  expectFitsPhones,
  expectNoHorizontalScroll,
  expectTapTargets,
} from "./support/mobile";

test.use({ viewport: { width: 375, height: 700 } });

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

for (const width of [320, 360, 375, 414, 640]) {
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

/** Measures the Sound toggle, the reaction buttons and the `sm` buttons. */
async function expectSmallControlsTappable(page: Page) {
  const targets = [
    page.getByRole("button", { name: "Mute sound" }),
    page.getByRole("group", { name: "Send a reaction" }).getByRole("button"),
    page.getByRole("button", { name: "Simulate solve" }),
    page.getByRole("button", { name: "Show toast" }),
  ];
  for (const target of targets) {
    for (const button of await target.all()) {
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  }
}

for (const width of [360, 375, 414]) {
  test(`Styleguide room UI fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.goto("/styleguide");
    await expect(
      page.getByRole("group", { name: "Send a reaction" }).first(),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectSmallControlsTappable(page);
    if (width >= 375) {
      const tops = await page
        .getByRole("group", { name: "Send a reaction" })
        .first()
        .getByRole("button")
        .evaluateAll((buttons) =>
          buttons.map((button) => button.getBoundingClientRect().top),
        );
      expect(new Set(tops).size).toBe(1);
    }
  });

  test(`Solo game header fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.goto("/solo/play?language=javascript&level=easy&round=0");
    await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    const sound = page.getByRole("button", { name: "Mute sound" });
    const box = await sound.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });
}

test.describe("on a touch tablet", () => {
  test.use({
    viewport: { width: 820, height: 1180 },
    hasTouch: true,
    isMobile: true,
  });

  test("small controls still get a 44px tap area", async ({ page }) => {
    await page.goto("/styleguide");
    await expectSmallControlsTappable(page);
  });
});

for (const width of [320, 360, 375, 414]) {
  test(`Final leaderboard keeps award chips in their rows at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.goto("/styleguide");
    const rows = page
      .getByRole("list", { name: "Final leaderboard" })
      .first()
      .getByRole("listitem");
    await expect(rows.first()).toBeVisible();
    // Chips never leave their row. From 360px up, every chip is fully shown;
    // narrower phones may clip the last one. The first sample player holds
    // all four awards, the widest case.
    const hidden = await rows.evaluateAll(
      (items, mustShowAll) =>
        items.flatMap((item) => {
          const row = item.getBoundingClientRect();
          const list = item.querySelector("[data-testid=room-awards]");
          if (!list) return [];
          const box = list.getBoundingClientRect();
          return [...list.children]
            .map((chip) => chip.getBoundingClientRect())
            .filter(
              (chip) =>
                chip.top < row.top ||
                chip.bottom > row.bottom ||
                (mustShowAll && chip.right > box.right + 0.5),
            )
            .map(() => item.textContent?.trim());
        }),
      width >= 360,
    );
    expect(hidden).toEqual([]);
  });
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`every screen on a phone, ${theme} theme`, () => {
    test.use({ colorScheme: theme });

    test("Home", async ({ page }) => {
      await page.goto("/");
      await expectFitsPhones(page, ["Solo Practice", "How scoring works"]);
    });

    test("Solo game: editor wraps, controls stay reachable", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/solo/play?language=javascript&level=easy&round=0");
      await expect(page.getByRole("note")).toContainText("best on a laptop");
      for (const width of PHONE_WIDTHS) {
        await page.setViewportSize({ width, height: 740 });
        await expectEditorWraps(page);
      }
      await expectFitsPhones(page, ["Run Tests", "Give up", "Mute sound"]);
      expect(errors).toEqual([]);
    });

    test("Solo result", async ({ page }) => {
      await page.goto("/solo/play?language=javascript&level=easy&round=0");
      await page.getByRole("button", { name: "Give up" }).click();
      await page
        .getByRole("dialog", { name: "Give up?" })
        .getByRole("button", { name: "Give up" })
        .click();
      await expect(
        page.getByRole("heading", { name: "You gave up" }),
      ).toBeVisible();
      await expectFitsPhones(page, ["How scoring works"]);
    });

    test("Stats: every personal-best column shows", async ({ page }) => {
      await page.addInitScript(() =>
        localStorage.setItem(
          "bhr:solo:best",
          JSON.stringify({
            "typescript:medium": { points: 285, timeSec: 125 },
            "javascript:mixed": { points: 300, timeSec: 601 },
          }),
        ),
      );
      await page.goto("/stats");
      const table = page.getByRole("table");
      await expect(table.getByText("285")).toBeVisible();
      for (const width of PHONE_WIDTHS) {
        await page.setViewportSize({ width, height: 740 });
        // The table's natural width, so a slightly wider font (Linux CI,
        // Android) still fits: keep at least 16px to spare.
        const spare = await table.evaluate((node) => {
          node.style.width = "max-content";
          const needed = node.getBoundingClientRect().width;
          node.style.width = "";
          return (node.parentElement?.clientWidth ?? 0) - needed;
        });
        expect(spare, `room to spare at ${width}px`).toBeGreaterThanOrEqual(16);
      }
      await expectFitsPhones(page, ["Home"]);
    });

    for (const [name, url] of [
      ["Join", "/join"],
      ["Join link", "/join/ABCDEF"],
      ["Create room", "/room/new"],
      ["Room not found", "/room/ZZZZZZ"],
      ["404", "/no-such-page"],
    ] as const) {
      test(name, async ({ page }) => {
        await page.goto(url);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expectFitsPhones(page);
      });
    }

    test("Error page", async ({ page }) => {
      await page.goto("/dev/crash");
      await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
      await expectFitsPhones(page, ["Retry", "Home"]);
    });
  });
}

test("toasts clear the controls: 44px dismiss, solve toasts pass taps through", async ({
  page,
}) => {
  await page.goto("/styleguide");
  await page.getByRole("button", { name: "Show toast" }).first().click();
  const dismiss = page
    .getByRole("button", { name: "Dismiss notification" })
    .first();
  const box = await dismiss.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);

  await page.getByRole("button", { name: "Simulate solve" }).first().click();
  const toast = page
    .getByRole("listitem")
    .filter({ hasText: "fixed it in" })
    .first();
  await expect(toast).toBeVisible();
  await expect(toast).toHaveCSS("pointer-events", "none");
});

test("the page may reach the iPhone's safe areas", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    "content",
    /viewport-fit=cover/,
  );
});
