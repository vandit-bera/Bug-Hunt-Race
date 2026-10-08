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

  for (const width of [320, 375]) {
    test(`no sideways scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/styleguide");
      const overflow = () =>
        page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
      expect(await overflow()).toBeLessThanOrEqual(0);

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
