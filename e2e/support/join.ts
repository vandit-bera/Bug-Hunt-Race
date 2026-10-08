import { createClient } from "@supabase/supabase-js";
import { expect, type Locator, type Page } from "@playwright/test";
import type { Database } from "@/lib/db/types";

/**
 * Helpers for the real join screens (`/join`, `/join/<code>`) and the lobby
 * (`/room/<code>`). Create rooms with `createRoom` (room lab) or
 * `createRoomFromScreen` (`/room/new`).
 */

/** Opens the lobby of a room the page's player is already in. */
export async function openLobby(page: Page, code: string) {
  await page.goto(`/room/${code}`);
  await expectLobby(page, code);
}

/** Waits for the lobby of `code`: "Room ready" for the admin, else "Lobby". */
export async function expectLobby(page: Page, code: string) {
  await expect(page).toHaveURL(`/room/${code}`);
  await expect(
    page.getByRole("heading", { level: 1, name: /^(Room ready|Lobby)$/ }),
  ).toBeVisible();
  await expect(lobbyPlayers(page)).toBeVisible();
}

/** Fills in the name step of `/join/<code>` and joins. Does not wait. */
export async function enterName(page: Page, name: string) {
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Join room" }).click();
}

/** Joins through an invite link (what a QR scan opens too). */
export async function joinByLink(page: Page, code: string, name: string) {
  await page.goto(`/join/${code}`);
  await enterName(page, name);
}

/** Joins by typing the code on `/join`. */
export async function joinByCode(page: Page, code: string, name: string) {
  await page.goto("/join");
  await page.getByLabel("Room code").fill(code);
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page).toHaveURL(`/join/${code}`);
  await enterName(page, name);
}

/** The lobby's player list. */
export function lobbyPlayers(page: Page): Locator {
  return page.getByRole("list", { name: "Players" });
}

/**
 * Reads the invite QR code on `page` (the admin's lobby) the way a phone
 * would: renders the SVG to pixels and decodes them.
 */
export async function scanInviteQr(page: Page): Promise<string> {
  const qr = page.getByRole("img", { name: /^QR code to join room/ });
  await expect(qr).toBeVisible();
  const image = await qr.evaluate(async (svg) => {
    const scale = 8;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const [, , width] = (clone.getAttribute("viewBox") ?? "0 0 0 0")
      .split(" ")
      .map(Number);
    const side = (width ?? 0) * scale;
    clone.setAttribute("width", String(side));
    clone.setAttribute("height", String(side));
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      new XMLSerializer().serializeToString(clone),
    )}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = side;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, side, side);
    context.drawImage(img, 0, 0);
    return { side, data: [...context.getImageData(0, 0, side, side).data] };
  });
  const { default: jsQR } = await import("jsqr");
  const decoded = jsQR(
    Uint8ClampedArray.from(image.data),
    image.side,
    image.side,
  );
  if (!decoded) throw new Error("The invite QR code did not decode.");
  return decoded.data;
}

/**
 * Seats `count` extra players in a room straight through the database API
 * (no browsers), e.g. to fill it to the 30-player limit.
 */
export async function seatPlayers(code: string, count: number) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  for (let i = 0; i < count; i++) {
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: authError } = await client.auth.signInAnonymously();
    if (authError) throw authError;
    const { error } = await client.rpc("join_room", {
      room_code: code,
      display_name: `Seat ${i + 1}`,
      avatar: "🐝",
    });
    if (error) throw new Error(error.message);
  }
}
