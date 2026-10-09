import type { LeaderboardEntry } from "@/lib/db";
import type { Standing } from "@/lib/game/standings";

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
