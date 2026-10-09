import type { Page } from "@playwright/test";
import type { Score } from "@/lib/db";
import { computeRaceScore } from "@/lib/game/scoring";
import {
  COUNTDOWN,
  LIVE,
  expect,
  expectNameFits,
  heading,
  openRoom,
  puzzleOn,
  requireSupabase,
  setCode,
  startGame,
  stopGame,
  test,
  type Player,
} from "../support";

requireSupabase();

/** The leaderboard is read again every 2 s while a round is on. */
const POLL = { timeout: 6_000 };

/** The results `page` sent (`record_score` answers with the stored row). */
function sentResults(page: Page): Score[] {
  const sent: Score[] = [];
  page.on("response", (response) => {
    if (!response.url().includes("/rest/v1/rpc/record_score")) return;
    if (!response.ok()) return;
    void response.json().then(
      (score: Score) => sent.push(score),
      () => {},
    );
  });
  return sent;
}

/**
 * Solves the round on the player's page and returns the points the server
 * stored, after checking they are what the scoring function gives for the
 * server-measured solve time.
 */
async function solveAndScore(player: Player, sent: Score[]) {
  const puzzle = await puzzleOn(player.page);
  const before = sent.length;
  // The last result ends the round, so "Solved!" may not stay on screen.
  await setCode(player.page, puzzle.fix);
  await player.page.getByRole("button", { name: "Run Tests" }).click();
  await expect.poll(() => sent.length, COUNTDOWN).toBe(before + 1);
  const score = sent[before];
  expect(score.passed).toBe(true);
  expect(score.points, `${player.name}'s points`).toBe(
    computeRaceScore({
      passed: true,
      basePoints: puzzle.meta.basePoints,
      timeLimitSec: puzzle.meta.timeLimitSec,
      solveMs: score.solve_time_ms,
      hintUsed: score.hint_used,
    }).total,
  );
  return score.points;
}

function rowOf(page: Page, list: string, name: string) {
  return page
    .getByRole("list", { name: list, exact: true })
    .getByRole("listitem")
    .filter({ hasText: name });
}

test("a full 2-player game: live leaderboard, round results, podium, play again, close", async ({
  players,
}) => {
  test.setTimeout(150_000);
  const racers = await players(2);
  const [ana, ben] = racers;
  const sentBy = new Map(racers.map((p) => [p.name, sentResults(p.page)]));
  await openRoom(racers);

  // Round 1: Ana solves first; Ben's live leaderboard shows it.
  await startGame(ana, racers);
  for (const { page } of racers) {
    await expect(rowOf(page, "Live leaderboard", ana.name)).toContainText(
      "0 points",
      LIVE,
    );
  }
  const ana1 = await solveAndScore(ana, sentBy.get(ana.name)!);
  await expect(rowOf(ben.page, "Live leaderboard", ana.name)).toContainText(
    `${ana1} points`,
    POLL,
  );
  await expect(
    ben.page
      .getByRole("list", { name: "Live leaderboard", exact: true })
      .getByRole("listitem")
      .filter({ hasText: "1 solved" }),
  ).toContainText(ana.name);

  // Ben solves too: everyone is done, so the round ends.
  const ben1 = await solveAndScore(ben, sentBy.get(ben.name)!);
  for (const { page } of racers) {
    await expect(heading(page)).toHaveText("Round 1 results", LIVE);
    await expect(rowOf(page, "Round 1 results", ana.name)).toContainText(
      `+${ana1}`,
    );
    await expect(rowOf(page, "Round 1 results", ben.name)).toContainText(
      `+${ben1}`,
    );
  }
  await expectNameFits(ben.page, "Round 1 results", ana.name);

  // Round 2: only Ben solves, then the admin stops the game.
  await ana.page.getByRole("button", { name: "Next round" }).click();
  for (const { page } of racers) {
    await expect(heading(page)).toHaveText("Round 2", COUNTDOWN);
  }
  const ben2 = await solveAndScore(ben, sentBy.get(ben.name)!);
  await expect(rowOf(ana.page, "Live leaderboard", ben.name)).toContainText(
    `${ben1 + ben2} points`,
    POLL,
  );
  await stopGame(ana);

  // Final: totals are the sum of each player's rounds; unsolved counts 0.
  const totals = [
    { player: ben, points: ben1 + ben2, solved: 2 },
    { player: ana, points: ana1, solved: 1 },
  ];
  for (const { page } of racers) {
    await expect(heading(page)).toHaveText("Final leaderboard", LIVE);
    const list = page.getByRole("list", {
      name: "Final leaderboard",
      exact: true,
    });
    await expect(list.getByRole("listitem")).toHaveCount(2);
    for (const [index, { player, points, solved }] of totals.entries()) {
      const item = rowOf(page, "Final leaderboard", player.name);
      await expect(item).toContainText(`Place ${index + 1}`);
      await expect(item).toContainText(`${points} points`);
      await expect(item).toContainText(`${solved} solved`);
    }
    await expect(page.getByRole("list", { name: "1st place" })).toContainText(
      ben.name,
    );
    await expect(page.getByRole("list", { name: "2nd place" })).toContainText(
      ana.name,
    );
  }
  await expectNameFits(ana.page, "Final leaderboard", ben.name);
  await expect(
    ben.page.getByRole("button", { name: "Play again" }),
  ).toHaveCount(0);
  await expect(
    ben.page.getByRole("button", { name: "Close room" }),
  ).toHaveCount(0);

  // Play again: same two players, back in the lobby, scores back to 0.
  await ana.page.getByRole("button", { name: "Play again" }).click();
  await expect(heading(ana.page)).toHaveText("Room ready", LIVE);
  await expect(heading(ben.page)).toHaveText("Lobby", LIVE);
  for (const { page } of racers) {
    await expect(
      page.getByRole("list", { name: "Players" }).getByRole("listitem"),
    ).toHaveCount(2);
  }
  await startGame(ana, racers);
  for (const { page } of racers) {
    for (const { name } of racers) {
      await expect(rowOf(page, "Live leaderboard", name)).toContainText(
        "0 points",
        LIVE,
      );
      await expect(rowOf(page, "Live leaderboard", name)).toContainText(
        "0 solved",
      );
    }
  }

  // Close room: everyone in it sees it closed.
  await stopGame(ana);
  await expect(
    ana.page.getByText("Nobody scored this game. Better luck next time!"),
  ).toBeVisible(LIVE);
  await ana.page.getByRole("button", { name: "Close room" }).click();
  for (const { page } of racers) {
    await expect(
      page.getByRole("heading", { name: "Room closed" }),
    ).toBeVisible(LIVE);
  }
});
