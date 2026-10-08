import { expect, test, type Page } from "@playwright/test";
import { loadPuzzles } from "@/lib/puzzles/load";

const puzzles = loadPuzzles("puzzles").flatMap((entry) =>
  entry.puzzle ? [entry.puzzle] : [],
);

/** The puzzle on screen: the game picks at random, so read its title. */
async function currentPuzzle(page: Page) {
  await expect(page.getByRole("timer")).toBeVisible(COUNTDOWN_WAIT);
  const heading = page.getByRole("main").getByRole("heading", { level: 1 });
  await expect(heading).toBeVisible();
  const title = (await heading.textContent()) ?? "";
  const puzzle = puzzles.find(({ meta }) => meta.title === title);
  if (!puzzle) throw new Error(`No puzzle titled "${title}"`);
  return puzzle;
}

const LABELS: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
};

/** Time for the 3-2-1-Go countdown before the puzzle appears. */
const COUNTDOWN_WAIT = { timeout: 10_000 };

async function start(
  page: Page,
  language: string,
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
async function setCode(page: Page, code: string) {
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

async function solveWithFix(page: Page) {
  const puzzle = await currentPuzzle(page);
  await setCode(page, puzzle.fix);
  await page.getByRole("button", { name: "Run Tests" }).click();
  return puzzle;
}

test("home links to Solo Practice and shows Race Room as coming soon", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Coming soon")).toBeVisible();
  await page.getByRole("link", { name: "Solo Practice" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Solo Practice" }),
  ).toBeVisible();
});

for (const language of ["javascript", "typescript"] as const) {
  test(`${language}: setup, fix the bug, see the result`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await start(page, language, "Easy");
    await solveWithFix(page);
    await expect(
      page.getByRole("heading", { name: "Bug squashed!" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/\d+ points/).first()).toBeVisible();
    await expect(page.getByText("New personal best!")).toBeVisible();

    await page.getByRole("link", { name: "Play again" }).click();
    await expect(page.getByRole("timer")).toBeVisible(COUNTDOWN_WAIT);
    expect(errors).toEqual([]);
  });
}

test("a failing fix lists the failed tests and keeps the game going", async ({
  page,
}) => {
  await start(page, "javascript", "Easy");
  await expect(page.getByRole("timer")).toBeVisible();
  await page.getByRole("button", { name: "Run Tests" }).click();
  await expect(page.getByText("Failed: ").first()).toBeAttached({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: "Run Tests" })).toBeEnabled();
});

test("Ctrl/Cmd+Enter runs the tests", async ({ page }) => {
  await start(page, "javascript", "Easy");
  await page.locator(".monaco-editor .view-lines").click();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByText("Failed: ").first()).toBeAttached({
    timeout: 15_000,
  });
});

for (const [opener, title] of [
  ["Give up", "Give up?"],
  ["Hint (costs points)", "Show the hint?"],
] as const) {
  test(`Ctrl/Cmd+Enter does nothing while "${title}" is open`, async ({
    page,
  }) => {
    await start(page, "javascript", "Easy");
    const puzzle = await currentPuzzle(page);
    await setCode(page, puzzle.fix);
    await page.getByRole("button", { name: opener }).click();
    const dialog = page.getByRole("dialog", { name: title });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Keep trying" }).click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByText("Press Run Tests (Ctrl/Cmd+Enter) to check your fix."),
    ).toBeVisible();

    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(
      page.getByRole("heading", { name: "Bug squashed!" }),
    ).toBeVisible({ timeout: 15_000 });
  });
}

test("a hint costs points after a confirm", async ({ page }) => {
  await start(page, "javascript", "Easy");
  const puzzle = await currentPuzzle(page);
  await page.getByRole("button", { name: "Hint (costs points)" }).click();
  await expect(page.getByText(/costs 25 points/)).toBeVisible();
  await page.getByRole("button", { name: "Show hint" }).click();
  await expect(page.getByText(puzzle.meta.hint)).toBeVisible();
  await setCode(page, puzzle.fix);
  await page.getByRole("button", { name: "Run Tests" }).click();
  await expect(page.getByText("Hint penalty", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
});

test("give up shows 0 points", async ({ page }) => {
  await start(page, "javascript", "Easy");
  await page.getByRole("button", { name: "Give up" }).click();
  await page.getByRole("button", { name: "Give up" }).last().click();
  await expect(
    page.getByRole("heading", { name: "You gave up" }),
  ).toBeVisible();
  await expect(page.getByText("0 points")).toBeVisible();
});

test("time running out ends the game with 0 points", async ({ page }) => {
  await page.clock.install();
  await start(page, "javascript", "Easy", { skipCountdown: false });
  await page.clock.runFor(4_000);
  await expect(page.getByRole("timer")).toHaveText("3:00");
  await page.clock.fastForward(181_000);
  await expect(page.getByRole("heading", { name: "Time's up" })).toBeVisible();
  await expect(page.getByText("0 points")).toBeVisible();
});

test("an infinite loop shows Time limit exceeded and the page stays usable", async ({
  page,
}) => {
  await start(page, "javascript", "Easy");
  await setCode(page, "while (true) {}");
  await page.getByRole("button", { name: "Run Tests" }).click();
  await expect(page.getByText(/Time limit exceeded/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: "Run Tests" })).toBeEnabled();
  await page.getByRole("button", { name: "Reset code" }).click();
  await expect(page.getByText(/Time limit exceeded/)).toBeHidden();
});

test("Mixed steps Easy, Medium, Hard on Play again", async ({ page }) => {
  await start(page, "javascript", "Mixed");
  await expect(page.locator("header").getByText("Easy")).toBeVisible();
  await page.getByRole("button", { name: "Give up" }).click();
  await page.getByRole("button", { name: "Give up" }).last().click();
  await page.getByRole("link", { name: "Play again" }).click();
  await expect(page.locator("header").getByText("Medium")).toBeVisible(
    COUNTDOWN_WAIT,
  );
});

test("Python: setup, fix the bug, see the result", async ({ page }) => {
  test.setTimeout(90_000);
  await start(page, "python", "Easy");
  await solveWithFix(page);
  await expect(
    page.getByRole("heading", { name: "Bug squashed!" }),
  ).toBeVisible({ timeout: 60_000 });
});

test("a countdown runs before the puzzle appears", async ({ page }) => {
  await start(page, "javascript", "Easy", { skipCountdown: false });
  await expect(page.getByText("Get ready…")).toBeVisible();
  await expect(page.getByRole("timer")).toBeHidden();
  await expect(page.getByRole("timer")).toBeVisible(COUNTDOWN_WAIT);
});

test("solving shows confetti and counts the score up", async ({ page }) => {
  await start(page, "javascript", "Easy");
  await solveWithFix(page);
  await expect(page.getByTestId("confetti")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("score-popup")).toBeVisible();
  await expect(page.getByText(/\d+ points/).first()).toBeVisible();
});

test("reduced motion: no confetti or popup, score shown at once", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await start(page, "javascript", "Easy");
  await solveWithFix(page);
  await expect(
    page.getByRole("heading", { name: "Bug squashed!" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("confetti")).toHaveCount(0);
  await expect(page.getByTestId("score-popup")).toHaveCount(0);
  await expect(page.getByText(/\d+ points/).first()).toBeVisible();
});

test("pass and fail sounds play on Run Tests once the player has interacted", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const played: string[] = [];
    Object.assign(window, { played });
    window.Audio = class {
      src: string;
      volume = 1;
      constructor(src: string) {
        this.src = src;
      }
      play() {
        played.push(this.src);
        return Promise.resolve();
      }
    } as unknown as typeof Audio;
  });
  await start(page, "javascript", "Easy");
  await page.getByRole("button", { name: "Run Tests" }).click();
  await expect(page.getByText("Failed: ").first()).toBeAttached({
    timeout: 15_000,
  });
  await solveWithFix(page);
  await expect(
    page.getByRole("heading", { name: "Bug squashed!" }),
  ).toBeVisible({ timeout: 15_000 });
  const played = await page.evaluate(
    () => (window as unknown as { played: string[] }).played,
  );
  expect(played.map((src) => src.split("/").pop())).toEqual(
    expect.arrayContaining(["fail.wav", "solved.wav"]),
  );
});

test("the first game's countdown ticks after the Start click", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const played: string[] = [];
    Object.assign(window, { played });
    window.Audio = class {
      src: string;
      volume = 1;
      constructor(src: string) {
        this.src = src;
      }
      play() {
        played.push(this.src);
        return Promise.resolve();
      }
    } as unknown as typeof Audio;
  });
  await page.goto("/solo");
  await page.getByRole("link", { name: "Start" }).click();
  await expect(page.getByRole("timer")).toBeVisible(COUNTDOWN_WAIT);
  const played = await page.evaluate(
    () => (window as unknown as { played: string[] }).played,
  );
  expect(played.map((src) => src.split("/").pop())).toEqual([
    "tick.wav",
    "tick.wav",
    "tick.wav",
    "go.wav",
  ]);
});

test("the game header fits a 375 px screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await start(page, "javascript", "Easy");
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(375);
  await expect(page.getByRole("radio", { name: /System/ })).toBeInViewport();
});

test("the score popup sits beside the score, not over the heading", async ({
  page,
}) => {
  await start(page, "javascript", "Easy");
  await solveWithFix(page);
  const heading = page.getByRole("heading", { name: "Bug squashed!" });
  await expect(heading).toBeVisible({ timeout: 15_000 });
  const popup = await page.getByTestId("score-popup").boundingBox();
  const title = await heading.boundingBox();
  expect(popup && title && popup.y >= title.y + title.height).toBe(true);
});

for (const width of [320, 375]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`setup cards fit at ${width}px in ${colorScheme} theme`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.emulateMedia({ colorScheme });
      await page.goto("/solo");
      await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        colorScheme,
      );
      const cards = page.locator("fieldset label > span");
      await expect(cards).toHaveCount(7);
      for (const card of await cards.all()) {
        await expect(card).toBeVisible();
        const { scrollWidth, clientWidth } = await card.evaluate((el) => ({
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
      }
      const pageOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(pageOverflow).toBe(false);
    });
  }
}
