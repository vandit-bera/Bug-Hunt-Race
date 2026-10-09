import { expect, test, type Page } from "@playwright/test";
import {
  createRoomFromScreen,
  expectLobby,
  joinByLink,
  joinRoom,
  LIVE,
  lobbyPlayers,
} from "../support";

/**
 * Room flow smoke test. It writes a room, two players and one round to the
 * site's Supabase, so it only runs with `SMOKE_ROOMS=1`, and never in CI.
 * Against the live site it needs Vandit's OK first (docs/LAUNCH.md §6).
 *
 *   SMOKE_ROOMS=1 pnpm test:smoke --base-url https://<site>
 */

test.skip(
  process.env.SMOKE_ROOMS !== "1",
  "Writes to Supabase: set SMOKE_ROOMS=1 to run it.",
);

/** A Realtime round trip on a deployed site, with room for a cold start. */
const SEEN = { timeout: 10_000 };

async function click(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
}

async function expectStatus(pages: Page[], status: string) {
  for (const page of pages) {
    await expect(page.getByTestId("room-status")).toContainText(status, SEEN);
  }
}

test("create a room, join from a second browser, play and stop a round, close the room", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  try {
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    const code = await createRoomFromScreen(host, "Smoke host", {
      level: "easy",
      totalRounds: 3,
    });
    await joinByLink(guest, code, "Smoke guest");
    await expectLobby(guest, code);
    for (const [page, other] of [
      [host, "Smoke guest"],
      [guest, "Smoke host"],
    ] as const) {
      await expect(lobbyPlayers(page).getByText(other)).toBeVisible(SEEN);
    }

    // The real screens have no round controls yet (TB-35/TB-36), so drive
    // the round from the room lab. Rejoining from the same browser keeps
    // each player's seat, so the host is still the admin there.
    await joinRoom(host, code, "Smoke host");
    await joinRoom(guest, code, "Smoke guest");
    const both = [host, guest];
    await expectStatus(both, "lobby");
    await expect(host.getByTestId("me")).toHaveText("Smoke host", LIVE);
    await expect(host.getByText("(admin)")).toBeVisible();

    await click(host, "Start game");
    await expectStatus(both, "countdown");
    await click(host, "Start round");
    await expectStatus(both, "round_live");
    const puzzle = await host.getByTestId("round-puzzle").textContent();
    expect(puzzle).not.toBe("No round on.");
    await expect(guest.getByTestId("round-puzzle")).toHaveText(
      puzzle ?? "",
      SEEN,
    );

    await click(host, "Stop game");
    await expectStatus(both, "final_leaderboard");
    await click(host, "Close room");
    for (const page of both) {
      await expect(page.getByText("Room closed.")).toBeVisible(SEEN);
    }
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()]);
  }
});
