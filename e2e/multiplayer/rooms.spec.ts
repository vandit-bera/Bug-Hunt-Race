import {
  HAND_OVER,
  LIVE,
  createRoom,
  expect,
  joinRoom,
  playerList,
  playerRow,
  requireSupabase,
  test,
  waitForPlayers,
} from "../support";

requireSupabase();

test("two players see each other join and leave in real time", async ({
  players,
}) => {
  const [ana, ben] = await players(2);
  const code = await createRoom(ana.page, ana.name);
  await expect(playerRow(ana.page, "Ana")).toContainText("admin");

  await joinRoom(ben.page, code, ben.name);
  await waitForPlayers(ben.page, 2);
  await expect(playerRow(ana.page, "Ben")).toBeVisible(LIVE);
  await expect(playerRow(ana.page, "Ben")).toContainText("online", LIVE);

  await ben.page.getByRole("button", { name: "Leave room" }).click();
  await expect(playerRow(ana.page, "Ben")).toHaveCount(0, LIVE);
  await waitForPlayers(ana.page, 1);
});

test("only the admin can lock the room, and a locked room rejects new players", async ({
  players,
}) => {
  const [ana, ben, cleo] = await players(3);
  const code = await createRoom(ana.page, ana.name);
  await joinRoom(ben.page, code, ben.name);
  await waitForPlayers(ben.page, 2);
  await expect(ben.page.getByRole("button", { name: "Lock room" })).toHaveCount(
    0,
  );

  await ana.page.getByRole("button", { name: "Lock room" }).click();
  await expect(ben.page.getByTestId("room-status")).toContainText(
    "locked",
    LIVE,
  );

  await joinRoom(cleo.page, code, cleo.name);
  await expect(cleo.page.getByText("Room is locked")).toBeVisible();
});

test("admin Start reaches every player", async ({ players }) => {
  const [ana, ben] = await players(2);
  const code = await createRoom(ana.page, ana.name);
  await joinRoom(ben.page, code, ben.name);
  await waitForPlayers(ben.page, 2);

  await ana.page.getByRole("button", { name: "Start game" }).click();
  await expect(ben.page.getByTestId("room-status")).toHaveText(
    "Status: countdown",
    LIVE,
  );
});

test("a player who reloads keeps their identity", async ({ players }) => {
  const [ana, ben] = await players(2);
  const code = await createRoom(ana.page, ana.name);
  await joinRoom(ben.page, code, ben.name);
  await expect(playerRow(ana.page, "Ben")).toBeVisible(LIVE);

  await ben.page.reload();

  await expect(ben.page.getByTestId("me")).toHaveText("Ben");
  await waitForPlayers(ben.page, 2);
  await waitForPlayers(ana.page, 2);
  await expect(playerRow(ana.page, "Ben (2)")).toHaveCount(0);
});

test("the admin role passes on when the admin drops for more than 15 s", async ({
  players,
}) => {
  test.setTimeout(60_000);
  const [ana, ben] = await players(2);
  const code = await createRoom(ana.page, ana.name);
  await joinRoom(ben.page, code, ben.name);
  await expect(playerRow(ben.page, "Ana")).toContainText("online", LIVE);

  await ana.context.close();

  // Presence notices at once; the database waits 15 s before handing over.
  await expect(playerRow(ben.page, "Ana")).toContainText("offline", LIVE);
  await expect(playerRow(ben.page, "Ben")).not.toContainText("admin");
  await expect(playerRow(ben.page, "Ben")).toContainText("admin", HAND_OVER);
  await expect(
    ben.page.getByRole("button", { name: "Start game" }),
  ).toBeVisible();
});

test("a room is created with the requested settings", async ({ players }) => {
  const [ana] = await players(1);
  await createRoom(ana.page, ana.name, {
    language: "python",
    level: "mixed",
    totalRounds: null,
  });
  await expect(ana.page.getByTestId("room-settings")).toHaveText(
    "Settings: python · mixed · endless",
  );
  await expect(playerList(ana.page)).toHaveCount(1);
});
