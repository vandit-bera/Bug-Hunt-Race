/**
 * Race round clock. Pure: no React, no Supabase.
 *
 * The database stores when the round started (server clock), its time limit
 * and how long it has been paused. Every client computes
 *
 *   time left = started_at + time limit + paused time - server now
 *
 * from those same fields, with "server now" estimated from its own clock plus
 * a measured offset, so all players see the same countdown.
 */

export interface RoundClock {
  /** ISO timestamps from the database (server clock). */
  startedAt: string;
  /** Set while paused: the clock is frozen at this moment. */
  pausedAt: string | null;
  /** Paused time from earlier pauses. */
  pausedMs: number;
  /** Set once the round is over: the clock stops here. */
  endedAt: string | null;
  timeLimitSeconds: number;
}

/** Milliseconds of play so far, without pauses. Never negative. */
export function elapsedMs(round: RoundClock, serverNowMs: number): number {
  const stoppedAt = round.endedAt ?? round.pausedAt;
  const until = stoppedAt === null ? serverNowMs : Date.parse(stoppedAt);
  return Math.max(0, until - Date.parse(round.startedAt) - round.pausedMs);
}

/** Milliseconds left on the round clock, from 0 to the time limit. */
export function timeLeftMs(round: RoundClock, serverNowMs: number): number {
  const limitMs = round.timeLimitSeconds * 1000;
  return Math.min(
    limitMs,
    Math.max(0, limitMs - elapsedMs(round, serverNowMs)),
  );
}

/**
 * How far the server clock is ahead of this one, from one request: the
 * server's time is taken to be the midpoint of the round trip. Add it to
 * `Date.now()` to get "server now".
 */
export function clockOffsetMs(
  serverNow: string,
  requestSentMs: number,
  responseReceivedMs: number,
): number {
  const midpoint = (requestSentMs + responseReceivedMs) / 2;
  return Date.parse(serverNow) - midpoint;
}

/** "m:ss", rounding up so the clock shows 0:00 only when time is up. */
export function formatTimeLeft(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
