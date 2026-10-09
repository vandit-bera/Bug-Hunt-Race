import {
  LIVE,
  createRoom,
  expect,
  joinRoom,
  requireSupabase,
  test,
  waitForPlayers,
  type Player,
} from "../support";

requireSupabase();

function statusOf(player: Player) {
  return player.page.getByTestId("room-status");
}

function puzzleOf(player: Player) {
  return player.page.getByTestId("round-puzzle");
}

function solved(player: Player, name: string) {
  return player.page.getByTestId(`solved-${name}`);
}

function points(player: Player, name: string) {
  return player.page.getByTestId(`points-${name}`);
}

async function expectStatus(players: Player[], status: string) {
  for (const player of players) {
    await expect(statusOf(player)).toContainText(status, LIVE);
  }
}

async function click(player: Player, name: string) {
  await player.page.getByRole("button", { name, exact: true }).click();
}

async function submit(player: Player) {
  await click(player, "Submit solve");
  await expect(player.page.getByText("Result sent.")).toBeVisible(LIVE);
}

/** Starts a round and returns its puzzle id, once everyone sees it. */
async function startRound(admin: Player, everyone: Player[]) {
  await click(admin, "Start round");
  await expect(puzzleOf(admin)).not.toHaveText("No round on.", LIVE);
  const puzzleId = (await puzzleOf(admin).textContent()) ?? "";
  for (const player of everyone) {
    await expect(puzzleOf(player)).toHaveText(puzzleId, LIVE);
  }
  return puzzleId;
}

test("two games in a row: Play again resets the leaderboard, Close ends the room", async ({
  players,
}) => {
  test.setTimeout(120_000);
  const [ana, ben, cleo, dev] = await players(4);
  const everyone = [ana, ben, cleo];

  const code = await createRoom(ana.page, ana.name, {
    level: "easy",
    totalRounds: 2,
  });
  await joinRoom(ben.page, code, ben.name);
  await joinRoom(cleo.page, code, cleo.name);
  for (const { page } of everyone) await waitForPlayers(page, 3);

  // Game 1: Ana and Ben solve round 1, only Ben solves round 2.
  await click(ana, "Start game");
  const first = await startRound(ana, everyone);
  await submit(ana);
  await submit(ben);
  await click(ana, "Skip round");
  await expectStatus(everyone, "round_results");

  await click(ana, "Next round");
  const second = await startRound(ana, everyone);
  expect(second).not.toBe(first);
  await submit(ben);
  await click(ana, "Skip round");
  await expectStatus(everyone, "round_results");
  await click(ana, "Finish game");
  await expectStatus(everyone, "final_leaderboard");

  for (const player of everyone) {
    await expect(solved(player, "Ben")).toHaveText("2", LIVE);
    await expect(solved(player, "Ana")).toHaveText("1");
    await expect(solved(player, "Cleo")).toHaveText("0");
    await expect(player.page.getByTestId("rank-Ben")).toHaveText("1");
  }

  // Only the admin gets Play again and Close room.
  for (const player of [ben, cleo]) {
    await expect(
      player.page.getByRole("button", { name: "Play again" }),
    ).toHaveCount(0);
    await expect(
      player.page.getByRole("button", { name: "Close room" }),
    ).toHaveCount(0);
  }

  // Play again: same three players, everyone back to 0.
  await click(ana, "Play again");
  await expectStatus(everyone, "lobby");
  for (const player of everyone) {
    await waitForPlayers(player.page, 3);
    for (const name of ["Ana", "Ben", "Cleo"]) {
      await expect(points(player, name)).toHaveText("0", LIVE);
      await expect(solved(player, name)).toHaveText("0");
      await expect(player.page.getByTestId(`rank-${name}`)).toHaveText("1");
    }
  }

  // Game 2 counts only its own results.
  await click(ana, "Start game");
  await startRound(ana, everyone);
  await expect(ana.page.getByText(/^Round 1:/)).toBeVisible();
  await submit(cleo);
  await click(ana, "Stop game");
  await expectStatus(everyone, "final_leaderboard");
  for (const player of everyone) {
    await expect(solved(player, "Cleo")).toHaveText("1", LIVE);
    await expect(solved(player, "Ben")).toHaveText("0");
    await expect(points(player, "Ben")).toHaveText("0");
    await expect(player.page.getByTestId("rank-Cleo")).toHaveText("1");
  }

  // Close room: everyone in it sees it closed; the code and link are refused.
  await click(ana, "Close room");
  for (const { page } of everyone) {
    await expect(page.getByText("Room closed.")).toBeVisible(LIVE);
  }
  await dev.page.goto(`/join/${code}`);
  await expect(
    dev.page.getByRole("heading", { name: "Room closed" }),
  ).toBeVisible();
  await ben.page.goto(`/join/${code}`);
  await expect(
    ben.page.getByRole("heading", { name: "Room closed" }),
  ).toBeVisible();
});
