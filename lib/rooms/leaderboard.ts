import type { CurrentRound, LeaderboardEntry, Player, Score } from "@/lib/db";
import { computeRaceScore } from "@/lib/game/scoring";
import {
  roundResults,
  type RoundResult,
  type RoundRow,
  type Standing,
} from "@/lib/game/standings";

/**
 * Server standings (`getLeaderboard`) in the shape the results components
 * take (Leaderboard, Podium). Ranks come from the database, so every player
 * sees the same places; `change` is the places gained (positive) or lost
 * (negative) in the latest round, 0 before the game's second round.
 */
export function toStandings(entries: readonly LeaderboardEntry[]): Standing[] {
  return entries.map((entry) => ({
    id: entry.player_id,
    name: entry.display_name,
    emoji: entry.avatar,
    rank: entry.rank,
    totalPoints: entry.total_points,
    roundsSolved: entry.rounds_solved,
    totalSolveMs: entry.total_solve_ms,
    change: entry.previous_rank === null ? 0 : entry.previous_rank - entry.rank,
  }));
}

/**
 * One round's results for the RoundResults component: every player who was
 * in the room when the round started, solvers first by points then server
 * solve time (exact ties share the place), then everyone else with 0. The
 * points are the stored ones; the breakdown comes from the same formula.
 * `change` is the overall rank change this round, from the leaderboard.
 */
export function toRoundRows(
  round: Pick<
    CurrentRound,
    "started_at" | "base_points" | "time_limit_seconds"
  >,
  players: readonly Player[],
  scores: readonly Score[],
  leaderboard: readonly LeaderboardEntry[],
): RoundRow[] {
  const startedMs = Date.parse(round.started_at);
  const racers = players
    .filter((player) => Date.parse(player.joined_at) <= startedMs)
    .map((player) => ({
      id: player.id,
      name: player.display_name,
      emoji: player.avatar,
    }));
  const results: RoundResult[] = scores.map((score) => {
    const solveMs = score.passed ? score.solve_time_ms : null;
    const breakdown = computeRaceScore({
      passed: score.passed,
      basePoints: round.base_points,
      timeLimitSec: round.time_limit_seconds,
      solveMs,
      hintUsed: score.hint_used,
    });
    return {
      playerId: score.player_id,
      solveMs,
      score: { ...breakdown, total: score.points },
    };
  });
  const change = new Map(
    toStandings(leaderboard).map((row) => [row.id, row.change]),
  );
  return roundResults(racers, [results]).map((row) => ({
    ...row,
    change: change.get(row.id) ?? 0,
  }));
}
