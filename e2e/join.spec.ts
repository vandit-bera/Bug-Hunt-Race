import { expect, test } from "@playwright/test";

// The code step needs no database; the rest of the join flow is covered in
// e2e/multiplayer/join.spec.ts.
test.describe("/join", () => {
  test("a short code shows an error on the field", async ({ page }) => {
    await page.goto("/join");
    await page.getByLabel("Room code").fill("K7M");
    await page.getByRole("button", { name: "Join", exact: true }).click();

    await expect(page.getByLabel("Room code")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(page.getByText("Enter all 6 characters")).toBeVisible();
    await expect(page).toHaveURL("/join");
  });

  test("a full code goes on to the name step, keyboard only", async ({
    page,
  }) => {
    await page.goto("/join");
    await page.getByLabel("Room code").focus();
    await page.keyboard.type("k7m 2qx");
    await expect(page.getByLabel("Room code")).toHaveValue("K7M2QX");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL("/join/K7M2QX");
  });

  test("a code pasted before the page hydrates still counts", async ({
    page,
  }) => {
    // Hold the app's JS so the paste lands before React hydrates (TB-78:
    // WebKit on a busy CI runner sometimes got the fill in that early).
    let hydrate!: () => void;
    const held = new Promise<void>((resolve) => (hydrate = resolve));
    await page.route("**/_next/static/**/*.js", async (route) => {
      await held;
      await route.continue();
    });
    await page.goto("/join", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Room code").fill("k7 0m-2qx");
    hydrate();

    await expect(page.getByLabel("Room code")).toHaveValue("K7M2QX");
    await expect(page.getByText("Codes never use 0")).toBeVisible();
    await page.getByRole("button", { name: "Join", exact: true }).click();
    await expect(page).toHaveURL("/join/K7M2QX");
  });

  test("fits a phone", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/join");
    await expect(
      page.getByRole("heading", { name: "Join a room" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
  });
});
