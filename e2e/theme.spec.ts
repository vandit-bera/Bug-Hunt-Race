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

test("tooltip closes on Escape and the modal ignores clicks on its padding", async ({
  page,
}) => {
  await page.goto("/styleguide");
  const trigger = page
    .getByRole("button", { name: "Hover or focus me" })
    .first();
  await trigger.focus();
  const tooltip = page.getByRole("tooltip").first();
  await expect(tooltip).toHaveCSS("opacity", "1");
  await page.keyboard.press("Escape");
  await expect(tooltip).toHaveCSS("opacity", "0");

  await page.getByRole("button", { name: "Open modal" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.click({ position: { x: 4, y: 4 } });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("system theme follows the OS on a page without a ThemeToggle", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/no-such-page");
  await expect(page.getByRole("radiogroup")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("tooltip closes on Escape while shown by mouse hover", async ({
  page,
}) => {
  await page.goto("/styleguide");
  await page.getByRole("button", { name: "Hover or focus me" }).first().hover();
  const tooltip = page.getByRole("tooltip").first();
  await expect(tooltip).toHaveCSS("opacity", "1");
  await page.keyboard.press("Escape");
  await expect(tooltip).toHaveCSS("opacity", "0");
});

test("theme toggle uses a roving tabindex and arrow keys", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const radios = page.getByRole("radio");
  await expect(radios).toHaveCount(3);
  await expect(radios.nth(0)).toHaveAttribute("tabindex", "-1");
  await expect(radios.nth(1)).toHaveAttribute("tabindex", "-1");
  await expect(radios.nth(2)).toHaveAttribute("tabindex", "0");

  await page.getByRole("radio", { name: /System/ }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("radio", { name: /Dark/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: /Dark/ })).toBeFocused();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("radio", { name: /Light/ })).toBeChecked();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: /System/ })).toBeChecked();
});
