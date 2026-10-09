import { expect, test } from "@playwright/test";

const LINK = "https://bughuntrace.example/join/K7M2QX";

test.describe("room UI building blocks on /styleguide", () => {
  test("Copy puts the link on the clipboard and confirms", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/styleguide");
    const panel = page.locator('main [data-theme="light"]');
    await panel.getByRole("button", { name: "Copy" }).click();

    await expect(page.getByText("Copied! ✅").first()).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      LINK,
    );
  });

  test("clipboard denied: shows the link pre-selected", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: () => Promise.reject(new Error("denied")),
        },
      });
    });
    await page.goto("/styleguide");
    const panel = page.locator('main [data-theme="light"]');
    await panel.getByRole("button", { name: "Copy" }).click();

    const input = panel.getByLabel("Invite link");
    await expect(input).toBeFocused();
    await expect(panel.getByText("The link is selected")).toBeVisible();
    expect(
      await input.evaluate((el: HTMLInputElement) =>
        el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0),
      ),
    ).toBe(LINK);
  });

  test("full-screen QR opens and closes with Escape", async ({ page }) => {
    await page.goto("/styleguide");
    const panel = page.locator('main [data-theme="light"]');
    await panel.getByRole("button", { name: "Show full-screen QR" }).click();

    const dialog = page.getByRole("dialog", { name: "Scan to join" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("K7M2QX")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("room code input normalises and explains look-alikes", async ({
    page,
  }) => {
    await page.goto("/styleguide");
    const input = page
      .locator('main [data-theme="light"]')
      .getByPlaceholder("K7M2QX");
    await input.fill("k7 0m-2qxzz");

    await expect(input).toHaveValue("K7M2QX");
    await expect(page.getByText("Codes never use 0").first()).toBeVisible();
  });

  test("name form validates and remembers the last choice", async ({
    page,
  }) => {
    await page.goto("/styleguide");
    const form = page.locator('main [data-theme="light"]').locator("form");
    await form.getByRole("button", { name: "Join room" }).click();
    await expect(form.getByText("Enter a name.")).toBeVisible();

    await form.getByLabel("Your name").fill("  Mika  ");
    await form.getByLabel("Avatar 🐼").check();
    await form.getByRole("button", { name: "Join room" }).click();

    await page.reload();
    const again = page.locator('main [data-theme="light"]').locator("form");
    await expect(again.getByLabel("Your name")).toHaveValue("Mika");
    await expect(again.getByLabel("Avatar 🐼")).toBeChecked();
  });

  test("Web Share support shows Share without a hydration error", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        value: () => Promise.resolve(),
      });
    });
    await page.goto("/styleguide");

    const panel = page.locator('main [data-theme="light"]');
    await expect(panel.getByRole("button", { name: "Share" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("player list keeps name suffixes readable at 320px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 812 });
    await page.goto("/styleguide");
    const row = page
      .locator('main [data-theme="light"]')
      .getByRole("list", { name: "Players" })
      .getByRole("listitem")
      .filter({ hasText: "(2)" });
    await expect(row.getByTitle("ABCDEFGHIJKLMNOPQRST (2)")).toBeVisible();
    for (const text of ["(2)", "(you)"]) {
      const part = row.getByText(text, { exact: true });
      await expect(part).toBeVisible();
      // Cut if any overflow-hidden ancestor in the row ends before it does.
      const clipped = await part.evaluate((el) => {
        const right = el.getBoundingClientRect().right;
        for (let node = el.parentElement; node; node = node.parentElement) {
          if (getComputedStyle(node).overflow !== "visible") {
            if (right > node.getBoundingClientRect().right + 0.5) return true;
          }
          if (node.tagName === "LI") break;
        }
        return false;
      });
      expect(clipped, `"${text}" is cut`).toBe(false);
    }
  });

  for (const width of [320, 375]) {
    test(`no sideways scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/styleguide");
      const overflow = () =>
        page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
      expect(await overflow()).toBeLessThanOrEqual(0);
      // The theme panels must fit inside the page padding. Checking only
      // the viewport hides content that is a few px from overflowing, and
      // Linux text rendering adds those few px (CI failed by 2px).
      // On failure, the message names the panel's widest section.
      const panels = await page
        .locator("main [data-theme]")
        .evaluateAll((elements) =>
          elements.map((panel) => {
            let widest = { title: "", minWidth: 0 };
            for (const section of Array.from(panel.children)) {
              const clone = section.cloneNode(true) as HTMLElement;
              clone.style.cssText = "position:absolute;width:min-content";
              panel.append(clone);
              const minWidth = clone.getBoundingClientRect().width;
              clone.remove();
              if (minWidth > widest.minWidth) {
                const title = section.querySelector("h2, h3")?.textContent;
                widest = { title: title ?? section.tagName, minWidth };
              }
            }
            return { right: panel.getBoundingClientRect().right, widest };
          }),
        );
      for (const { right, widest } of panels) {
        expect(
          right,
          `widest section "${widest.title}" is ${widest.minWidth}px`,
        ).toBeLessThanOrEqual(width - 24);
      }

      const panel = page.locator('main [data-theme="light"]');
      await panel.getByRole("button", { name: "Show full-screen QR" }).click();
      const code = page
        .getByRole("dialog", { name: "Scan to join" })
        .getByText("K7M2QX");
      const box = await code.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    });
  }
});

test.describe("results building blocks on /styleguide", () => {
  test("30-player leaderboard fits 320px and works by keyboard", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 812 });
    await page.goto("/styleguide");
    const panel = page.locator('main [data-theme="dark"]');
    const thirty = panel.getByRole("button", { name: "30 players" });
    await thirty.focus();
    await page.keyboard.press("Enter");
    await expect(thirty).toHaveAttribute("aria-pressed", "true");

    const board = panel.getByRole("list", { name: "dark live leaderboard" });
    await expect(board.getByRole("listitem")).toHaveCount(30);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);

    const next = panel.getByRole("button", { name: "Play round 2" });
    await next.focus();
    await page.keyboard.press("Enter");
    await expect(
      panel.getByRole("list", { name: "Round 2 results" }),
    ).toBeVisible();
    await expect(panel.getByText("Not solved").first()).toBeVisible();
  });

  test("leaderboard rows are in rank order in the DOM and still slide", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/styleguide");
    const panel = page.locator('main [data-theme="light"]');
    const board = panel.getByRole("list", { name: "light live leaderboard" });
    await expect(board.getByRole("listitem")).toHaveCount(5);

    // Places read top to bottom in the DOM, and each row sits below the last.
    const rows = () =>
      board.evaluate((list) =>
        [...list.querySelectorAll("li")].map((row) => ({
          place: Number(row.getAttribute("aria-posinset")),
          top: row.getBoundingClientRect().top,
          sliding: row.getAnimations().length > 0,
        })),
      );
    const expectRankOrder = async () => {
      await expect
        .poll(async () => (await rows()).some((r) => r.sliding))
        .toBe(false);
      const now = await rows();
      expect(now.map((row) => row.place)).toEqual([1, 2, 3, 4, 5]);
      const tops = now.map((row) => row.top);
      expect(tops).toEqual([...tops].sort((a, b) => a - b));
    };
    await expectRankOrder();
    await expect(board.getByRole("listitem").first()).toContainText(/^Place 1/);

    await panel.getByRole("button", { name: "Play round 2" }).click();
    await expect
      .poll(async () => (await rows()).some((r) => r.sliding))
      .toBe(true);
    await expectRankOrder();
  });

  test("podium admin buttons and confetti respect reduced motion", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/styleguide");
    const panel = page.locator('main [data-theme="light"]');
    await expect(panel.getByRole("list", { name: "Podium" })).toBeVisible();
    await panel.getByRole("button", { name: "Replay confetti" }).click();
    await expect(page.getByTestId("confetti")).toHaveCount(0);
    await panel.getByRole("button", { name: "Play again" }).click();
    await expect(panel.getByText("Play again clicked")).toBeVisible();
  });
});
