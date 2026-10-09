import {
  COUNTDOWN,
  LIVE,
  expect,
  expectNameFits,
  giveUp,
  heading,
  joinByLink,
  openRoom,
  parseTimerSeconds,
  puzzleOn,
  requireSupabase,
  solve,
  startGame,
  stopGame,
  test,
  type Player,
} from "../support";

requireSupabase();

function timerOf(player: Player) {
  return player.page.getByTestId("round-time-left");
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
  const results = cleo.page.getByRole("list", { name: "Round 1 results" });
  await expect(results.getByRole("listitem").first()).toContainText(ben.name);
  await expect(
    results.getByRole("listitem").filter({ hasText: cleo.name }),
  ).toContainText("Not solved");
  await expectNameFits(cleo.page, "Round 1 results", ben.name);
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
  await stopGame(ana);
  for (const { page } of [...racers, dev]) {
    await expect(heading(page)).toHaveText("Final leaderboard", LIVE);
  }
  await expect(
    ben.page
      .getByRole("list", { name: "Final leaderboard" })
      .getByRole("listitem"),
  ).toHaveCount(4);
  await expectNameFits(cleo.page, "Final leaderboard", ben.name);
  await expect(ben.page.getByRole("list", { name: "1st place" })).toContainText(
    ben.name,
  );
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
    // §18: nobody solved it, so everyone scores 0.
    const rows = page
      .getByRole("list", { name: "Round 1 results" })
      .getByRole("listitem");
    await expect(rows).toHaveCount(2);
    for (const row of await rows.all()) {
      await expect(row).toContainText("Not solved");
      await expect(row).toContainText(/\D0 points$/);
    }
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

  await stopGame(ana);
  for (const { page } of racers) {
    await expect(heading(page)).toHaveText("Final leaderboard", LIVE);
  }
  await expect(ben.page.getByRole("list", { name: "1st place" })).toContainText(
    ana.name,
  );

  // Play again brings everyone back to the lobby.
  await ana.page.getByRole("button", { name: "Play again" }).click();
  await expect(heading(ana.page)).toHaveText("Room ready", LIVE);
  await expect(heading(ben.page)).toHaveText("Lobby", LIVE);
});
