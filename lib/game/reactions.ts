import { REACTION_EMOJIS, type ReactionEmoji } from "./room-fun";

/**
 * At most this many reactions per player in any `windowMs`. Senders hold
 * themselves to it (plus `REACTION_SEND_MARGIN_MS`), and receivers drop
 * whatever a sender puts on the wire over it, so a modified client cannot
 * flood the others.
 */
export const REACTION_RATE = { max: 5, windowMs: 3_000 } as const;

/**
 * Senders use a slightly longer window than receivers check, so network
 * jitter (two messages arriving closer together than they were sent) never
 * gets an honest sender's reactions dropped.
 */
export const REACTION_SEND_MARGIN_MS = 500;

/**
 * Realtime deliveries per second the whole room may spend on reactions. Every
 * message reaches every other player, so one message costs about as many
 * deliveries as there are players online. Half of the Supabase Free plan's
 * 100 messages/s leaves room for the game's own traffic (see "Capacity" in
 * docs/ARCHITECTURE.md).
 */
export const REACTION_ROOM_BUDGET_PER_S = 50;

/**
 * The room budget is checked per second, not per `REACTION_RATE.windowMs`:
 * with a longer window, clients waiting for budget all send as soon as it
 * frees up, and that second goes over the quota even when the average holds.
 */
export const REACTION_ROOM_WINDOW_MS = 1_000;

/** What goes over the wire: who sent it and which reactions, oldest first. */
export interface ReactionMessage {
  sender: string;
  emojis: ReactionEmoji[];
}

const ALLOWED: ReadonlySet<string> = new Set(REACTION_EMOJIS);

function isReactionEmoji(value: unknown): value is ReactionEmoji {
  return typeof value === "string" && ALLOWED.has(value);
}

/**
 * The message in a broadcast payload, or null when it is not exactly
 * `{ sender, emojis }` with a non-empty sender and 1 to `REACTION_RATE.max`
 * allowed emoji. Anything else is ignored whole: no extra fields, no custom
 * emoji, no partial messages.
 */
export function parseReactionMessage(payload: unknown): ReactionMessage | null {
  if (typeof payload !== "object" || payload === null) return null;
  if (Array.isArray(payload)) return null;
  const keys = Object.keys(payload);
  if (keys.length !== 2 || !("sender" in payload) || !("emojis" in payload)) {
    return null;
  }
  const { sender, emojis } = payload;
  if (typeof sender !== "string" || sender.length === 0) return null;
  if (sender.length > 64) return null;
  if (!Array.isArray(emojis)) return null;
  if (emojis.length === 0 || emojis.length > REACTION_RATE.max) return null;
  if (!emojis.every(isReactionEmoji)) return null;
  return { sender, emojis: [...emojis] };
}

/**
 * Sliding-window limit: given the times of earlier reactions, how many of
 * `count` new ones at `now` fit, and the history to keep (only times still
 * inside the window).
 */
export function takeWithinRate(
  history: readonly number[],
  now: number,
  count: number,
  windowMs: number = REACTION_RATE.windowMs,
  max: number = REACTION_RATE.max,
): { allowed: number; history: number[] } {
  const recent = history.filter((at) => now - at < windowMs);
  const allowed = Math.max(0, Math.min(count, max - recent.length));
  for (let i = 0; i < allowed; i++) recent.push(now);
  return { allowed, history: recent };
}

/**
 * How many reaction messages the whole room may send per second with
 * `online` players, so that their deliveries stay within
 * `REACTION_ROOM_BUDGET_PER_S`. Never below 1: a lone reaction always gets
 * through eventually.
 */
export function roomMessageAllowance(
  online: number,
  budgetPerS: number = REACTION_ROOM_BUDGET_PER_S,
): number {
  return Math.max(1, Math.floor(budgetPerS / Math.max(online, 1)));
}

/**
 * Milliseconds until one more event fits under "at most `max` per
 * `windowMs`", given when the earlier ones happened. 0 means now.
 */
export function msUntilAllowed(
  times: readonly number[],
  now: number,
  max: number,
  windowMs: number,
): number {
  const recent = times
    .filter((at) => now - at < windowMs)
    .sort((a, b) => a - b);
  if (recent.length < max) return 0;
  // Wait until enough of the oldest ones leave the window.
  return recent[recent.length - max] + windowMs - now;
}

/**
 * Milliseconds until the room has budget for one more reaction message, given
 * when the room's recent messages (anyone's, including our own) were seen.
 * Only the last second counts, so callers may drop older times.
 */
export function roomSendDelayMs(
  seen: readonly number[],
  now: number,
  online: number,
): number {
  return msUntilAllowed(
    seen,
    now,
    roomMessageAllowance(online),
    REACTION_ROOM_WINDOW_MS,
  );
}
