import { expect, test, type Browser, type Page } from "@playwright/test";

// Needs a running Supabase (pnpm db:start) and its URL and key in the
// environment; CI runs this in the `realtime` job.
test.skip(
  !process.env.NEXT_PUBLIC_SUPABASE_URL,
  "needs a local Supabase (NEXT_PUBLIC_SUPABASE_URL)",
);

// Realtime round trips should land within about a second.
const LIVE = { timeout: 3_000 };

async function openLab(browser: Browser): Promise<Page> {
  // A new context = a new browser profile = a new anonymous player.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/dev/rooms");
  return page;
}

async function createRoom(page: Page, name: string): Promise<string> {
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Create room" }).click();
  const heading = page.getByRole("heading", { name: /^Room [A-Z2-9]{6}$/ });
  await expect(heading).toBeVisible();
  return ((await heading.textContent()) ?? "").replace("Room ", "");
}

async function joinRoom(page: Page, code: string, name: string) {
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Room code").fill(code);
  await page.getByRole("button", { name: "Join room" }).click();
}

const players = (page: Page) =>
  page.getByRole("list", { name: "Players" }).getByRole("listitem");

const player = (page: Page, name: string) =>
  players(page).filter({ has: page.getByText(name, { exact: true }) });

test("two players see each other join and leave in real time", async ({
  browser,
}) => {
  const ana = await openLab(browser);
  const code = await createRoom(ana, "Ana");
  await expect(player(ana, "Ana")).toContainText("admin");

  const ben = await openLab(browser);
  await joinRoom(ben, code, "Ben");

  await expect(players(ben)).toHaveCount(2);
  await expect(player(ana, "Ben")).toBeVisible(LIVE);
  await expect(player(ana, "Ben")).toContainText("online", LIVE);

  await ben.getByRole("button", { name: "Leave room" }).click();
  await expect(player(ana, "Ben")).toHaveCount(0, LIVE);
  await expect(players(ana)).toHaveCount(1);
});

test("only the admin can lock the room, and a locked room rejects new players", async ({
  browser,
}) => {
  const ana = await openLab(browser);
  const code = await createRoom(ana, "Ana");
  const ben = await openLab(browser);
  await joinRoom(ben, code, "Ben");
  await expect(players(ben)).toHaveCount(2);
  await expect(ben.getByRole("button", { name: "Lock room" })).toHaveCount(0);

  await ana.getByRole("button", { name: "Lock room" }).click();
  await expect(ben.getByTestId("room-status")).toContainText("locked", LIVE);

  const cleo = await openLab(browser);
  await joinRoom(cleo, code, "Cleo");
  await expect(cleo.getByText("Room is locked")).toBeVisible();
});

test("admin Start reaches every player", async ({ browser }) => {
  const ana = await openLab(browser);
  const code = await createRoom(ana, "Ana");
  const ben = await openLab(browser);
  await joinRoom(ben, code, "Ben");
  await expect(players(ben)).toHaveCount(2);

  await ana.getByRole("button", { name: "Start game" }).click();
  await expect(ben.getByTestId("room-status")).toHaveText(
    "Status: countdown",
    LIVE,
  );
});

test("a player who reloads keeps their identity", async ({ browser }) => {
  const ana = await openLab(browser);
  const code = await createRoom(ana, "Ana");
  const ben = await openLab(browser);
  await joinRoom(ben, code, "Ben");
  await expect(player(ana, "Ben")).toBeVisible(LIVE);

  await ben.reload();

  await expect(ben.getByTestId("me")).toHaveText("Ben");
  await expect(players(ben)).toHaveCount(2);
  await expect(players(ana)).toHaveCount(2);
  await expect(player(ana, "Ben (2)")).toHaveCount(0);
});

test("the admin role passes on when the admin drops for more than 15 s", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const ana = await openLab(browser);
  const code = await createRoom(ana, "Ana");
  const ben = await openLab(browser);
  await joinRoom(ben, code, "Ben");
  await expect(player(ben, "Ana")).toContainText("online", LIVE);

  await ana.context().close();

  // Presence notices at once; the database waits 15 s before handing over.
  await expect(player(ben, "Ana")).toContainText("offline", LIVE);
  await expect(player(ben, "Ben")).not.toContainText("admin");
  await expect(player(ben, "Ben")).toContainText("admin", { timeout: 30_000 });
  await expect(ben.getByRole("button", { name: "Start game" })).toBeVisible();
});
