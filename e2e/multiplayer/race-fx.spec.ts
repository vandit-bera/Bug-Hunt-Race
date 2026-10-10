import type { Page } from "@playwright/test";
import {
  COUNTDOWN,
  LIVE,
  expect,
  heading,
  openRoom,
  puzzleOn,
  requireSupabase,
  solve,
  stopGame,
  test,
} from "../support";

requireSupabase();

const STEPS = ["3", "2", "1", "Go!"];

/** The countdown number on `page`, as a step index (0 for "3"). */
async function countdownStep(page: Page) {
  const label = await page
    .getByRole("status", { name: /^(3|2|1|Go!)$/ })
    .getAttribute("aria-label");
  return STEPS.indexOf(label ?? "");
}

function toast(page: Page, name: string) {
  return page.getByRole("listitem").filter({ hasText: `${name} fixed it in` });
}

test("race FX: synced countdown, solve toasts, score pop-up, mute, podium confetti, reduced motion", async ({
  players,
}) => {
  test.setTimeout(120_000);
  const racers = await players(3);
  const [ana, ben, cleo] = racers;
  await cleo.page.emulateMedia({ reducedMotion: "reduce" });
  await openRoom(racers);

  // The countdown shows on every screen within a second, on the same number.
  await ana.page.getByRole("button", { name: "Start game" }).click();
  const shownAt = await Promise.all(
    racers.map(async ({ page }) => {
      await expect(heading(page)).toHaveText("Get ready", LIVE);
      return Date.now();
    }),
  );
  expect(Math.max(...shownAt) - Math.min(...shownAt)).toBeLessThan(1_000);
  const steps = await Promise.all(
    racers.map(({ page }) => countdownStep(page)),
  );
  expect(steps.every((step) => step >= 0)).toBe(true);
  expect(Math.max(...steps) - Math.min(...steps)).toBeLessThanOrEqual(1);
  for (const { page } of racers) {
    await expect(heading(page)).toHaveText(/^Round \d+$/, COUNTDOWN);
  }
  const puzzle = await puzzleOn(ana.page);

  // Mute works mid-game from the room header.
  const mute = ana.page.getByRole("button", { name: "Mute sound" });
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "false");

  // Ben solves: a "+points" pop-up for him, a toast for everyone else.
  await solve(ben.page, puzzle.fix);
  await expect(ben.page.getByTestId("score-popup")).toBeVisible();
  for (const { page } of [ana, cleo]) {
    await expect(toast(page, ben.name)).toBeVisible(LIVE);
  }
  await expect(toast(ben.page, ben.name)).toHaveCount(0);

  // Reduced motion: Cleo's solve still toasts, but she gets no pop-up.
  await solve(cleo.page, puzzle.fix);
  await expect(toast(ana.page, cleo.name)).toBeVisible(LIVE);
  await expect(cleo.page.getByTestId("score-popup")).toHaveCount(0);

  // The podium bursts confetti, except under reduced motion.
  await stopGame(ana);
  for (const { page } of racers) {
    await expect(heading(page)).toHaveText("Final leaderboard", LIVE);
    await expect(page.getByRole("list", { name: "Podium" })).toBeVisible(LIVE);
  }
  await expect(ben.page.getByTestId("confetti")).toBeAttached();
  await expect(cleo.page.getByTestId("confetti")).toHaveCount(0);
});
