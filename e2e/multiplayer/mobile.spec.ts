import {
  COUNTDOWN,
  LIVE,
  expect,
  expectEditorWraps,
  expectFitsPhones,
  giveUp,
  heading,
  openRoom,
  puzzleOn,
  requireSupabase,
  solve,
  stopGame,
  test,
} from "../support";

requireSupabase();

test("every room screen fits a phone in light and dark (TB-74)", async ({
  players,
}) => {
  test.setTimeout(120_000);
  const [ana, ben] = await players(2);
  const errors: string[] = [];
  for (const { page } of [ana, ben]) {
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 375, height: 740 });
  }
  await ben.page.emulateMedia({ colorScheme: "dark" });
  await openRoom([ana, ben]);

  // Create room → ready panel (admin) and the lobby (guest).
  await expectFitsPhones(ana.page, ["Start game", "Copy", "Leave room"]);
  await expectFitsPhones(ben.page, ["Leave room"]);

  await ana.page.getByRole("button", { name: "Start game" }).click();
  for (const { page } of [ana, ben]) {
    await expect(heading(page)).toHaveText(/^Round 1$/, COUNTDOWN);
  }

  // Race round: the laptop note, a wrapping editor and every control.
  for (const { page } of [ana, ben]) {
    await expect(page.getByRole("note")).toContainText("best on a laptop");
    await expectEditorWraps(page);
  }
  await expectFitsPhones(ana.page, ["Run Tests", "Give up", "Stop game"]);
  await expectFitsPhones(ben.page, ["Run Tests", "Give up"]);

  const puzzle = await puzzleOn(ana.page);
  await solve(ana.page, puzzle.fix);
  await giveUp(ben.page);

  // Round results.
  for (const { page } of [ana, ben]) {
    await expect(heading(page)).toHaveText(/^Round 1 results$/, LIVE);
  }
  await expectFitsPhones(ana.page, ["Next round"]);
  await expectFitsPhones(ben.page);

  // Final leaderboard and podium.
  await ana.page.getByRole("button", { name: "Next round" }).click();
  await expect(heading(ana.page)).toHaveText(/^Round 2$/, COUNTDOWN);
  await stopGame(ana);
  for (const { page } of [ana, ben]) {
    await expect(heading(page)).toHaveText("Final leaderboard", LIVE);
  }
  await expectFitsPhones(ana.page, ["Play again"]);
  await expectFitsPhones(ben.page);

  expect(errors).toEqual([]);
});
