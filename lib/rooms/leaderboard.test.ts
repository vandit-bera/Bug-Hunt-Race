import { describe, expect, it } from "vitest";
import type { LeaderboardEntry } from "@/lib/db";
import { toStandings } from "./leaderboard";

const entry = (
  name: string,
  rank: number,
  previousRank: number | null,
): LeaderboardEntry => ({
  room_id: "room-1",
  player_id: `id-${name}`,
  display_name: name,
  avatar: "🦊",
  is_admin: false,
  connected: true,
  total_points: 150,
  rounds_solved: 1,
  total_solve_ms: 42_000,
  rank,
  game_number: 1,
  last_solved_at: "2026-10-09T00:00:42Z",
  previous_rank: previousRank,
});

describe("toStandings", () => {
  it("maps the server's ranks and totals", () => {
    expect(toStandings([entry("Riya", 1, null)])).toEqual([
      {
        id: "id-Riya",
        name: "Riya",
        emoji: "🦊",
        rank: 1,
        totalPoints: 150,
        roundsSolved: 1,
        totalSolveMs: 42_000,
        change: 0,
      },
    ]);
  });

  it("turns the previous rank into places gained or lost", () => {
    const rows = toStandings([
      entry("Dev", 1, 3),
      entry("Ana", 2, 1),
      entry("Cleo", 3, 3),
    ]);
    expect(rows.map((row) => row.change)).toEqual([2, -1, 0]);
  });
});
