import { describe, expect, it } from "vitest";
import {
  awardKeys,
  awardsOf,
  computeRoomAwards,
  serverTimeMicros,
  type AwardPlayer,
  type AwardRound,
  type AwardScore,
  type RoomAwardsInput,
} from "./room-awards";

const JOINED = "2026-10-09T10:00:00+00:00";
const players: AwardPlayer[] = ["ana", "ben", "cleo"].map((id) => ({
  id,
  joinedAt: JOINED,
}));

function round(id: string, gameNumber = 1, minute = 1, ended = true) {
  const startedAt = `2026-10-09T10:${String(minute).padStart(2, "0")}:00+00:00`;
  return { id, gameNumber, startedAt, ended } satisfies AwardRound;
}

/** A solve taking `solveMs`, stored at server time `at` (e.g. "10:01:20.5"). */
function solve(
  roundId: string,
  playerId: string,
  solveMs: number,
  at: string,
  { points = 100, hintUsed = false } = {},
): AwardScore {
  return {
    roundId,
    playerId,
    passed: true,
    solveMs,
    hintUsed,
    points,
    submittedAt: `2026-10-09T${at}+00:00`,
  };
}

function gaveUp(roundId: string, playerId: string, at: string): AwardScore {
  return {
    roundId,
    playerId,
    passed: false,
    solveMs: null,
    hintUsed: false,
    points: 0,
    submittedAt: `2026-10-09T${at}+00:00`,
  };
}

function awards(input: Partial<RoomAwardsInput>) {
  const result = computeRoomAwards({
    players,
    rounds: [],
    scores: [],
    gameNumber: 1,
    gameOver: false,
    ...input,
  });
  return Object.fromEntries(result);
}

describe("serverTimeMicros", () => {
  it("keeps microseconds that Date.parse drops", () => {
    expect(
      serverTimeMicros("2026-10-09T10:00:00.123457+00:00") -
        serverTimeMicros("2026-10-09T10:00:00.123456+00:00"),
    ).toBe(1);
  });

  it("reads short, missing and Z fractions", () => {
    const base = Date.parse("2026-10-09T10:00:00Z") * 1000;
    expect(serverTimeMicros("2026-10-09T10:00:00+00:00")).toBe(base);
    expect(serverTimeMicros("2026-10-09T10:00:00.5Z")).toBe(base + 500_000);
    expect(serverTimeMicros("2026-10-09T12:00:00.12+02:00")).toBe(
      base + 120_000,
    );
  });
});

describe("computeRoomAwards: per game", () => {
  it("gives nothing when nobody solves", () => {
    expect(
      awards({
        rounds: [round("r1"), round("r2", 1, 2)],
        scores: [
          gaveUp("r1", "ana", "10:01:30"),
          gaveUp("r2", "ben", "10:02:30"),
        ],
      }),
    ).toEqual({});
  });

  it("gives nothing before any round ends", () => {
    expect(
      awards({
        rounds: [round("r1", 1, 1, false)],
        scores: [solve("r1", "ana", 5_000, "10:01:05")],
      }),
    ).toEqual({});
  });

  it("First Blood goes to the earliest server time, Speed Demon to the fastest solve", () => {
    const result = awards({
      rounds: [round("r1"), round("r2", 1, 2)],
      scores: [
        solve("r1", "ana", 20_000, "10:01:20"),
        solve("r1", "ben", 30_000, "10:01:30"),
        solve("r2", "ben", 8_000, "10:02:08"),
      ],
    });
    expect(result.ana).toEqual({ awards: ["first-blood"], winStreak: 0 });
    expect(result.ben).toEqual({
      awards: ["speed-demon", "no-hints-needed"],
      winStreak: 0,
    });
    expect(result.cleo).toBeUndefined();
  });

  it("one player alone can hold every game award", () => {
    const solo = [players[0]];
    expect(
      awards({
        players: solo,
        rounds: [round("r1"), round("r2", 1, 2)],
        scores: [
          solve("r1", "ana", 9_000, "10:01:09"),
          solve("r2", "ana", 7_000, "10:02:07"),
        ],
      }).ana,
    ).toEqual({
      awards: ["first-blood", "speed-demon", "no-hints-needed"],
      winStreak: 0,
    });
  });

  it("a tie on solve time goes to the earlier server time", () => {
    const result = awards({
      rounds: [round("r1"), round("r2", 1, 2)],
      scores: [
        solve("r1", "ana", 10_000, "10:01:10"),
        solve("r2", "ben", 10_000, "10:02:10"),
      ],
    });
    expect(result.ana.awards).toContain("speed-demon");
    expect(result.ben).toBeUndefined();
  });

  it("only the microseconds tell two server times apart", () => {
    const result = awards({
      rounds: [round("r1")],
      scores: [
        solve("r1", "ben", 10_000, "10:01:10.000002"),
        solve("r1", "ana", 10_000, "10:01:10.000001"),
      ],
    });
    expect(result.ana.awards).toEqual(["first-blood", "speed-demon"]);
    expect(result.ben).toBeUndefined();
  });

  it("exact ties share First Blood and Speed Demon", () => {
    const result = awards({
      rounds: [round("r1")],
      scores: [
        solve("r1", "ana", 10_000, "10:01:10.5"),
        solve("r1", "ben", 10_000, "10:01:10.5"),
      ],
    });
    expect(result.ana.awards).toEqual(["first-blood", "speed-demon"]);
    expect(result.ben.awards).toEqual(["first-blood", "speed-demon"]);
  });

  it("counts only the current game", () => {
    const result = awards({
      gameNumber: 2,
      rounds: [round("g1r1", 1, 1), round("g2r1", 2, 5)],
      scores: [
        solve("g1r1", "ana", 1_000, "10:01:01"),
        solve("g2r1", "ben", 50_000, "10:05:50"),
      ],
    });
    expect(result.ana).toBeUndefined();
    expect(result.ben.awards).toEqual(["first-blood", "speed-demon"]);
  });

  describe("No Hints Needed", () => {
    const rounds = [round("r1"), round("r2", 1, 2), round("r3", 1, 3)];

    it("needs at least two rounds", () => {
      const result = awards({
        rounds: [round("r1")],
        scores: [solve("r1", "ana", 5_000, "10:01:05")],
      });
      expect(result.ana.awards).not.toContain("no-hints-needed");
    });

    it("is lost by a hint on any round", () => {
      const result = awards({
        rounds,
        scores: [
          solve("r1", "ana", 5_000, "10:01:05"),
          solve("r2", "ana", 5_000, "10:02:05", { hintUsed: true }),
          solve("r3", "ana", 5_000, "10:03:05"),
          solve("r1", "ben", 6_000, "10:01:06"),
          solve("r2", "ben", 6_000, "10:02:06"),
          solve("r3", "ben", 6_000, "10:03:06"),
        ],
      });
      expect(result.ana.awards).not.toContain("no-hints-needed");
      expect(result.ben.awards).toEqual(["no-hints-needed"]);
    });

    it("is lost by a round not solved, or with no result at all", () => {
      const result = awards({
        rounds,
        scores: [
          solve("r1", "ana", 5_000, "10:01:05"),
          gaveUp("r2", "ana", "10:02:05"),
          solve("r3", "ana", 5_000, "10:03:05"),
          solve("r1", "ben", 6_000, "10:01:06"),
          solve("r3", "ben", 6_000, "10:03:06"),
        ],
      });
      expect(result.ana.awards).not.toContain("no-hints-needed");
      expect(result.ben?.awards ?? []).not.toContain("no-hints-needed");
    });

    it("skips rounds that started before the player joined", () => {
      const late = { id: "cleo", joinedAt: "2026-10-09T10:01:30+00:00" };
      const result = awards({
        players: [...players.slice(0, 2), late],
        rounds,
        scores: [
          solve("r2", "cleo", 5_000, "10:02:05"),
          solve("r3", "cleo", 5_000, "10:03:05"),
        ],
      });
      expect(result.cleo.awards).toContain("no-hints-needed");
    });
  });
});

describe("computeRoomAwards: win streak", () => {
  // Game g has one round starting at minute g; `winner` solves it alone.
  function games(winners: (string | string[] | null)[]) {
    const rounds = winners.map((_, index) =>
      round(`g${index + 1}`, index + 1, index + 1),
    );
    const scores = winners.flatMap((winner, index) =>
      [winner ?? []]
        .flat()
        .map((id) => solve(`g${index + 1}`, id, 5_000, `10:0${index + 1}:05`)),
    );
    return { rounds, scores };
  }

  const streak = (input: Partial<RoomAwardsInput>, id: string) =>
    awardsOf(computeRoomAwards({ players, ...input } as RoomAwardsInput), id)
      .winStreak;

  it("counts finished games won in a row, from 2", () => {
    const data = games(["ana", "ana"]);
    expect(streak({ ...data, gameNumber: 2, gameOver: true }, "ana")).toBe(2);
    expect(streak({ ...data, gameNumber: 2, gameOver: false }, "ana")).toBe(0);
    expect(streak({ ...data, gameNumber: 3, gameOver: false }, "ana")).toBe(2);
  });

  it("restarts after a game someone else won", () => {
    const data = games(["ana", "ana", "ben", "ana", "ana", "ana"]);
    expect(streak({ ...data, gameNumber: 6, gameOver: true }, "ana")).toBe(3);
    expect(streak({ ...data, gameNumber: 3, gameOver: true }, "ana")).toBe(0);
  });

  it("is broken by a game nobody scored", () => {
    const data = games(["ana", null, "ana"]);
    expect(streak({ ...data, gameNumber: 3, gameOver: true }, "ana")).toBe(0);
  });

  it("exact ties share the win", () => {
    const data = games(["ana", ["ana", "ben"]]);
    const result = awards({ ...data, gameNumber: 2, gameOver: true });
    expect(result.ana.winStreak).toBe(2);
    expect(result.ben?.winStreak ?? 0).toBe(0);
  });

  it("ranks a game like the leaderboard: points, then earlier last solve", () => {
    const rounds = [round("g1", 1, 1), round("g2", 2, 2)];
    const scores = [
      solve("g1", "ana", 5_000, "10:01:05", { points: 100 }),
      // Game 2: equal points, Ben's last solve came first.
      solve("g2", "ana", 9_000, "10:02:09", { points: 100 }),
      solve("g2", "ben", 4_000, "10:02:04", { points: 100 }),
      // Cleo has more points in game 1 but no game 2 win.
      solve("g1", "cleo", 6_000, "10:01:06", { points: 150 }),
    ];
    const result = awards({ rounds, scores, gameNumber: 2, gameOver: true });
    expect(result.ana?.winStreak ?? 0).toBe(0);
    expect(result.cleo?.winStreak ?? 0).toBe(0);

    const more = [
      ...scores,
      solve("g2", "cleo", 1_000, "10:02:01", { points: 300 }),
    ];
    expect(
      awards({ rounds, scores: more, gameNumber: 2, gameOver: true }).cleo
        .winStreak,
    ).toBe(2);
  });
});

describe("awardKeys", () => {
  it("names game awards per game", () => {
    const game = { gameNumber: 4, gameOver: false };
    expect(awardKeys({ awards: ["first-blood"], winStreak: 0 }, game)).toEqual([
      "4:first-blood",
    ]);
    expect(awardKeys(awardsOf(null, "ana"), game)).toEqual([]);
  });

  it("names a streak by its first game and length", () => {
    const streak = { awards: [], winStreak: 2 };
    // Won games 2 and 3: same key on game 3's podium and during game 4.
    expect(awardKeys(streak, { gameNumber: 3, gameOver: true })).toEqual([
      "streak:2:2",
    ]);
    expect(awardKeys(streak, { gameNumber: 4, gameOver: false })).toEqual([
      "streak:2:2",
    ]);
    // A new x2 streak later is a new key.
    expect(awardKeys(streak, { gameNumber: 6, gameOver: true })).toEqual([
      "streak:5:2",
    ]);
  });
});
