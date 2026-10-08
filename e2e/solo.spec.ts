import { expect, test, type Page } from "@playwright/test";
import { loadPuzzles } from "@/lib/puzzles/load";

const fixes = new Map(
  loadPuzzles("puzzles").flatMap((entry) =>
    entry.puzzle ? [[entry.puzzle.meta.id, entry.puzzle] as const] : [],
  ),
);

function puzzleFor(language: string, level: string) {
  return [...fixes.values()].find(
    ({ meta }) => meta.language === language && meta.level === level,
  );
}

const LABELS: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
};

async function start(page: Page, language: string, level: string) {
  await page.goto("/solo");
  await page.getByLabel(LABELS[language], { exact: true }).check();
  await page.getByLabel(level, { exact: false }).check();
  await page.getByRole("link", { name: "Start" }).click();
}

async function setCode(page: Page, code: string) {
  await page.locator(".monaco-editor .view-lines").click();
  await page.keyboard.press("ControlOrMeta+A");
  // A paste keeps the text as is; typing it would auto-indent Python.
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
}

async function solveWithFix(page: Page, language: string, level: string) {
  const puzzle = puzzleFor(language, level);
  if (!puzzle) throw new Error(`No ${language} ${level} puzzle`);
  await expect(
    page.getByRole("heading", { level: 1, name: puzzle.meta.title }),
  ).toBeVisible();
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
    await solveWithFix(page, language, "easy");
    await expect(
      page.getByRole("heading", { name: "Bug squashed!" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/\d+ points/).first()).toBeVisible();
    await expect(page.getByText("New personal best!")).toBeVisible();

    await page.getByRole("link", { name: "Play again" }).click();
    await expect(page.getByRole("timer")).toBeVisible();
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

test("a hint costs points after a confirm", async ({ page }) => {
  await start(page, "javascript", "Easy");
  const puzzle = puzzleFor("javascript", "easy")!;
  await page.getByRole("button", { name: "Hint (costs points)" }).click();
  await expect(page.getByText(/costs 25 points/)).toBeVisible();
  await page.getByRole("button", { name: "Show hint" }).click();
  await expect(page.getByText(puzzle.meta.hint)).toBeVisible();
  await setCode(page, puzzle.fix);
  await page.getByRole("button", { name: "Run Tests" }).click();
  await expect(page.getByText("Hint penalty")).toBeVisible({ timeout: 15_000 });
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
  await start(page, "javascript", "Easy");
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
  await expect(page.locator("header").getByText("Medium")).toBeVisible();
});

test("a level without puzzles says so", async ({ page }) => {
  await page.goto("/solo");
  await page.getByLabel("JavaScript", { exact: true }).check();
  await page.getByLabel("Hard", { exact: false }).check();
  await expect(page.getByText(/No puzzles yet/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Start" })).toHaveCount(0);
});

test("Python: setup, fix the bug, see the result", async ({ page }) => {
  test.skip(!puzzleFor("python", "easy"), "No Python puzzles yet (TB-28)");
  test.setTimeout(90_000);
  await start(page, "python", "Easy");
  await solveWithFix(page, "python", "easy");
  await expect(
    page.getByRole("heading", { name: "Bug squashed!" }),
  ).toBeVisible({ timeout: 60_000 });
});
