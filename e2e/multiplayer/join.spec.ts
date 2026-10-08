import type { Page } from "@playwright/test";
import {
  LIVE,
  MAX_PLAYERS,
  createRoom,
  enterName,
  expect,
  expectLobby,
  joinByCode,
  joinByLink,
  lobbyPlayers,
  openLobby,
  requireSupabase,
  scanInviteQr,
  seatPlayers,
  test,
  waitForPlayers,
} from "../support";

requireSupabase();

test.describe("join paths", () => {
  test("code, link and QR all reach the same lobby", async ({ players }) => {
    const [ana, ben, cleo, dev] = await players(4);
    const consoleErrors: string[] = [];
    for (const { page } of [ana, ben, cleo, dev]) {
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
    }
    const code = await createRoom(ana.page, ana.name);
    await openLobby(ana.page, code);

    await joinByCode(ben.page, code, ben.name);
    await expectLobby(ben.page, code);

    await joinByLink(cleo.page, code, cleo.name);
    await expectLobby(cleo.page, code);

    const scanned = await scanInviteQr(ana.page);
    expect(new URL(scanned).pathname).toBe(`/join/${code}`);
    await dev.page.goto(scanned);
    await enterName(dev.page, dev.name);
    await expectLobby(dev.page, code);

    for (const { page } of [ana, ben, cleo, dev]) {
      await waitForPlayers(page, 4);
    }
    expect(consoleErrors).toEqual([]);
  });

  test("the code field cleans what players type", async ({ players }) => {
    const [ana, ben] = await players(2);
    const code = await createRoom(ana.page, ana.name);

    await ben.page.goto("/join");
    const field = ben.page.getByLabel("Room code");
    await field.fill(` ${code.slice(0, 3).toLowerCase()} ${code.slice(3)}`);
    await expect(field).toHaveValue(code);
    await field.fill("BO1I");
    await expect(field).toHaveValue("B");
    await expect(ben.page.getByText(/Codes never use O, 1, I/)).toBeVisible();
  });
});

test.describe("lobby", () => {
  test("players appear and disappear live", async ({ players }) => {
    const [ana, ben] = await players(2);
    const code = await createRoom(ana.page, ana.name);
    await openLobby(ana.page, code);

    await joinByLink(ben.page, code, ben.name);
    await expectLobby(ben.page, code);
    await expect(lobbyPlayers(ana.page)).toContainText("Ben", LIVE);
    await expect(
      ben.page.getByText("Waiting for the admin to start…"),
    ).toBeVisible();
    await expect(
      ben.page.getByLabel("Room settings").filter({ visible: true }),
    ).toContainText("JavaScript");

    await ben.page.getByRole("button", { name: "Leave room" }).click();
    await expect(ben.page).toHaveURL("/");
    await expect(lobbyPlayers(ana.page)).not.toContainText("Ben", LIVE);
    await waitForPlayers(ana.page, 1);
  });

  test("duplicate names get a number, and a reload keeps the identity", async ({
    players,
  }) => {
    const [ana, ben, cleo] = await players(3);
    const code = await createRoom(ana.page, "Riya");
    await joinByLink(ben.page, code, "Riya");
    await expectLobby(ben.page, code);
    await expect(lobbyPlayers(ben.page)).toContainText("Riya (2)(you)");

    await ben.page.reload();
    await expectLobby(ben.page, code);
    await expect(lobbyPlayers(ben.page)).toContainText("Riya (2)(you)");
    await waitForPlayers(ben.page, 2);

    // Opening the invite link again goes straight back to the lobby.
    await ben.page.goto(`/join/${code}`);
    await expectLobby(ben.page, code);
    await waitForPlayers(ben.page, 2);

    await joinByLink(cleo.page, code, "riya");
    await expectLobby(cleo.page, code);
    await expect(lobbyPlayers(cleo.page)).toContainText("riya (3)(you)");
    await openLobby(ana.page, code);
    await waitForPlayers(ana.page, 3);
  });

  test("the admin sees the invite panel and can lock the room", async ({
    players,
  }) => {
    const [ana, ben] = await players(2);
    const code = await createRoom(ana.page, ana.name);
    await openLobby(ana.page, code);
    await joinByLink(ben.page, code, ben.name);
    await expectLobby(ben.page, code);

    await expect(
      ana.page.getByRole("heading", { name: "Invite players" }),
    ).toBeVisible();
    await expect(
      ben.page.getByRole("heading", { name: "Invite players" }),
    ).toHaveCount(0);
    await ana.page.getByRole("switch", { name: /Lock room/ }).click();
    await expect(ana.page.getByText("Nobody new can join.")).toBeVisible(LIVE);
  });

  test("a player who joins mid-round waits for the next round", async ({
    players,
  }) => {
    const [ana, ben] = await players(2);
    const code = await createRoom(ana.page, ana.name);
    await ana.page.getByRole("button", { name: "Start game" }).click();
    await expect(ana.page.getByTestId("room-status")).toContainText(
      "countdown",
      LIVE,
    );

    await ben.page.goto(`/join/${code}`);
    await expect(ben.page.getByText(/A round is in progress/)).toBeVisible();
    await enterName(ben.page, ben.name);
    await expectLobby(ben.page, code);
    await expect(
      ben.page.getByText("A round is in progress. Next round starts soon."),
    ).toBeVisible();
  });
});

test.describe("errors", () => {
  test("unknown code: Room not found, with Try again", async ({ players }) => {
    const [ana] = await players(1);
    await ana.page.goto("/join/ZZZZZZ");
    await expect(
      ana.page.getByRole("heading", { name: "Room not found" }),
    ).toBeVisible();
    await ana.page.getByRole("link", { name: "Try again" }).click();
    await expect(ana.page).toHaveURL("/join");
  });

  test("a lobby link without a seat asks for a name first", async ({
    players,
  }) => {
    const [ana, ben] = await players(2);
    const code = await createRoom(ana.page, ana.name);
    await ben.page.goto(`/room/${code}`);
    await expect(ben.page).toHaveURL(`/join/${code}`);
    await expect(ben.page.getByLabel("Your name")).toBeVisible();
  });

  test("locked room", async ({ players }) => {
    const [ana, ben] = await players(2);
    const code = await createRoom(ana.page, ana.name);
    await ana.page.getByRole("button", { name: "Lock room" }).click();
    await expect(ana.page.getByTestId("room-status")).toContainText(
      "locked",
      LIVE,
    );

    await ben.page.goto(`/join/${code}`);
    await expect(
      ben.page.getByRole("heading", { name: "This room is locked" }),
    ).toBeVisible();
  });

  test("full room (30/30)", async ({ players }) => {
    test.setTimeout(60_000);
    const [ana, ben] = await players(2);
    const code = await createRoom(ana.page, ana.name);
    await seatPlayers(code, MAX_PLAYERS - 1);

    await ben.page.goto(`/join/${code}`);
    await expect(
      ben.page.getByRole("heading", { name: "Room is full (30/30)" }),
    ).toBeVisible();
  });

  test("names with < or > are rejected on the name field", async ({
    players,
  }) => {
    const [ana, ben] = await players(2);
    const code = await createRoom(ana.page, ana.name);
    await joinByLink(ben.page, code, "<b>Ben</b>");

    const name = ben.page.getByLabel("Your name");
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(
      ben.page.getByText("Names can't contain < or >."),
    ).toBeVisible();
    await expect(ben.page).toHaveURL(`/join/${code}`);
  });

  test("rate limited: a friendly try-again message", async ({ players }) => {
    const [ana, ben] = await players(2);
    const code = await createRoom(ana.page, ana.name);
    await ben.page.route("**/rest/v1/rpc/join_room", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ code: "P0001", message: "rate_limited" }),
      }),
    );
    await joinByLink(ben.page, code, ben.name);

    await expect(
      ben.page.getByRole("alert").filter({ hasText: "try again shortly" }),
    ).toBeVisible();
  });
});

test.describe("on a phone, in dark mode", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("join and lobby screens fit without sideways scrolling", async ({
    players,
  }) => {
    const [ana, ben] = await players(2);
    for (const { page } of [ana, ben]) {
      await page.addInitScript(() =>
        window.localStorage.setItem("bhr-theme", "dark"),
      );
    }
    const code = await createRoom(ana.page, ana.name);
    await openLobby(ana.page, code);
    await ben.page.goto(`/join/${code}`);
    await expect(ben.page.getByLabel("Your name")).toBeVisible();
    await expectNoSidewaysScroll(ben.page);

    await enterName(ben.page, ben.name);
    await expectLobby(ben.page, code);
    await waitForPlayers(ana.page, 2);
    for (const { page } of [ana, ben]) {
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await expectNoSidewaysScroll(page);
    }
  });
});

async function expectNoSidewaysScroll(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
}
