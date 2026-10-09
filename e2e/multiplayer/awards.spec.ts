import type { Page } from "@playwright/test";
import {
  COUNTDOWN,
  LIVE,
  expect,
  giveUp,
  heading,
  openRoom,
  puzzleOn,
  requireSupabase,
  solve,
  startGame,
  stopGame,
  test,
  type Player,
} from "../support";

requireSupabase();

function rowOf(page: Page, list: string, name: string) {
  return page
    .getByRole("list", { name: list, exact: true })
    .getByRole("listitem")
    .filter({ hasText: name });
}

/** The award names on each player's row of `list`, as `page` shows them. */
async function awardsOn(page: Page, list: string, names: string[]) {
  const shown: Record<string, string> = {};
  for (const name of names) {
    const awards = rowOf(page, list, name).getByTestId("room-awards");
    shown[name] = (await awards.count())
      ? ((await awards.textContent()) ?? "")
      : "";
  }
  return shown;
}

/**
 * Waits until every browser shows `award` for `holder` (awards load after
 * the screen), then checks they all show the same awards; returns them.
 */
async function expectSameAwards(
  racers: Player[],
  list: string,
  holder: Player,
  award: string,
) {
  for (const { page } of racers) {
    await expect(
      rowOf(page, list, holder.name).getByTestId("room-awards"),
    ).toContainText(award, LIVE);
  }
  const names = racers.map((racer) => racer.name);
  const [first, ...others] = await Promise.all(
    racers.map(({ page }) => awardsOn(page, list, names)),
  );
  for (const shown of others) expect(shown).toEqual(first);
  return first;
}

/** The last result of a round ends it, so its message may not stay up. */
async function giveUpLast(page: Page) {
  await page.getByRole("button", { name: "Give up" }).click();
  await page
    .getByRole("dialog", { name: "Give up?" })
    .getByRole("button", { name: "Give up" })
    .click();
}

async function solveRound(player: Player) {
  const puzzle = await puzzleOn(player.page);
  await solve(player.page, puzzle.fix);
}

async function expectHeading(racers: Player[], text: string) {
  for (const { page } of racers) {
    await expect(heading(page)).toHaveText(text, COUNTDOWN);
  }
}

test("room awards: the same on every browser, per game, with a win streak", async ({
  players,
}) => {
  test.setTimeout(180_000);
  const racers = await players(3);
  const [ana, ben, cleo] = racers;
  await openRoom(racers, null);

  // Game 1, round 1: Ana solves first and fastest, Ben later, Cleo gives up.
  await startGame(ana, racers);
  await solveRound(ana);
  await solveRound(ben);
  await giveUpLast(cleo.page);
  await expectHeading(racers, "Round 1 results");
  await expect(
    ana.page.getByText("🩸 First Blood!", { exact: true }),
  ).toBeVisible(LIVE);
  let awards = await expectSameAwards(
    racers,
    "Round 1 results",
    ana,
    "First Blood",
  );
  expect(awards[ana.name]).toContain("First Blood");
  expect(awards[ana.name]).toContain("Speed Demon");
  expect(awards[ana.name]).not.toContain("No Hints Needed");
  expect(awards[ben.name]).toBe("");
  expect(awards[cleo.name]).toBe("");

  // Round 2: only Ana solves; two rounds without a hint.
  await ana.page.getByRole("button", { name: "Next round" }).click();
  await expectHeading(racers, "Round 2");
  await solveRound(ana);
  await giveUp(ben.page);
  await giveUpLast(cleo.page);
  await expectHeading(racers, "Round 2 results");
  await ana.page.getByRole("button", { name: "Final results" }).click();
  await expectHeading(racers, "Final leaderboard");
  awards = await expectSameAwards(
    racers,
    "Final leaderboard",
    ana,
    "No Hints Needed",
  );
  expect(awards[ana.name]).not.toContain("Win streak");
  await expect(
    ana.page
      .getByRole("list", { name: "1st place" })
      .getByTestId("room-awards"),
  ).toContainText("First Blood");

  // Game 2: Ana wins again, a 2-game streak; game awards start over.
  await ana.page.getByRole("button", { name: "Play again" }).click();
  await expect(heading(ana.page)).toHaveText("Room ready", LIVE);
  await expectHeading([ben, cleo], "Lobby");
  await startGame(ana, racers);
  await solveRound(ana);
  await stopGame(ana);
  await expectHeading(racers, "Final leaderboard");
  await expect(ana.page.getByText("🔥 x2 Win streak!")).toBeVisible(LIVE);
  awards = await expectSameAwards(
    racers,
    "Final leaderboard",
    ana,
    "Win streak: 2 games won in a row",
  );
  expect(awards[ana.name]).toContain("First Blood");
  expect(awards[ana.name]).not.toContain("No Hints Needed");
  expect(awards[ben.name]).toBe("");
  for (const { page } of racers) {
    await expect(
      rowOf(page, "Final leaderboard", ana.name).getByText("🔥 x2"),
    ).toBeVisible();
  }
});
