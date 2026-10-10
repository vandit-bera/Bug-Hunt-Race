import path from "node:path";
import type { Page } from "@playwright/test";
import { loadPuzzles } from "@/lib/puzzles/load";
import type { LanguageId } from "@/lib/runner/types";
import { expect, type Player } from "./fixtures";
import { joinByLink } from "./join";
import { LIVE, createRoomFromScreen } from "./rooms";
import { setCode } from "./editor";

const PUZZLES = loadPuzzles(path.resolve("puzzles")).flatMap(({ puzzle }) =>
  puzzle ? [puzzle] : [],
);

/** The 3-2-1-Go countdown, then the round loads. */
export const COUNTDOWN = { timeout: 10_000 };

/** The page's h1: "Lobby", "Get ready", "Round 2", "Final leaderboard"… */
export function heading(page: Page) {
  return page.getByRole("heading", { level: 1 });
}

/** The puzzle on `page`, by its title (the database picks at random). */
export async function puzzleOn(
  page: Page,
  language: LanguageId = "javascript",
) {
  const title = page.getByRole("main").getByRole("heading", { level: 2 });
  await expect(title).toBeVisible(COUNTDOWN);
  const text = (await title.textContent()) ?? "";
  const puzzle = PUZZLES.find(
    ({ meta }) => meta.title === text && meta.language === language,
  );
  if (!puzzle) throw new Error(`No ${language} puzzle titled "${text}"`);
  return puzzle;
}

/** Creates an Easy room and seats `guests` through invite links. */
export async function openRoom(
  [admin, ...guests]: Player[],
  totalRounds: number | null = 3,
  language: LanguageId = "javascript",
) {
  const code = await createRoomFromScreen(admin.page, admin.name, {
    language,
    level: "easy",
    totalRounds,
  });
  for (const guest of guests) await joinByLink(guest.page, code, guest.name);
  for (const { page } of [admin, ...guests]) {
    await expect(
      page.getByRole("list", { name: "Players" }).getByRole("listitem"),
    ).toHaveCount(guests.length + 1, LIVE);
  }
  return code;
}

/** The admin starts the game; everyone gets the countdown, then round 1. */
export async function startGame(admin: Player, racers: Player[]) {
  await admin.page.getByRole("button", { name: "Start game" }).click();
  for (const { page } of racers) {
    await expect(heading(page)).toHaveText("Get ready", LIVE);
  }
  for (const { page } of racers) {
    await expect(heading(page)).toHaveText(/^Round \d+$/, COUNTDOWN);
    await expect(page.getByTestId("round-time-left")).toBeVisible();
  }
}

/**
 * The player's "done" card, or the round results: the last result ends the
 * round at once, so the card may be gone before an assertion sees it (the
 * `realtime` flake on main, TB-73).
 */
function doneOrResults(page: Page, card: string) {
  return page
    .getByText(card)
    .or(page.getByRole("heading", { level: 1, name: /^Round \d+ results$/ }));
}

export async function solve(page: Page, fix: string) {
  await setCode(page, fix);
  await page.getByRole("button", { name: "Run Tests" }).click();
  await expect(doneOrResults(page, "🎉 Solved!")).toBeVisible(COUNTDOWN);
}

export async function giveUp(page: Page) {
  await page.getByRole("button", { name: "Give up" }).click();
  await page
    .getByRole("dialog", { name: "Give up?" })
    .getByRole("button", { name: "Give up" })
    .click();
  await expect(doneOrResults(page, "You gave up this one.")).toBeVisible(LIVE);
}

/** The admin stops the game (from a live or paused round) and confirms. */
export async function stopGame(admin: Player) {
  await admin.page.getByRole("button", { name: "Stop game" }).click();
  await admin.page
    .getByRole("dialog", { name: "Stop the game?" })
    .getByRole("button", { name: "Stop game" })
    .click();
}

/**
 * A player's name keeps a readable width in a results list on phones: the
 * status and points wrap below it instead of squeezing it (QA, TB-35).
 */
export async function expectNameFits(page: Page, list: string, name: string) {
  const viewport = page.viewportSize();
  for (const width of [320, 414]) {
    await page.setViewportSize({ width, height: 800 });
    const box = await page
      .getByRole("list", { name: list, exact: true })
      .getByText(name, { exact: true })
      .boundingBox();
    expect(box?.width, `${name} at ${width} px`).toBeGreaterThanOrEqual(60);
  }
  if (viewport) await page.setViewportSize(viewport);
}
