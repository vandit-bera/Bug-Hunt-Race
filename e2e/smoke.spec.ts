import { expect, test } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Bug Hunt Race/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Bug Hunt Race 🐛" }),
  ).toBeVisible();
});
