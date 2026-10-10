import { describe, expect, it } from "vitest";
import type { LeaderboardEntry, Player, Score } from "@/lib/db";
import { toRoundRows, toStandings } from "./leaderboard";

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

const STARTED_AT = "2026-10-09T10:00:00Z";
const round = {
  started_at: STARTED_AT,
  base_points: 100,
  time_limit_seconds: 180,
};

const player = (name: string, joinedAt = "2026-10-09T09:59:00Z"): Player => ({
  id: `id-${name}`,
  room_id: "room-1",
  user_id: `user-${name}`,
  display_name: name,
  avatar: "🦊",
  is_admin: false,
  connected: true,
  joined_at: joinedAt,
  left_at: null,
});

const score = (
  name: string,
  passed: boolean,
  solveMs: number | null,
  points: number,
  hintUsed = false,
): Score => ({
  id: `score-${name}`,
  round_id: "round-1",
  player_id: `id-${name}`,
  passed,
  solve_time_ms: solveMs,
  hint_used: hintUsed,
  points,
  submitted_at: STARTED_AT,
});

describe("toRoundRows", () => {
  it("ranks solvers by points, then server solve time; the rest get 0", () => {
    const rows = toRoundRows(
      round,
      [player("Ana"), player("Ben"), player("Cleo"), player("Dev")],
      [
        score("Ben", true, 60_000, 133),
        score("Ana", true, 30_000, 142),
        score("Cleo", false, null, 0, true),
      ],
      [],
    );
    expect(rows.map((row) => [row.name, row.rank, row.score.total])).toEqual([
      ["Ana", 1, 142],
      ["Ben", 2, 133],
      ["Cleo", 3, 0],
      ["Dev", 3, 0],
    ]);
    expect(rows[2].solveMs).toBeNull();
    expect(rows[3].solveMs).toBeNull();
  });

  it("shows the stored points with the scoring function's breakdown", () => {
    const [row] = toRoundRows(
      round,
      [player("Ana")],
      [score("Ana", true, 60_000, 108, true)],
      [],
    );
    expect(row.score).toEqual({
      base: 100,
      speedBonus: 33,
      hintPenalty: 25,
      total: 108,
    });
    expect(row.solveMs).toBe(60_000);
  });

  it("gives exact ties the same place", () => {
    const rows = toRoundRows(
      round,
      [player("Ana"), player("Ben"), player("Cleo")],
      [
        score("Ana", true, 45_000, 138),
        score("Ben", true, 45_000, 138),
        score("Cleo", true, 50_000, 136),
      ],
      [],
    );
    expect(rows.map((row) => row.rank)).toEqual([1, 1, 3]);
  });

  it("leaves out players who joined after the round started", () => {
    const rows = toRoundRows(
      round,
      [player("Ana"), player("Late", "2026-10-09T10:00:05Z")],
      [],
      [],
    );
    expect(rows.map((row) => row.name)).toEqual(["Ana"]);
  });

  it("takes the overall rank change from the leaderboard", () => {
    const rows = toRoundRows(
      round,
      [player("Ana"), player("Ben")],
      [score("Ben", true, 10_000, 147)],
      [entry("Ben", 1, 2), entry("Ana", 2, 1)],
    );
    expect(rows.map((row) => [row.name, row.change])).toEqual([
      ["Ben", 1],
      ["Ana", -1],
    ]);
  });
});
