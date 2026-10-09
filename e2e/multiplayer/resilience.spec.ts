import {
  LIVE,
  RECONNECT,
  createRoom,
  expect,
  expectLobby,
  joinByLink,
  joinRoom,
  playerRow,
  reconnect,
  requireSupabase,
  setOffline,
  test,
  waitForPlayers,
  type Player,
} from "../support";

requireSupabase();

/** How long the dropped player stays offline. */
const DROP_MS = 10_000;

function pointsOf(viewer: Player, name: string) {
  return viewer.page.getByTestId(`points-${name}`);
}

async function startRound(players: Player[]) {
  const [admin] = players;
  await admin.page.getByRole("button", { name: "Start game" }).click();
  await admin.page.getByRole("button", { name: "Start round" }).click();
  for (const { page } of players) {
    await expect(page.getByTestId("room-status")).toContainText(
      "round_live",
      LIVE,
    );
  }
}

test("a player who drops for 10 s mid-round keeps their seat and score", async ({
  players,
}) => {
  test.setTimeout(90_000);
  const [ana, ben, cleo] = await players(3);
  const all = [ana, ben, cleo];

  const code = await createRoom(ana.page, ana.name, { level: "easy" });
  await joinRoom(ben.page, code, ben.name);
  await joinRoom(cleo.page, code, cleo.name);
  for (const { page } of all) await waitForPlayers(page, 3);
  await startRound(all);

  // Ben solves first, so he has points to lose.
  await ben.page.getByRole("button", { name: "Submit solve" }).click();
  await expect(ben.page.getByText("Result sent.")).toBeVisible(LIVE);
  await expect(pointsOf(ben, "Ben")).toHaveText(/^[1-9]\d*$/, LIVE);
  const points = (await pointsOf(ben, "Ben").textContent()) ?? "";

  // Ben drops: he sees the banner, the others see him go offline.
  await setOffline(ben.page);
  await expect(ben.page.getByText("Reconnecting")).toBeVisible(LIVE);
  for (const other of [ana, cleo]) {
    await expect(playerRow(other.page, "Ben")).toContainText("offline", LIVE);
  }
  await ben.page.waitForTimeout(DROP_MS);
  await expect(ana.page.getByTestId("room-status")).toContainText("round_live");

  // Back: same seat, same score, same round, and the others see him online.
  await reconnect(ben.page);
  await expect(ben.page.getByText("Reconnecting")).toHaveCount(0, RECONNECT);
  for (const other of [ana, cleo]) {
    await expect(playerRow(other.page, "Ben")).toContainText(
      "online",
      RECONNECT,
    );
  }
  await expect(ben.page.getByTestId("me")).toHaveText("Ben");
  await expect(ben.page.getByTestId("room-status")).toContainText("round_live");
  await expect(ben.page.getByText("Result sent.")).toBeVisible();
  await expect(pointsOf(ben, "Ben")).toHaveText(points);
  for (const { page } of all) await waitForPlayers(page, 3);
  await expect(playerRow(ana.page, "Ben (2)")).toHaveCount(0);

  // The round goes on: the others finish it and Ben's score still stands.
  for (const player of [ana, cleo]) {
    await player.page.getByRole("button", { name: "Submit solve" }).click();
  }
  await expect(ben.page.getByTestId("room-status")).toContainText(
    "round_results",
    LIVE,
  );
  await expect(pointsOf(ana, "Ben")).toHaveText(points, LIVE);
});

test("a result whose answer was lost is counted once", async ({ players }) => {
  test.setTimeout(60_000);
  const [ana, ben] = await players(2);

  const code = await createRoom(ana.page, ana.name, { level: "easy" });
  await joinRoom(ben.page, code, ben.name);
  for (const { page } of [ana, ben]) await waitForPlayers(page, 2);
  await startRound([ana, ben]);

  // The first submit reaches the database, but the answer never comes back
  // (as when the network drops mid-request). The client retries.
  let lost = 0;
  await ben.page.route("**/rest/v1/rpc/record_score", async (route) => {
    if (lost > 0) return route.continue();
    lost++;
    await route.fetch();
    await route.abort("connectionreset");
  });

  await ben.page.getByRole("button", { name: "Submit solve" }).click();
  await expect(ben.page.getByText("Result sent.")).toBeVisible(LIVE);
  expect(lost).toBe(1);
  await expect(
    ben.page.getByRole("region", { name: "Round" }).getByRole("alert"),
  ).toHaveCount(0);

  // One solve, counted once: on Ben's screen now, on Ana's once the round
  // ends (the lab reloads the leaderboard on room changes).
  await expect(ben.page.getByTestId("solved-Ben")).toHaveText("1", LIVE);
  const points = (await pointsOf(ben, "Ben").textContent()) ?? "";
  expect(Number(points)).toBeGreaterThan(0);
  await ana.page.getByRole("button", { name: "Submit solve" }).click();
  await expect(ana.page.getByTestId("room-status")).toContainText(
    "round_results",
    LIVE,
  );
  await expect(ana.page.getByTestId("solved-Ben")).toHaveText("1", LIVE);
  await expect(pointsOf(ana, "Ben")).toHaveText(points);
});

test("Supabase unreachable: a friendly error with Retry, which recovers", async ({
  players,
}) => {
  const [ana] = await players(1);
  await createRoom(ana.page, ana.name);
  await waitForPlayers(ana.page, 1);

  // Supabase goes down, then Ana reloads the room.
  const supabase = /\/(rest|auth)\/v1\//;
  await ana.page.route(supabase, (route) => route.abort("connectionrefused"));
  await ana.page.reload();

  const offline = ana.page.getByRole("heading", {
    name: "Can't reach the game",
  });
  await expect(offline).toBeVisible(LIVE);
  await expect(ana.page.locator("body")).not.toContainText("fetch");
  const retry = ana.page.getByRole("button", { name: "Retry" });

  // Still down: Retry leaves the same friendly screen.
  await retry.click();
  await expect(retry).toBeEnabled(LIVE);
  await expect(offline).toBeVisible();

  // Back up: Retry puts Ana back in her room, as herself.
  await ana.page.unroute(supabase);
  await retry.focus();
  await ana.page.keyboard.press("Enter");
  await expect(ana.page.getByTestId("me")).toHaveText("Ana", LIVE);
  await waitForPlayers(ana.page, 1);
  await expect(playerRow(ana.page, "Ana")).toContainText("online", RECONNECT);
});

test("the lobby stops saying Reconnecting once the player is back", async ({
  players,
}) => {
  test.setTimeout(60_000);
  const [ana, ben] = await players(2);
  const code = await createRoom(ana.page, ana.name);
  await joinByLink(ben.page, code, ben.name);
  await expectLobby(ben.page, code);
  await waitForPlayers(ben.page, 2);

  const lost = ben.page.getByText("Connection lost. Reconnecting…");
  await setOffline(ben.page);
  await expect(lost).toBeVisible(RECONNECT);

  await reconnect(ben.page);
  await expect(lost).toHaveCount(0, RECONNECT);
  await waitForPlayers(ben.page, 2);
});
