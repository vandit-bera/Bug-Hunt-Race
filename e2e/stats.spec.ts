import { expect, test } from "@playwright/test";

const PROGRESS_KEY = "bhr:solo:progress:v1";

test("shows an empty state with every badge locked", async ({ page }) => {
  await page.goto("/stats");
  await expect(page.getByRole("heading", { name: "My Stats" })).toBeVisible();
  await expect(page.getByText("No games yet")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Badges (0/6)" }),
  ).toBeVisible();
  await expect(page.getByText("Locked")).toHaveCount(6);
});

test("shows earned badges, streaks and personal bests", async ({ page }) => {
  await page.addInitScript(
    ([key, bestKey]) => {
      const today = new Date();
      const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      localStorage.setItem(
        key,
        JSON.stringify({
          totalSolves: 4,
          winStreak: 3,
          bestWinStreak: 3,
          dailyStreak: 2,
          bestDailyStreak: 2,
          lastPlayedDay: day,
          solvedLanguages: ["python"],
          hardSolves: 1,
          earned: { "first-blood": day, "hat-trick": day },
        }),
      );
      localStorage.setItem(
        bestKey,
        JSON.stringify({ "python:easy": { points: 140, timeSec: 65 } }),
      );
    },
    [PROGRESS_KEY, "bhr:solo:best"],
  );
  await page.goto("/stats");
  await expect(
    page.getByRole("heading", { name: "Badges (2/6)" }),
  ).toBeVisible();
  await expect(page.getByText("Locked")).toHaveCount(4);
  await expect(page.getByText("140")).toBeVisible();
  await expect(page.getByText("1:05")).toBeVisible();
});

test("a locked badge explains how to earn it on focus", async ({ page }) => {
  await page.goto("/stats");
  await page
    .getByText("Speed Demon")
    .locator("xpath=ancestor::div[@tabindex]")
    .focus();
  await expect(page.getByRole("tooltip", { name: /under 25%/ })).toBeVisible();
});

test("corrupt stored progress does not crash the page", async ({ page }) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, "{not json");
  }, PROGRESS_KEY);
  await page.goto("/stats");
  await expect(
    page.getByRole("heading", { name: "Badges (0/6)" }),
  ).toBeVisible();
});

test("locked badge cards fill their grid cell", async ({ page }) => {
  await page.goto("/stats");
  const cell = page.getByRole("listitem").filter({ hasText: "Speed Demon" });
  const card = cell.locator("[tabindex]");
  const cellBox = await cell.boundingBox();
  const cardBox = await card.boundingBox();
  expect(cardBox?.width).toBeCloseTo(cellBox?.width ?? 0, 0);
});

for (const width of [320, 340, 375]) {
  test(`the stats page does not scroll sideways at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.goto("/stats");
    await expect(page.getByRole("table")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBe(0);
  });
}

test("home links to My Stats", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "My Stats" }).click();
  await expect(page.getByRole("heading", { name: "My Stats" })).toBeVisible();
});
