import path from "node:path";
import type { Page } from "@playwright/test";
import { loadPuzzles } from "@/lib/puzzles/load";
import {
  LIVE,
  createRoomFromScreen,
  expect,
  joinByLink,
  parseTimerSeconds,
  requireSupabase,
  setCode,
  test,
  type Player,
} from "../support";

requireSupabase();

const PUZZLES = loadPuzzles(path.resolve("puzzles")).flatMap(({ puzzle }) =>
  puzzle ? [puzzle] : [],
);

/** The 3-2-1-Go countdown, then the round loads. */
const COUNTDOWN = { timeout: 10_000 };

function heading(page: Page) {
  return page.getByRole("heading", { level: 1 });
}

function timerOf(player: Player) {
  return player.page.getByTestId("round-time-left");
}

/** The puzzle on `page`, by its title (the database picks at random). */
async function puzzleOn(page: Page) {
  const title = page.getByRole("main").getByRole("heading", { level: 2 });
  await expect(title).toBeVisible(COUNTDOWN);
  const text = (await title.textContent()) ?? "";
  const puzzle = PUZZLES.find(
    ({ meta }) => meta.title === text && meta.language === "javascript",
  );
  if (!puzzle) throw new Error(`No JavaScript puzzle titled "${text}"`);
  return puzzle;
}

async function readTimers(players: Player[]): Promise<(number | null)[]> {
  const texts = await Promise.all(players.map((p) => timerOf(p).textContent()));
  return texts.map((text) => parseTimerSeconds(text ?? ""));
}

/** All timers show a time, within `tolerance` seconds of each other. */
async function expectTimersAgree(players: Player[], tolerance = 1) {
  await expect
    .poll(
      async () => {
        const shown = await readTimers(players);
        if (shown.some((s) => s === null)) return Infinity;
        const seconds = shown as number[];
        return Math.max(...seconds) - Math.min(...seconds);
      },
      { message: "every player's timer within 1 s", timeout: 5_000 },
    )
    .toBeLessThanOrEqual(tolerance);
}

/** Creates a JavaScript room and seats `guests` through invite links. */
async function openRoom(
  [admin, ...guests]: Player[],
  totalRounds: number | null = 3,
) {
  const code = await createRoomFromScreen(admin.page, admin.name, {
    language: "javascript",
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

/**
 * A player's name keeps a readable width in a results list on phones: the
 * status and points wrap below it instead of squeezing it (QA, TB-35).
 */
async function expectNameFits(page: Page, list: string, name: string) {
  const viewport = page.viewportSize();
  for (const width of [320, 414]) {
    await page.setViewportSize({ width, height: 800 });
    const box = await page
      .getByRole("list", { name: list })
      .getByText(name, { exact: true })
      .boundingBox();
    expect(box?.width, `${name} at ${width} px`).toBeGreaterThanOrEqual(60);
  }
  if (viewport) await page.setViewportSize(viewport);
}

async function startGame(admin: Player, racers: Player[]) {
  await admin.page.getByRole("button", { name: "Start game" }).click();
  for (const { page } of racers) {
    await expect(heading(page)).toHaveText("Get ready", LIVE);
  }
  for (const { page } of racers) {
    await expect(heading(page)).toHaveText(/^Round \d+$/, COUNTDOWN);
    await expect(page.getByTestId("round-time-left")).toBeVisible();
  }
}

async function solve(page: Page, fix: string) {
  await setCode(page, fix);
  await page.getByRole("button", { name: "Run Tests" }).click();
  await expect(page.getByText("🎉 Solved!")).toBeVisible(COUNTDOWN);
}

async function giveUp(page: Page) {
  await page.getByRole("button", { name: "Give up" }).click();
  await page
    .getByRole("dialog", { name: "Give up?" })
    .getByRole("button", { name: "Give up" })
    .click();
  await expect(page.getByText("You gave up this one.")).toBeVisible(LIVE);
}

test("a race: same countdown, puzzle and clock; solve, pause, skip, late joiner, stop", async ({
  players,
}) => {
  test.setTimeout(120_000);
  const [ana, ben, cleo, dev] = await players(4);
  const racers = [ana, ben, cleo];
  const code = await openRoom(racers);

  // Ben's page must never receive the fix while the round is on.
  const benBodies: string[] = [];
  ben.page.on("response", (response) => {
    void response.text().then(
      (body) => benBodies.push(body),
      () => {},
    );
  });

  await startGame(ana, racers);
  const puzzle = await puzzleOn(ana.page);
  for (const { page } of [ben, cleo]) {
    expect((await puzzleOn(page)).meta.id).toBe(puzzle.meta.id);
  }
  await expectTimersAgree(racers);
  const [started] = await readTimers([ana]);
  expect(started).toBeGreaterThan(puzzle.meta.timeLimitSec - 10);
  expect(started).toBeLessThanOrEqual(puzzle.meta.timeLimitSec);

  // Ben solves: his result is in, and the admin sees it.
  await solve(ben.page, puzzle.fix);
  await expect(ben.page.getByText(/Waiting for others/)).toBeVisible();
  const progress = ana.page.getByRole("list", { name: "Player progress" });
  await expect(
    progress.getByRole("listitem").filter({ hasText: ben.name }),
  ).toContainText("Solved in", LIVE);
  await expect(
    progress.getByRole("listitem").filter({ hasText: cleo.name }),
  ).toContainText("Still fixing");
  await expectNameFits(ana.page, "Player progress", ben.name);

  // Pause freezes every clock on the same value; Resume runs them again.
  await ana.page.getByRole("button", { name: "Pause" }).click();
  for (const { page } of racers) {
    await expect(
      page.getByRole("status").getByText("Paused", { exact: true }),
    ).toBeVisible(LIVE);
  }
  await expect(
    cleo.page.getByRole("button", { name: "Run Tests" }),
  ).toBeDisabled();
  await expectTimersAgree(racers, 0);
  const frozen = await readTimers(racers);
  const pausedAt = Date.now();
  await expect
    .poll(
      async () => ({
        waited: Date.now() - pausedAt >= 2_000,
        shown: await readTimers(racers),
      }),
      { message: "timers stay frozen while paused", timeout: 5_000 },
    )
    .toEqual({ waited: true, shown: frozen });
  await ana.page.getByRole("button", { name: "Resume" }).click();
  await expect
    .poll(async () => (await readTimers([cleo]))[0], LIVE)
    .toBeLessThan(frozen[2]!);
  await expectTimersAgree(racers);

  // Dev joins mid-round: they wait in the lobby for the next round.
  await joinByLink(dev.page, code, dev.name);
  await expect(heading(dev.page)).toHaveText("Lobby", LIVE);
  await expect(
    dev.page.getByText(
      "A round is in progress. You'll play from the next round.",
    ),
  ).toBeVisible(LIVE);
  await expect(dev.page.getByTestId("round-time-left")).toHaveCount(0);

  // Nothing Ben's browser received during the round holds the fix.
  expect(benBodies.length).toBeGreaterThan(0);
  expect(benBodies.some((body) => body.includes(puzzle.fix.trim()))).toBe(
    false,
  );

  // Skip ends the round for everyone, Dev included.
  await ana.page.getByRole("button", { name: "Skip round" }).click();
  for (const { page } of [...racers, dev]) {
    await expect(heading(page)).toHaveText("Round 1 results", LIVE);
  }
  const results = cleo.page.getByRole("list", { name: "Round results" });
  await expect(results.getByRole("listitem").first()).toContainText(ben.name);
  await expect(
    results.getByRole("listitem").filter({ hasText: cleo.name }),
  ).toContainText("Not solved");
  await expectNameFits(cleo.page, "Round results", ben.name);
  await cleo.page.getByRole("button", { name: "Show the fix" }).click();
  await expect(cleo.page.getByTestId("round-fix")).toHaveText(puzzle.fix);

  // Next round: Dev plays this time.
  await ana.page.getByRole("button", { name: "Next round" }).click();
  for (const { page } of [...racers, dev]) {
    await expect(heading(page)).toHaveText("Round 2", COUNTDOWN);
  }
  const second = await puzzleOn(dev.page);
  expect(second.meta.id).not.toBe(puzzle.meta.id);
  expect((await puzzleOn(ana.page)).meta.id).toBe(second.meta.id);
  await expectTimersAgree([...racers, dev]);

  // Stop from a paused round: straight to the final leaderboard.
  await ana.page.getByRole("button", { name: "Pause" }).click();
  await expect(
    dev.page.getByRole("status").getByText("Paused", { exact: true }),
  ).toBeVisible(LIVE);
  await ana.page.getByRole("button", { name: "Stop game" }).click();
  await ana.page
    .getByRole("dialog", { name: "Stop the game?" })
    .getByRole("button", { name: "Stop game" })
    .click();
  for (const { page } of [...racers, dev]) {
    await expect(heading(page)).toHaveText("Final leaderboard", LIVE);
  }
  await expect(
    ben.page.getByRole("list", { name: "Leaderboard" }).getByRole("listitem"),
  ).toHaveCount(4);
  await expectNameFits(cleo.page, "Leaderboard", ben.name);
  await expect(
    ben.page
      .getByRole("list", { name: "Leaderboard" })
      .getByRole("listitem")
      .first(),
  ).toContainText(ben.name);
});

test("everyone done ends the round early; nobody solved shows the fix", async ({
  players,
}) => {
  const racers = await players(2);
  const [ana, ben] = racers;
  await openRoom(racers);
  await startGame(ana, racers);
  const puzzle = await puzzleOn(ben.page);

  await giveUp(ben.page);
  await expect(heading(ana.page)).toHaveText("Round 1", LIVE);
  await giveUp(ana.page);

  for (const { page } of racers) {
    await expect(heading(page)).toHaveText("Round 1 results", LIVE);
    await expect(
      page.getByRole("heading", { name: "Nobody solved it. Here is the fix:" }),
    ).toBeVisible();
    await expect(page.getByTestId("round-fix")).toHaveText(puzzle.fix, LIVE);
  }
  await expect(
    ben.page.getByText("Waiting for the admin to start the next round…"),
  ).toBeVisible();
});

test("the admin plays too, and Stop from a live round ends the game", async ({
  players,
}) => {
  const racers = await players(2);
  const [ana, ben] = racers;
  await openRoom(racers, null);
  await startGame(ana, racers);
  const puzzle = await puzzleOn(ana.page);

  await solve(ana.page, puzzle.fix);
  await expect(
    ana.page
      .getByRole("list", { name: "Player progress" })
      .getByRole("listitem")
      .filter({ hasText: ana.name }),
  ).toContainText("Solved in", LIVE);

  await ana.page.getByRole("button", { name: "Stop game" }).click();
  await ana.page
    .getByRole("dialog", { name: "Stop the game?" })
    .getByRole("button", { name: "Stop game" })
    .click();
  for (const { page } of racers) {
    await expect(heading(page)).toHaveText("Final leaderboard", LIVE);
  }
  await expect(
    ben.page
      .getByRole("list", { name: "Leaderboard" })
      .getByRole("listitem")
      .first(),
  ).toContainText(ana.name);

  // Play again brings everyone back to the lobby.
  await ana.page.getByRole("button", { name: "Play again" }).click();
  await expect(heading(ana.page)).toHaveText("Room ready", LIVE);
  await expect(heading(ben.page)).toHaveText("Lobby", LIVE);
});
