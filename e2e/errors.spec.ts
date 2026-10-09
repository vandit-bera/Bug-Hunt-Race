import { expect, test, type Page } from "@playwright/test";

const THEMES = ["light", "dark"] as const;

/** No stack trace or raw error text ever reaches the player. */
async function expectNoErrorDetails(page: Page) {
  await expect(page.locator("body")).not.toContainText("Crash test");
  await expect(page.locator("body")).not.toContainText(/\bat \w+ \(/);
}

for (const theme of THEMES) {
  test(`404 page in ${theme} theme, keyboard to Home`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(
      page.getByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeVisible();
    await expect(page).toHaveTitle("Page not found · Bug Hunt Race");

    const home = page.getByRole("main").getByRole("link", { name: "Home" });
    await home.focus();
    await expect(home).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/");
  });

  test(`error page in ${theme} theme: Retry recovers`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/dev/crash");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(
      page.getByRole("heading", { level: 1, name: "Something went wrong" }),
    ).toBeVisible();
    await expectNoErrorDetails(page);

    // The bug is gone (say a server came back): Retry, by keyboard.
    await page.evaluate(() => localStorage.setItem("bhr-dev-crash", "off"));
    const retry = page.getByRole("button", { name: "Retry" });
    await retry.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Recovered" }),
    ).toBeVisible();
  });
}

test("error page Home link goes home", async ({ page }) => {
  await page.goto("/dev/crash");
  await page.getByRole("main").getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL("/");
});
