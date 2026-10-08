import {
  LIVE,
  RECONNECT,
  createRoom,
  expect,
  joinRoom,
  playerRow,
  reconnect,
  requireSupabase,
  setOffline,
  test,
  waitForPlayers,
} from "../support";

requireSupabase();

// The example from e2e/README.md: three players, one drop and reconnect,
// then the admin leaves for good.
test("three players: a drop and reconnect, then the admin hands over on leaving", async ({
  players,
}) => {
  test.setTimeout(60_000);
  const [ana, ben, cleo] = await players(3);

  const code = await createRoom(ana.page, ana.name);
  await joinRoom(ben.page, code, ben.name);
  await joinRoom(cleo.page, code, cleo.name);
  for (const { page } of [ana, ben, cleo]) await waitForPlayers(page, 3);
  await expect(playerRow(cleo.page, "Ana")).toContainText("admin");

  // Ben loses the network: the others see him offline, but he keeps his seat.
  await setOffline(ben.page);
  await expect(playerRow(ana.page, "Ben")).toContainText("offline", LIVE);
  await expect(playerRow(cleo.page, "Ben")).toContainText("offline", LIVE);
  await waitForPlayers(ana.page, 3);

  // Back online: he rejoins as himself, not as a new "Ben (2)".
  await reconnect(ben.page);
  await expect(playerRow(ana.page, "Ben")).toContainText("online", RECONNECT);
  await expect(playerRow(ben.page, "Cleo")).toContainText("online", RECONNECT);
  await expect(ben.page.getByTestId("me")).toHaveText("Ben");
  await waitForPlayers(ana.page, 3);

  // Ana leaves: the earliest-joined connected player, Ben, becomes admin
  // straight away (no 15 s wait, unlike a drop).
  await ana.page.getByRole("button", { name: "Leave room" }).click();
  for (const { page } of [ben, cleo]) {
    await waitForPlayers(page, 2);
    await expect(playerRow(page, "Ben")).toContainText("admin", LIVE);
    await expect(playerRow(page, "Cleo")).not.toContainText("admin");
  }
  await expect(
    ben.page.getByRole("button", { name: "Start game" }),
  ).toBeVisible();
  await expect(
    cleo.page.getByRole("button", { name: "Start game" }),
  ).toHaveCount(0);
});
