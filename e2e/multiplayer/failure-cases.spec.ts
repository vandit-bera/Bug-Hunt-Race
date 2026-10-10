import {
  COUNTDOWN,
  LIVE,
  expect,
  giveUp,
  heading,
  joinByLink,
  openRoom,
  puzzleOn,
  requireSupabase,
  setCode,
  solve,
  startGame,
  test,
} from "../support";

// TB-19 §18 failure cases on the real room screens that no other spec covers.
// The full map is in docs/TEST_PLAN.md.
requireSupabase();

test("§18 rejoin: closing the tab and opening the invite link again keeps the seat and score", async ({
  players,
}) => {
  const racers = await players(2);
  const [ana, ben] = racers;
  const code = await openRoom(racers);
  await startGame(ana, racers);
  const puzzle = await puzzleOn(ben.page);

  await solve(ben.page, puzzle.fix);
  await giveUp(ana.page);
  await expect(heading(ana.page)).toHaveText("Round 1 results", LIVE);
  const benRow = ana.page
    .getByRole("list", { name: "Round 1 results" })
    .getByRole("listitem")
    .filter({ hasText: ben.name });
  await expect(benRow).toContainText(/\+\d+/, LIVE);
  const points = /\+(\d+)/.exec((await benRow.textContent()) ?? "")?.[1];
  expect(Number(points)).toBeGreaterThan(0);

  // Ben closes the tab, then opens the invite link again in the same browser.
  await ben.page.close();
  const page = await ben.context.newPage();
  await page.goto(`/join/${code}`);
  await expect(heading(page)).toHaveText("Round 1 results", LIVE);
  const again = page
    .getByRole("list", { name: "Round 1 results" })
    .getByRole("listitem")
    .filter({ hasText: ben.name });
  // The same seat: "Ben (you)", not a new "Ben (2)".
  await expect(again).toContainText(new RegExp(`${ben.name}\\s*\\(you\\)`));
  await expect(again).toContainText(`+${points}`);
  await expect(
    ana.page
      .getByRole("list", { name: "Round 1 results" })
      .getByRole("listitem"),
  ).toHaveCount(2);
});

test("§18 infinite loop in a race round: Time limit exceeded, and the player can still solve", async ({
  players,
}) => {
  const racers = await players(2);
  const [ana, ben] = racers;
  await openRoom(racers);
  await startGame(ana, racers);
  const puzzle = await puzzleOn(ben.page);

  await setCode(ben.page, "while (true) {}");
  await ben.page.getByRole("button", { name: "Run Tests" }).click();
  await expect(ben.page.getByText(/Time limit exceeded/)).toBeVisible({
    timeout: 15_000,
  });
  // The round is still on for everyone, and Ben's next run works.
  await expect(heading(ana.page)).toHaveText("Round 1");
  await solve(ben.page, puzzle.fix);
  await expect(
    ana.page
      .getByRole("list", { name: "Player progress" })
      .getByRole("listitem")
      .filter({ hasText: ben.name }),
  ).toContainText("Solved in", LIVE);
});

test("§18 Python slow to load: the round shows a loading bar until Python is ready", async ({
  players,
}) => {
  test.setTimeout(90_000);
  const racers = await players(2);
  const [ana, ben] = racers;
  // Hold Ben's Pyodide download until the round is on screen. The route goes
  // in before Ben joins, so it still holds once the lobby preloads Python (TB-76).
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await ben.page.route("**/pyodide/**", async (route) => {
    await held;
    await route.continue();
  });
  await openRoom(racers, 3, "python");

  await startGame(ana, racers);
  await expect(ben.page.getByText(/^Loading Python… \d+%$/)).toBeVisible(
    COUNTDOWN,
  );
  await expect(ben.page.getByRole("progressbar")).toBeVisible();

  const puzzle = await puzzleOn(ben.page, "python");
  release();
  await expect(ben.page.getByText(/^Loading Python…/)).toHaveCount(0, {
    timeout: 60_000,
  });
  // Python really runs: the reference fix passes.
  await solve(ben.page, puzzle.fix);
});

test("§18 Python slow to load: Pyodide is preloaded in the lobby", async ({
  players,
}) => {
  test.fail(
    true,
    "App bug TB-76: the room lobby does not preload Pyodide; it starts loading only when the round starts.",
  );
  // test.fail also passes if the join breaks. Checked by hand: today it fails
  // only on the poll below (0 Pyodide requests in the lobby).
  const [ana, ben] = await players(2);
  const pyodide: string[] = [];
  ben.page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/pyodide/"))
      pyodide.push(request.url());
  });

  await openRoom([ana], 3, "python").then((code) =>
    joinByLink(ben.page, code, ben.name),
  );
  await expect(heading(ben.page)).toHaveText("Lobby", LIVE);
  await expect
    .poll(() => pyodide.length, { timeout: 10_000 })
    .toBeGreaterThan(0);
});
