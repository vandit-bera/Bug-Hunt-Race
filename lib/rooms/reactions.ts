import {
  msUntilAllowed,
  parseReactionMessage,
  REACTION_RATE,
  REACTION_ROOM_WINDOW_MS,
  REACTION_SEND_MARGIN_MS,
  roomSendDelayMs,
  takeWithinRate,
  type ReactionMessage,
} from "@/lib/game/reactions";
import type { ReactionEmoji } from "@/lib/game/room-fun";

/** The sender's window: receivers check `REACTION_RATE.windowMs`. */
const SEND_WINDOW_MS = REACTION_RATE.windowMs + REACTION_SEND_MARGIN_MS;

/**
 * Spreads out senders who were all waiting for room budget, so they do not
 * all send in the same instant when it frees up. The longer a sender has
 * waited, the smaller its jitter, so in a busy room everyone gets a turn.
 */
const MAX_JITTER_MS = 250;

export interface ReactionHubOptions {
  /** The caller's own player id. */
  selfId: string;
  /** Puts a message on the wire; false when it could not be sent. */
  send: (message: ReactionMessage) => boolean;
  /** Whether a player is in the room right now. */
  isMember: (playerId: string) => boolean;
  /** Players with the room open right now (the caller included). */
  onlineCount: () => number;
  /** Reactions to show, the caller's own included. */
  onShow: (sender: string, emojis: ReactionEmoji[]) => void;
  now?: () => number;
  random?: () => number;
}

export interface ReactionHub {
  /** Shows and sends a reaction. False when over the sender's rate limit. */
  react(emoji: ReactionEmoji): boolean;
  /** Handles a broadcast payload from another client. */
  receive(payload: unknown): void;
  dispose(): void;
}

/**
 * Reactions for one player in one room.
 *
 * Sending: at most `REACTION_RATE.max` per window (a bit longer than
 * receivers check). A reaction shows locally at once and goes out at once
 * when the room has Realtime budget; otherwise it waits, and reactions that
 * pile up meanwhile go out together in one message (the newest
 * `REACTION_RATE.max`; older ones are dropped, they are stale by then).
 *
 * Receiving: only valid messages from current room members other than the
 * caller, and per sender only as many reactions as `REACTION_RATE` allows.
 * Clients cannot be trusted, so this holds even if a sender skips its own
 * limit.
 */
export function createReactionHub(options: ReactionHubOptions): ReactionHub {
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  let taps: number[] = [];
  let sent: number[] = [];
  let pending: ReactionEmoji[] = [];
  let pendingSince = 0;
  // When the room's reaction messages went out (ours) or came in (others'),
  // to keep the whole room within its Realtime budget.
  let seen: number[] = [];
  const received = new Map<string, number[]>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  function prune(at: number) {
    seen = seen.filter((time) => at - time < REACTION_ROOM_WINDOW_MS);
  }

  function schedule(delayMs: number, at: number) {
    const waitedS = (at - pendingSince) / 1000;
    const jitter = (random() * MAX_JITTER_MS) / (1 + waitedS);
    clearTimeout(timer);
    timer = setTimeout(flush, delayMs + jitter);
  }

  function flush() {
    clearTimeout(timer);
    timer = undefined;
    if (disposed || pending.length === 0) return;
    const at = now();
    prune(at);
    const roomDelay = roomSendDelayMs(seen, at, options.onlineCount());
    if (roomDelay > 0) return schedule(roomDelay, at);

    const rate = takeWithinRate(
      sent,
      at,
      pending.length,
      SEND_WINDOW_MS,
      REACTION_RATE.max,
    );
    if (rate.allowed === 0) {
      return schedule(
        msUntilAllowed(sent, at, REACTION_RATE.max, SEND_WINDOW_MS),
        at,
      );
    }
    const batch = pending.slice(0, rate.allowed);
    pending = pending.slice(rate.allowed);
    pendingSince = at;
    if (options.send({ sender: options.selfId, emojis: batch })) {
      sent = rate.history;
      seen.push(at);
    } else {
      // Offline: these would be stale by the time the channel is back.
      pending = [];
    }
    if (pending.length > 0) flush();
  }

  return {
    react(emoji) {
      if (disposed) return false;
      const at = now();
      const rate = takeWithinRate(
        taps,
        at,
        1,
        SEND_WINDOW_MS,
        REACTION_RATE.max,
      );
      taps = rate.history;
      if (rate.allowed === 0) return false;
      options.onShow(options.selfId, [emoji]);
      if (pending.length === 0) pendingSince = at;
      pending = [...pending, emoji].slice(-REACTION_RATE.max);
      if (timer === undefined) flush();
      return true;
    },

    receive(payload) {
      if (disposed) return;
      const message = parseReactionMessage(payload);
      if (!message) return;
      const { sender, emojis } = message;
      if (sender === options.selfId || !options.isMember(sender)) return;
      const at = now();
      const rate = takeWithinRate(
        received.get(sender) ?? [],
        at,
        emojis.length,
      );
      received.set(sender, rate.history);
      if (rate.allowed === 0) return;
      prune(at);
      seen.push(at);
      options.onShow(sender, emojis.slice(0, rate.allowed));
    },

    dispose() {
      disposed = true;
      clearTimeout(timer);
      timer = undefined;
    },
  };
}
