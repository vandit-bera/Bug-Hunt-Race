/**
 * Race round screens (TB-19 §10, §12). Pure: no React, no Supabase.
 *
 * The room status says where the game is; the current round says whether
 * this player is in it. Rounds, clocks and results live in the database
 * (supabase/migrations/20261008000006_round_engine.sql).
 */

import type { RoomState } from "./types";

/** Which screen a player sees. */
export type RacePhase =
  | "lobby"
  | "countdown"
  /** The round is on but not loaded yet. */
  | "loading"
  /** Joined mid-round: waits in the lobby for the next one. */
  | "waiting"
  | "playing"
  | "results"
  | "final";

export interface RoundSeat {
  /** The player joined after the round started. */
  joinedLate: boolean;
}

export function racePhase(
  status: Exclude<RoomState, "closed">,
  round: RoundSeat | null,
): RacePhase {
  switch (status) {
    case "lobby":
      return "lobby";
    case "countdown":
      return "countdown";
    case "final_leaderboard":
      return "final";
    case "round_results":
      return round ? "results" : "loading";
    case "round_live":
    case "paused":
      if (!round) return "loading";
      return round.joinedLate ? "waiting" : "playing";
  }
}

export type RaceProgress = "solved" | "gave_up" | "fixing";

export interface RacePlayer {
  id: string;
  name: string;
  avatar: string;
  /** ISO timestamp. */
  joinedAt: string;
}

export interface RaceResult {
  playerId: string;
  passed: boolean;
  /** From the round's start, pauses excluded; null unless passed. */
  solveTimeMs: number | null;
  hintUsed: boolean;
  points: number;
}

export interface ProgressRow {
  player: RacePlayer;
  progress: RaceProgress;
  result: RaceResult | null;
}

const ORDER: Record<RaceProgress, number> = {
  solved: 0,
  gave_up: 1,
  fixing: 2,
};

/**
 * One row per player racing this round (in the room when it started):
 * solvers first, fastest first, then those who gave up, then those still
 * fixing, each in join order. Late joiners only watch, so they are left out.
 */
export function roundProgress(
  players: readonly RacePlayer[],
  results: readonly RaceResult[],
  roundStartedAt: string,
): ProgressRow[] {
  const startedMs = Date.parse(roundStartedAt);
  const byPlayer = new Map(results.map((result) => [result.playerId, result]));
  return players
    .filter((player) => Date.parse(player.joinedAt) <= startedMs)
    .map((player): ProgressRow => {
      const result = byPlayer.get(player.id) ?? null;
      const progress: RaceProgress = !result
        ? "fixing"
        : result.passed
          ? "solved"
          : "gave_up";
      return { player, progress, result };
    })
    .sort(
      (a, b) =>
        ORDER[a.progress] - ORDER[b.progress] ||
        (a.result?.solveTimeMs ?? 0) - (b.result?.solveTimeMs ?? 0) ||
        Date.parse(a.player.joinedAt) - Date.parse(b.player.joinedAt),
    );
}

/** Whether anyone solved the round, e.g. to reveal the fix if nobody did. */
export function anyoneSolved(rows: readonly ProgressRow[]): boolean {
  return rows.some((row) => row.progress === "solved");
}
