import { describe, expect, it } from "vitest";
import { getLeaderboard, getScore, recordScore } from "@/lib/db";
import type { LeaderboardEntry, Score } from "@/lib/db";
import { createFakeClient } from "./test-utils";

describe("recordScore", () => {
  it("sends only the round, pass flag and hint flag", async () => {
    const score: Score = {
      id: "score-1",
      round_id: "round-1",
      player_id: "player-1",
      passed: true,
      solve_time_ms: 42_000,
      hint_used: false,
      points: 138,
      submitted_at: "2026-10-08T00:00:42Z",
    };
    const fake = createFakeClient({ rpc: [{ data: score, error: null }] });

    await expect(
      recordScore(fake.client, {
        roundId: "round-1",
        passed: true,
        hintUsed: false,
      }),
    ).resolves.toEqual(score);
    expect(fake.rpc).toHaveBeenCalledWith("record_score", {
      round_id: "round-1",
      passed: true,
      hint_used: false,
    });
  });

  it("maps round_not_live to a typed error", async () => {
    const fake = createFakeClient({
      rpc: [{ data: null, error: { message: "round_not_live" } }],
    });

    await expect(
      recordScore(fake.client, {
        roundId: "round-1",
        passed: true,
        hintUsed: false,
      }),
    ).rejects.toMatchObject({ name: "DbError", code: "round_not_live" });
  });
});

describe("getScore", () => {
  it("reads one player's result for a round", async () => {
    const fake = createFakeClient({ from: [{ data: null, error: null }] });

    await expect(
      getScore(fake.client, "round-1", "player-1"),
    ).resolves.toBeNull();
    expect(fake.queries[0]).toEqual({
      table: "scores",
      calls: [
        ["select", []],
        ["eq", ["round_id", "round-1"]],
        ["eq", ["player_id", "player-1"]],
        ["maybeSingle", []],
      ],
    });
  });
});

describe("getLeaderboard", () => {
  it("reads the room's leaderboard ordered by rank", async () => {
    const entries: LeaderboardEntry[] = [
      {
        room_id: "room-1",
        player_id: "player-1",
        display_name: "Riya",
        avatar: "🦊",
        is_admin: true,
        connected: true,
        total_points: 133,
        rounds_solved: 1,
        total_solve_ms: 60_000,
        rank: 1,
        game_number: 2,
        last_solved_at: "2026-10-08T00:01:00Z",
        previous_rank: null,
      },
    ];
    const fake = createFakeClient({ from: [{ data: entries, error: null }] });

    await expect(getLeaderboard(fake.client, "room-1")).resolves.toEqual(
      entries,
    );
    expect(fake.queries[0]).toEqual({
      table: "room_leaderboard",
      calls: [
        ["select", []],
        ["eq", ["room_id", "room-1"]],
        ["order", ["rank"]],
        ["order", ["display_name"]],
      ],
    });
  });
});
