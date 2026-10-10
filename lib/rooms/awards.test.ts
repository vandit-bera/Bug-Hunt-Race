import { describe, expect, it } from "vitest";
import type { RoomResultsRound } from "@/lib/db";
import { toRoomAwards } from "./awards";

const round = (
  id: string,
  gameNumber: number,
  minute: number,
  solver: string,
  ended = true,
): RoomResultsRound => ({
  id,
  game_number: gameNumber,
  round_number: 1,
  started_at: `2026-10-09T10:0${minute}:00Z`,
  ended_at: ended ? `2026-10-09T10:0${minute}:30Z` : null,
  scores: [
    {
      player_id: solver,
      passed: true,
      solve_time_ms: 10_000,
      hint_used: false,
      points: 120,
      submitted_at: `2026-10-09T10:0${minute}:10.000001+00:00`,
    },
  ],
});

const players = [
  { id: "ana", joined_at: "2026-10-09T10:00:00Z" },
  { id: "ben", joined_at: "2026-10-09T10:00:00Z" },
];

describe("toRoomAwards", () => {
  it("maps server rows to awards for the current game and streaks", () => {
    const rounds = [
      round("g1", 1, 1, "ana"),
      round("g2", 2, 2, "ana"),
      round("g3", 3, 3, "ben"),
    ];
    const awards = toRoomAwards(rounds, players, {
      gameNumber: 3,
      gameOver: false,
    });
    expect(awards.get("ana")).toEqual({ awards: [], winStreak: 2 });
    expect(awards.get("ben")).toEqual({
      awards: ["first-blood", "speed-demon"],
      winStreak: 0,
    });
  });

  it("ignores a round still on", () => {
    const awards = toRoomAwards([round("g1", 1, 1, "ana", false)], players, {
      gameNumber: 1,
      gameOver: false,
    });
    expect(awards.size).toBe(0);
  });
});
