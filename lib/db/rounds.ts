import { clockOffsetMs, type RoundClock } from "@/lib/game/round-clock";
import type { DbClient } from "./client";
import { toDbError } from "./errors";
import type { CurrentRound, Room } from "./models";
import { advanceRoom } from "./rooms";

/** The current round plus how far the server clock is ahead of this one. */
export interface CurrentRoundView {
  round: CurrentRound;
  /** Add to `Date.now()` for "server now" (see lib/game/round-clock.ts). */
  clockOffsetMs: number;
}

/**
 * The room's current round with its puzzle, or null in the lobby and during
 * a countdown. Every player gets the same puzzle and the same server
 * timestamps; `clockOffsetMs` corrects for this device's clock. Load it when
 * the room status changes (Realtime): starting, pausing, resuming and ending
 * a round all change the status.
 */
export async function getCurrentRound(
  client: DbClient,
  roomId: string,
): Promise<CurrentRoundView | null> {
  const sent = Date.now();
  const { data, error } = await client.rpc("get_current_round", {
    target_room_id: roomId,
  });
  const received = Date.now();
  if (error) throw toDbError(error);
  // See CurrentRound: paused_at, ended_at, description and hint can be null.
  const round = (data[0] ?? null) as CurrentRound | null;
  if (!round) return null;
  return {
    round,
    clockOffsetMs: clockOffsetMs(round.server_now, sent, received),
  };
}

/**
 * The puzzle id of an ended round the caller was in, for the fix reveal.
 * Raises `round_not_over` while the round is on and `round_not_found` for
 * anyone who was never in the room.
 */
export async function revealRoundPuzzle(
  client: DbClient,
  roundId: string,
): Promise<string> {
  const { data, error } = await client.rpc("reveal_round_puzzle", {
    target_round_id: roundId,
  });
  if (error) throw toDbError(error);
  return data;
}

/** The fields of a round that the clock in lib/game/round-clock.ts needs. */
export function roundClock(round: CurrentRound): RoundClock {
  return {
    startedAt: round.started_at,
    pausedAt: round.paused_at,
    pausedMs: round.paused_ms,
    endedAt: round.ended_at,
    timeLimitSeconds: round.time_limit_seconds,
  };
}

// Admin actions. Each raises `not_room_admin` for other players and
// `invalid_transition` when the room is in the wrong state.

/**
 * Admin only, after the countdown: the database picks the puzzle (same for
 * everyone, no repeat within the game, Mixed steps up) and starts the round
 * on its own clock. Raises `no_puzzles` if the language and level have none.
 */
export function startRound(client: DbClient, roomId: string): Promise<Room> {
  return advanceRoom(client, roomId, "begin_round");
}

/** Admin only: freezes the round clock. */
export function pauseRound(client: DbClient, roomId: string): Promise<Room> {
  return advanceRoom(client, roomId, "pause");
}

/** Admin only: restarts the clock; the pause does not count. */
export function resumeRound(client: DbClient, roomId: string): Promise<Room> {
  return advanceRoom(client, roomId, "resume");
}

/**
 * Admin only: ends the live round now (round results). The database also
 * ends it by itself when every player has a result or time is up.
 */
export function skipRound(client: DbClient, roomId: string): Promise<Room> {
  return advanceRoom(client, roomId, "end_round");
}

/**
 * Admin only, from a live or paused round: ends it with the results so far
 * and goes to the final leaderboard.
 */
export function stopGame(client: DbClient, roomId: string): Promise<Room> {
  return advanceRoom(client, roomId, "stop");
}
