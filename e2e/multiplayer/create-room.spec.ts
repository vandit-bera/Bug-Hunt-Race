import jsQR from "jsqr";
import type { Page } from "@playwright/test";
import {
  LIVE,
  allowClipboard,
  createRoomFromScreen,
  expect,
  fillCreateRoomForm,
  joinRoom,
  readClipboard,
  requireSupabase,
  test,
  waitForPlayers,
} from "../support";

requireSupabase();

/** Draws the panel's QR SVG on a canvas and decodes it with jsQR. */
async function decodeQr(page: Page, label: string): Promise<string | null> {
  const svg = page.getByRole("img", { name: label }).first();
  const { width, height, pixels } = await svg.evaluate(async (element) => {
    const size = 400;
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      new XMLSerializer().serializeToString(element),
    )}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d context");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, size, size);
    // A wider white margin than the SVG's own, so the scanner finds it easily.
    context.drawImage(image, 40, 40, size - 80, size - 80);
    const data = context.getImageData(0, 0, size, size).data;
    return { width: size, height: size, pixels: Array.from(data) };
  });
  return jsQR(new Uint8ClampedArray(pixels), width, height)?.data ?? null;
}

function inviteLinkFor(page: Page, code: string) {
  return `${new URL(page.url()).origin}/join/${code}`;
}

test("Create Room opens the ready panel with code, link and a QR of the link", async ({
  players,
}) => {
  const [ana] = await players(1);
  const errors: string[] = [];
  ana.page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  const code = await createRoomFromScreen(ana.page, ana.name, {
    language: "python",
    level: "mixed",
    totalRounds: 10,
  });

  await expect(ana.page.getByTestId("room-settings")).toHaveText(
    "Python · Mixed · 10 rounds",
  );
  await expect(ana.page.getByText(code, { exact: true }).first()).toBeVisible();
  const link = inviteLinkFor(ana.page, code);
  await expect(ana.page.getByLabel("Invite link")).toHaveValue(link);
  await expect(ana.page.getByText("1 / 30")).toBeVisible(LIVE);
  expect(await decodeQr(ana.page, `QR code to join room ${code}`)).toBe(link);
  expect(errors).toEqual([]);
});

test("Play until I stop is saved as an endless room", async ({ players }) => {
  const [ana] = await players(1);
  await createRoomFromScreen(ana.page, ana.name, { totalRounds: null });
  await expect(ana.page.getByTestId("room-settings")).toHaveText(
    "JavaScript · Easy · Play until the admin stops",
  );
});

test("Copy puts the exact invite link on the clipboard", async ({
  players,
  browserName,
}) => {
  const [ana] = await players(1);
  await allowClipboard(ana.context, browserName);
  const code = await createRoomFromScreen(ana.page, ana.name);

  await ana.page.getByRole("button", { name: "Copy" }).click();

  await expect(ana.page.getByText("Copied! ✅").first()).toBeVisible();
  expect(await readClipboard(ana.page, browserName)).toBe(
    inviteLinkFor(ana.page, code),
  );
});

test("clipboard denied: the link is shown pre-selected", async ({
  players,
}) => {
  const [ana] = await players(1);
  await ana.page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("denied")) },
    });
  });
  const code = await createRoomFromScreen(ana.page, ana.name);

  await ana.page.getByRole("button", { name: "Copy" }).click();

  const input = ana.page.getByLabel("Invite link");
  await expect(input).toBeFocused();
  await expect(ana.page.getByText("The link is selected")).toBeVisible();
  expect(
    await input.evaluate((el: HTMLInputElement) =>
      el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0),
    ),
  ).toBe(inviteLinkFor(ana.page, code));
});

test("full-screen QR opens and closes with Escape", async ({ players }) => {
  const [ana] = await players(1);
  const code = await createRoomFromScreen(ana.page, ana.name);

  await ana.page.getByRole("button", { name: "Show full-screen QR" }).click();
  const dialog = ana.page.getByRole("dialog", { name: "Scan to join" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(code, { exact: true })).toBeVisible();
  await ana.page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("Share shows only where the browser supports it", async ({ players }) => {
  const [ana, ben] = await players(2);
  await ana.page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      value: () => Promise.resolve(),
    });
  });
  await ben.page.addInitScript(() => {
    delete (Navigator.prototype as Partial<Navigator>).share;
  });

  await createRoomFromScreen(ana.page, ana.name);
  await createRoomFromScreen(ben.page, ben.name);

  await expect(ana.page.getByRole("button", { name: "Share" })).toBeVisible();
  await expect(ben.page.getByRole("button", { name: "Share" })).toHaveCount(0);
});

test("the Lock switch locks and unlocks the room for new players", async ({
  players,
}) => {
  const [ana, ben] = await players(2);
  const code = await createRoomFromScreen(ana.page, ana.name);
  const lock = ana.page.getByRole("switch", { name: /Lock room/ });

  await lock.check();
  await expect(ana.page.getByText("Nobody new can join.")).toBeVisible();
  await joinRoom(ben.page, code, ben.name);
  await expect(ben.page.getByText("Room is locked")).toBeVisible();

  await lock.uncheck();
  await expect(lock).not.toBeChecked();
  await expect(async () => {
    await ben.page.getByRole("button", { name: "Join room" }).click();
    await waitForPlayers(ben.page, 2);
  }).toPass(LIVE);
  await expect(ana.page.getByText("2 / 30")).toBeVisible(LIVE);
});

test("the admin keeps the ready panel after a reload", async ({ players }) => {
  const [ana] = await players(1);
  const code = await createRoomFromScreen(ana.page, ana.name);

  await ana.page.reload();

  await expect(
    ana.page.getByRole("heading", { name: "Room ready" }),
  ).toBeVisible();
  await expect(ana.page.getByLabel("Invite link")).toHaveValue(
    inviteLinkFor(ana.page, code),
  );
});

test("too many rooms: a friendly rate-limit message", async ({ players }) => {
  const [ana] = await players(1);
  await ana.page.route("**/rest/v1/rpc/create_room", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ code: "P0001", message: "rate_limited" }),
    }),
  );
  await ana.page.goto("/room/new");
  await fillCreateRoomForm(ana.page, ana.name);
  await ana.page.getByRole("button", { name: "Create room" }).click();

  await expect(
    ana.page.getByText(
      "You're creating rooms too fast. Try again in a minute.",
    ),
  ).toBeVisible();
  await expect(ana.page).toHaveURL(/\/room\/new$/);
});

test("names with < or > get an inline message on the name field", async ({
  players,
}) => {
  const [ana] = await players(1);
  await ana.page.goto("/room/new");
  await fillCreateRoomForm(ana.page, "<b>Ana</b>");
  await ana.page.getByRole("button", { name: "Create room" }).click();
  await expect(ana.page.getByText("Names can't contain < or >.")).toBeVisible();

  // The database refuses names too (e.g. control characters): same place.
  await ana.page.route("**/rest/v1/rpc/create_room", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ code: "P0001", message: "invalid_display_name" }),
    }),
  );
  await ana.page.getByLabel("Your name").fill(ana.name);
  await ana.page.getByRole("button", { name: "Create room" }).click();
  await expect(ana.page.getByLabel("Your name")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(ana.page.getByText("Names can't contain < or >")).toBeVisible();
});

test("Create Room fits a 360px phone", async ({ players }) => {
  const [ana] = await players(1);
  await ana.page.setViewportSize({ width: 360, height: 800 });
  await ana.page.goto("/room/new");

  const choices = ana.page
    .getByRole("group", { name: "Language" })
    .locator("label > span");
  await expect(choices).toHaveCount(3);
  for (const choice of await choices.all()) {
    expect(
      await choice.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  }
  expect(
    await ana.page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
