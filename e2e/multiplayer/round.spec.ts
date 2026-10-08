import path from "node:path";
import { loadPuzzles } from "@/lib/puzzles/load";
import {
  LIVE,
  createRoom,
  expect,
  joinRoom,
  parseTimerSeconds,
  requireSupabase,
  test,
  waitForPlayers,
  type Player,
} from "../support";

requireSupabase();

const FIXES = new Map(
  loadPuzzles(path.resolve("puzzles")).flatMap(({ puzzle }) =>
    puzzle ? [[puzzle.meta.id, puzzle.fix] as const] : [],
  ),
);

function roundOf(player: Player) {
  return player.page.getByRole("region", { name: "Round" });
}

function puzzleOf(player: Player) {
  return player.page.getByTestId("round-puzzle");
}

function timerOf(player: Player) {
  return player.page.getByTestId("round-time-left");
}

/** Every player's timer, read as close together as possible. */
async function readTimers(players: Player[]): Promise<(number | null)[]> {
  const texts = await Promise.all(players.map((p) => timerOf(p).textContent()));
  return texts.map((text) => parseTimerSeconds(text ?? ""));
}

/** All timers show a time, and they are within `tolerance` seconds. */
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

test("a round: same puzzle and clock for everyone, pause, late joiner, fix after the end", async ({
  players,
}) => {
  test.setTimeout(90_000);
  const [ana, ben, cleo, dev] = await players(4);
  const racers = [ana, ben, cleo];

  const code = await createRoom(ana.page, ana.name, { level: "easy" });
  await joinRoom(ben.page, code, ben.name);
  await joinRoom(cleo.page, code, cleo.name);
  for (const { page } of racers) await waitForPlayers(page, 3);

  await ana.page.getByRole("button", { name: "Start game" }).click();
  await ana.page.getByRole("button", { name: "Start round" }).click();

  // Same puzzle and the same time left (within 1 s) on all three screens.
  await expect(puzzleOf(ana)).not.toHaveText("No round on.", LIVE);
  const puzzleId = (await puzzleOf(ana).textContent()) ?? "";
  expect(FIXES.has(puzzleId)).toBe(true);
  for (const player of racers) {
    await expect(puzzleOf(player)).toHaveText(puzzleId, LIVE);
  }
  await expectTimersAgree(racers);
  const [started] = await readTimers([ana]);
  expect(started).toBeGreaterThan(170);
  expect(started).toBeLessThanOrEqual(180);

  // The fix stays on the server while the round is on.
  await ben.page.getByRole("button", { name: "Show fix" }).click();
  await expect(roundOf(ben).getByRole("alert")).toHaveText(
    "The fix is shown when the round ends",
  );
  await expect(ben.page.getByTestId("round-fix")).toHaveCount(0);

  // Pause: every clock freezes on the same value.
  await ana.page.getByRole("button", { name: "Pause" }).click();
  for (const { page } of racers) {
    await expect(page.getByTestId("room-status")).toContainText("paused", LIVE);
  }
  await expectTimersAgree(racers);
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
  for (const { page } of racers) {
    await expect(page.getByTestId("room-status")).toContainText(
      "round_live",
      LIVE,
    );
  }
  await expectTimersAgree(racers);

  // Dev joins mid-round: they watch, they cannot submit.
  await joinRoom(dev.page, code, dev.name);
  await waitForPlayers(dev.page, 4);
  await expect(roundOf(dev).getByRole("status")).toContainText(
    "You joined mid-round",
  );
  await expect(
    dev.page.getByRole("button", { name: "Submit solve" }),
  ).toBeVisible();
  await dev.page.getByRole("button", { name: "Submit solve" }).click();
  await expect(roundOf(dev).getByRole("alert")).toHaveText(
    "You joined mid-round. You'll play from the next round.",
  );

  // Everyone who was in at the start submits: the round ends by itself.
  for (const player of racers) {
    await player.page.getByRole("button", { name: "Submit solve" }).click();
    await expect(player.page.getByText("Result sent.")).toBeVisible(LIVE);
  }
  for (const { page } of [...racers, dev]) {
    await expect(page.getByTestId("room-status")).toContainText(
      "round_results",
      LIVE,
    );
  }

  // Now the fix comes through, for the late joiner too.
  for (const player of [ben, dev]) {
    await player.page.getByRole("button", { name: "Show fix" }).click();
    await expect(player.page.getByTestId("round-fix")).toHaveText(
      FIXES.get(puzzleId)!,
      LIVE,
    );
  }

  // Without a player's token the route gives nothing.
  const status = await ana.page.evaluate(async () => {
    const response = await fetch("/api/rounds/not-a-round/fix");
    return response.status;
  });
  expect(status).toBe(401);
});
