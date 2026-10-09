import { expect, type Page } from "@playwright/test";
import { loadPuzzles } from "@/lib/puzzles/load";

/**
 * Helpers for Solo Practice (`/solo`). Fixes come from the repo's puzzle
 * files, never from the site.
 */

const puzzles = loadPuzzles("puzzles").flatMap((entry) =>
  entry.puzzle ? [entry.puzzle] : [],
);

export type SoloLanguage = "javascript" | "typescript" | "python";

const LABELS: Record<SoloLanguage, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
};

/** Time for the 3-2-1-Go countdown before the puzzle appears. */
export const COUNTDOWN_WAIT = { timeout: 10_000 };

/** The puzzle on screen: the game picks at random, so read its title. */
export async function currentPuzzle(page: Page) {
  await expect(page.getByRole("timer")).toBeVisible(COUNTDOWN_WAIT);
  const heading = page.getByRole("main").getByRole("heading", { level: 1 });
  await expect(heading).toBeVisible();
  const title = (await heading.textContent()) ?? "";
  const puzzle = puzzles.find(({ meta }) => meta.title === title);
  if (!puzzle) throw new Error(`No puzzle titled "${title}"`);
  return puzzle;
}

/** Picks a language and level on `/solo` and starts a game. */
export async function startSolo(
  page: Page,
  language: SoloLanguage,
  level: string,
  { skipCountdown = true } = {},
) {
  await page.goto("/solo");
  await page.getByLabel(LABELS[language], { exact: true }).check();
  await page.getByLabel(level, { exact: false }).check();
  await page.getByRole("link", { name: "Start" }).click();
  if (skipCountdown) {
    await expect(page.getByRole("timer")).toBeVisible(COUNTDOWN_WAIT);
  }
}

/**
 * Replaces the editor content. Select-all does not work in headless
 * Chromium's Monaco, so select from the top to the bottom with the arrow and
 * page keys, then paste (typing would auto-indent Python).
 */
export async function setCode(page: Page, code: string) {
  await page.locator(".monaco-editor .view-lines").click();
  for (let i = 0; i < 4; i++) await page.keyboard.press("PageUp");
  await page.keyboard.press("Home");
  for (let i = 0; i < 4; i++) await page.keyboard.press("Shift+PageDown");
  await page.keyboard.press("Shift+End");
  await page.keyboard.press("Backspace");
  await expect(page.locator(".monaco-editor .view-line")).toHaveCount(1);
  await expect(page.locator(".monaco-editor .view-lines")).toHaveText(/^\s*$/);
  await page.evaluate((text) => {
    const data = new DataTransfer();
    data.setData("text/plain", text);
    document.activeElement?.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, code);
  await expect(page.locator(".monaco-editor .view-lines")).not.toHaveText(
    /^\s*$/,
  );
}

/** Pastes the current puzzle's reference fix and runs the tests. */
export async function solveWithFix(page: Page) {
  const puzzle = await currentPuzzle(page);
  await setCode(page, puzzle.fix);
  await page.getByRole("button", { name: "Run Tests" }).click();
  return puzzle;
}
