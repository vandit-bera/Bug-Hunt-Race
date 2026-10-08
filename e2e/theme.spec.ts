import { expect, test } from "@playwright/test";

test("theme choice persists after reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.getByRole("radio", { name: /Dark/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("radio", { name: /Dark/ })).toBeChecked();
});

test("system theme follows the OS preference", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("styleguide shows components in both themes", async ({ page }) => {
  await page.goto("/styleguide");
  await expect(
    page.getByRole("heading", { level: 1, name: "Styleguide" }),
  ).toBeVisible();
  await expect(page.locator('[data-theme="light"]').first()).toBeVisible();
  await expect(page.locator('[data-theme="dark"]').first()).toBeVisible();
});

test("system theme updates live when the OS preference changes", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("theme change in another tab recolors this tab", async ({ context }) => {
  const first = await context.newPage();
  await first.emulateMedia({ colorScheme: "light" });
  await first.goto("/");
  const second = await context.newPage();
  await second.emulateMedia({ colorScheme: "light" });
  await second.goto("/");

  await second.getByRole("radio", { name: /Dark/ }).click();
  await expect(first.locator("html")).toHaveAttribute("data-theme", "dark");
});
