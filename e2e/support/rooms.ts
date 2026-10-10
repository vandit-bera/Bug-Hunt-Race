import { expect, type Page } from "@playwright/test";
import type { LabSettings } from "@/app/dev/rooms/lab-settings";
import { waitForHydration } from "./hydration";

/** Realtime round trips land within about a second; slack for busy runners. */
export const LIVE = { timeout: 5_000 };

/**
 * A dropped player is back after the Supabase client's reconnect backoff
 * (up to 10 s) and a resubscribe.
 */
export const RECONNECT = { timeout: 20_000 };

/**
 * The database hands the admin role over after 15 s without a heartbeat,
 * applied on the next heartbeat (every 5 s) from someone in the room.
 */
export const HAND_OVER = { timeout: 30_000 };

export type RoomSettings = Partial<LabSettings>;

/** The room lab (`/dev/rooms`); the real room screens will replace it. */
export function labUrl(settings: RoomSettings = {}): string {
  const query = new URLSearchParams();
  if (settings.language) query.set("language", settings.language);
  if (settings.level) query.set("level", settings.level);
  if (settings.totalRounds !== undefined) {
    query.set("rounds", String(settings.totalRounds ?? "endless"));
  }
  const search = query.toString();
  return search ? `/dev/rooms?${search}` : "/dev/rooms";
}

/**
 * Creates a fresh room with `name` as its admin and returns its code. Every
 * call makes a new room, so tests never share one.
 */
export async function createRoom(
  page: Page,
  name: string,
  settings: RoomSettings = {},
): Promise<string> {
  await page.goto(labUrl(settings));
  await waitForHydration(page.getByLabel("Your name"));
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Create room" }).click();
  const heading = page.getByRole("heading", { name: /^Room [A-Z2-9]{6}$/ });
  await expect(heading).toBeVisible();
  return ((await heading.textContent()) ?? "").replace("Room ", "");
}

const LANGUAGE_LABELS = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
} as const;

const LEVEL_LABELS = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  mixed: "Mixed",
} as const;

/**
 * Creates a room through the real Create Room screen (`/room/new`) and waits
 * for the admin lobby. Returns the room code from the URL.
 */
export async function createRoomFromScreen(
  page: Page,
  name: string,
  settings: RoomSettings = {},
): Promise<string> {
  await page.goto("/room/new");
  await fillCreateRoomForm(page, name, settings);
  await page.getByRole("button", { name: "Create room" }).click();
  await page.waitForURL(/\/room\/[A-Z2-9]{6}$/);
  await expect(page.getByRole("heading", { name: "Room ready" })).toBeVisible();
  return new URL(page.url()).pathname.split("/").pop() ?? "";
}

/** Picks settings and fills in the admin's name, without submitting. */
export async function fillCreateRoomForm(
  page: Page,
  name: string,
  settings: RoomSettings = {},
) {
  await waitForHydration(page.getByLabel("Your name"));
  if (settings.language) {
    await page
      .getByRole("group", { name: "Language" })
      .getByLabel(LANGUAGE_LABELS[settings.language], { exact: true })
      .check();
  }
  if (settings.level) {
    await page
      .getByRole("group", { name: "Level" })
      .getByLabel(LEVEL_LABELS[settings.level], { exact: true })
      .check();
  }
  if (settings.totalRounds !== undefined) {
    await page
      .getByRole("group", { name: "Rounds" })
      .getByLabel(
        settings.totalRounds === null
          ? "Play until I stop"
          : String(settings.totalRounds),
        { exact: true },
      )
      .check();
  }
  await page.getByLabel("Your name").fill(name);
}

/**
 * Fills in the join form. Does not wait for success, so tests can also
 * check rejections (locked or full room); follow with `waitForPlayers`.
 */
export async function joinRoom(page: Page, code: string, name: string) {
  if (!page.url().includes("/dev/rooms")) await page.goto(labUrl());
  await waitForHydration(page.getByLabel("Your name"));
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Room code").fill(code);
  await page.getByRole("button", { name: "Join room" }).click();
}

/** Every player in the room as `page` sees it. */
export function playerList(page: Page) {
  return page.getByRole("list", { name: "Players" }).getByRole("listitem");
}

/** One player's row; contains "admin" and "online" / "offline" badges. */
export function playerRow(page: Page, name: string) {
  return playerList(page).filter({
    has: page.getByText(name, { exact: true }),
  });
}

/** Waits until `page` lists exactly `count` players. */
export async function waitForPlayers(
  page: Page,
  count: number,
  options = LIVE,
) {
  await expect(playerList(page)).toHaveCount(count, options);
}
