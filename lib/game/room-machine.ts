/**
 * Room state machine (TB-19 §12). Pure: no React, no Supabase.
 *
 * The database enforces the same table in `private.room_transitions`
 * (supabase/migrations/20261008000004_room_engine.sql); a unit test keeps the
 * two in sync. Anything not listed here is rejected.
 */

import type { RoomState } from "./types";

export type RoomEvent =
  | "start"
  | "begin_round"
  | "pause"
  | "resume"
  | "end_round"
  | "next_round"
  | "finish"
  | "stop"
  | "play_again"
  | "close"
  | "abandon";

/**
 * Who may trigger a transition. `admin`: the room admin, through
 * `advance_room()`. `system`: only the database itself (auto-close).
 */
export type RoomActor = "admin" | "system";

export interface RoomTransition {
  from: RoomState;
  event: RoomEvent;
  to: RoomState;
  by: RoomActor;
}

export const ROOM_TRANSITIONS: readonly RoomTransition[] = [
  { from: "lobby", event: "start", to: "countdown", by: "admin" },
  // Countdown over: the admin's client sends it when the 3-2-1 ends.
  { from: "countdown", event: "begin_round", to: "round_live", by: "admin" },
  { from: "round_live", event: "pause", to: "paused", by: "admin" },
  { from: "paused", event: "resume", to: "round_live", by: "admin" },
  // Skip. The database applies it too when every player has a result or time
  // is up (supabase/migrations/20261008000006_round_engine.sql).
  { from: "round_live", event: "end_round", to: "round_results", by: "admin" },
  { from: "round_results", event: "next_round", to: "countdown", by: "admin" },
  {
    from: "round_results",
    event: "finish",
    to: "final_leaderboard",
    by: "admin",
  },
  { from: "round_live", event: "stop", to: "final_leaderboard", by: "admin" },
  { from: "paused", event: "stop", to: "final_leaderboard", by: "admin" },
  { from: "final_leaderboard", event: "play_again", to: "lobby", by: "admin" },
  { from: "final_leaderboard", event: "close", to: "closed", by: "admin" },
  // No connected players for 10 minutes, in any open state.
  { from: "lobby", event: "abandon", to: "closed", by: "system" },
  { from: "countdown", event: "abandon", to: "closed", by: "system" },
  { from: "round_live", event: "abandon", to: "closed", by: "system" },
  { from: "paused", event: "abandon", to: "closed", by: "system" },
  { from: "round_results", event: "abandon", to: "closed", by: "system" },
  { from: "final_leaderboard", event: "abandon", to: "closed", by: "system" },
];

export interface RoomSnapshot {
  state: RoomState;
  /** 0 before the first round; the round being played or just played. */
  currentRound: number;
  /** null = play until the admin stops. */
  totalRounds: number | null;
}

export type TransitionError = "invalid_transition" | "not_room_admin";

export type TransitionResult =
  { ok: true; room: RoomSnapshot } | { ok: false; error: TransitionError };

function hasMoreRounds(room: RoomSnapshot): boolean {
  return room.totalRounds === null || room.currentRound < room.totalRounds;
}

function isLastRound(room: RoomSnapshot): boolean {
  return room.totalRounds === null || room.currentRound >= room.totalRounds;
}

/**
 * Applies `event` to `room` on behalf of `actor`. `next_round` needs a round
 * left; `finish` needs the last round played (or "until stopped", where the
 * admin decides). `start` and `next_round` move to the next round number;
 * `play_again` resets it.
 */
export function transition(
  room: RoomSnapshot,
  event: RoomEvent,
  actor: RoomActor,
): TransitionResult {
  const match = ROOM_TRANSITIONS.find(
    (t) => t.from === room.state && t.event === event,
  );
  if (!match) return { ok: false, error: "invalid_transition" };
  if (match.by !== actor) {
    return {
      ok: false,
      error: match.by === "admin" ? "not_room_admin" : "invalid_transition",
    };
  }
  if (event === "next_round" && !hasMoreRounds(room)) {
    return { ok: false, error: "invalid_transition" };
  }
  if (event === "finish" && !isLastRound(room)) {
    return { ok: false, error: "invalid_transition" };
  }

  let currentRound = room.currentRound;
  if (event === "start" || event === "next_round") currentRound += 1;
  if (event === "play_again") currentRound = 0;
  return { ok: true, room: { ...room, state: match.to, currentRound } };
}

/** Events `actor` could send from `room` right now (for admin buttons). */
export function availableEvents(
  room: RoomSnapshot,
  actor: RoomActor,
): RoomEvent[] {
  return ROOM_TRANSITIONS.filter(
    (t) => t.from === room.state && transition(room, t.event, actor).ok,
  ).map((t) => t.event);
}
