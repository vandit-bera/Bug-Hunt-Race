import { describe, expect, it } from "vitest";
import {
  computeStandings,
  isTied,
  podiumSteps,
  roundResults,
  type RoundResult,
  type StandingsPlayer,
} from "./standings";

const player = (id: string): StandingsPlayer => ({
  id,
  name: id,
  emoji: "🦊",
});

const solved = (playerId: string, total: number, solveMs: number) =>
  ({
    playerId,
    solveMs,
    score: { base: total, speedBonus: 0, hintPenalty: 0, total },
  }) satisfies RoundResult;

const missed = (playerId: string): RoundResult => ({
  playerId,
  solveMs: null,
  score: { base: 0, speedBonus: 0, hintPenalty: 0, total: 0 },
});

const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id);
const ranks = (rows: readonly { rank: number }[]) => rows.map((r) => r.rank);

describe("computeStandings", () => {
  it("ranks by total points", () => {
    const players = ["a", "b", "c"].map(player);
    const rows = computeStandings(players, [
      [solved("a", 100, 9000), solved("b", 200, 9000), solved("c", 150, 9000)],
    ]);
    expect(ids(rows)).toEqual(["b", "c", "a"]);
    expect(ranks(rows)).toEqual([1, 2, 3]);
  });

  it("breaks a points tie by the earlier server time", () => {
    const players = ["slow", "fast"].map(player);
    const rows = computeStandings(players, [
      [solved("slow", 150, 40_000), solved("fast", 150, 12_000)],
    ]);
    expect(ids(rows)).toEqual(["fast", "slow"]);
    expect(ranks(rows)).toEqual([1, 2]);
  });

  it("gives exact ties the same place and skips the next one", () => {
    const players = ["a", "b", "c", "d"].map(player);
    const rows = computeStandings(players, [
      [
        solved("a", 150, 20_000),
        solved("b", 150, 20_000),
        solved("c", 100, 30_000),
        solved("d", 300, 5000),
      ],
    ]);
    expect(ids(rows)).toEqual(["d", "a", "b", "c"]);
    expect(ranks(rows)).toEqual([1, 2, 2, 4]);
  });

  it("scores unsolved and missing rounds as 0", () => {
    const players = ["a", "b", "c"].map(player);
    const rows = computeStandings(players, [
      [solved("a", 100, 10_000), missed("b")],
    ]);
    expect(rows.map((r) => [r.id, r.totalPoints, r.roundsSolved])).toEqual([
      ["a", 100, 1],
      ["b", 0, 0],
      ["c", 0, 0],
    ]);
    expect(ranks(rows)).toEqual([1, 2, 2]);
  });

  it("ignores the score of an unsolved result", () => {
    const rows = computeStandings(
      [player("a")],
      [[{ ...solved("a", 100, 0), solveMs: null }]],
    );
    expect(rows[0].totalPoints).toBe(0);
  });

  it("sums points and solve time over rounds", () => {
    const rows = computeStandings(
      [player("a")],
      [[solved("a", 100, 10_000)], [missed("a")], [solved("a", 50, 5000)]],
    );
    expect(rows[0]).toMatchObject({
      totalPoints: 150,
      roundsSolved: 2,
      totalSolveMs: 15_000,
    });
  });

  it("shows no rank change after the first round", () => {
    const rows = computeStandings(["a", "b"].map(player), [
      [solved("a", 100, 1000), solved("b", 200, 1000)],
    ]);
    expect(rows.map((r) => r.change)).toEqual([0, 0]);
  });

  it("reports places gained and lost in the last round", () => {
    const players = ["a", "b", "c"].map(player);
    const rows = computeStandings(players, [
      [solved("a", 300, 1000), solved("b", 200, 1000), solved("c", 100, 1000)],
      [missed("a"), missed("b"), solved("c", 300, 1000)],
    ]);
    expect(rows.map((r) => [r.id, r.rank, r.change])).toEqual([
      ["c", 1, 2],
      ["a", 2, -1],
      ["b", 3, -1],
    ]);
  });

  it("counts a player with no earlier results as last before the round", () => {
    const rows = computeStandings(["a", "b", "new"].map(player), [
      [solved("a", 200, 1000), solved("b", 100, 1000)],
      [solved("new", 300, 1000)],
    ]);
    expect(rows.map((r) => [r.id, r.change])).toEqual([
      ["new", 2],
      ["a", -1],
      ["b", -1],
    ]);
  });

  it("gives no arrow when a tie keeps the same place", () => {
    const rows = computeStandings(["a", "b"].map(player), [
      [solved("a", 100, 1000), solved("b", 100, 1000)],
      [missed("a"), missed("b")],
    ]);
    expect(rows.map((r) => r.change)).toEqual([0, 0]);
  });

  it("handles no players and no rounds", () => {
    expect(computeStandings([], [])).toEqual([]);
    expect(ranks(computeStandings(["a", "b"].map(player), []))).toEqual([1, 1]);
  });
});

describe("roundResults", () => {
  it("lists solvers by points and time, then unsolved with 0", () => {
    const players = ["a", "b", "c", "d"].map(player);
    const rows = roundResults(players, [
      [
        missed("a"),
        solved("b", 150, 30_000),
        solved("c", 150, 10_000),
        solved("d", 200, 50_000),
      ],
    ]);
    expect(ids(rows)).toEqual(["d", "c", "b", "a"]);
    expect(ranks(rows)).toEqual([1, 2, 3, 4]);
    expect(rows[3]).toMatchObject({ solveMs: null, score: { total: 0 } });
  });

  it("counts a player with no result as not solved", () => {
    const rows = roundResults(["a", "b"].map(player), [
      [solved("a", 100, 1000)],
    ]);
    expect(rows[1]).toMatchObject({ id: "b", solveMs: null, rank: 2 });
  });

  it("carries the overall rank change", () => {
    const players = ["a", "b"].map(player);
    const rows = roundResults(players, [
      [solved("a", 200, 1000), solved("b", 100, 1000)],
      [missed("a"), solved("b", 300, 1000)],
    ]);
    expect(rows.map((r) => [r.id, r.change])).toEqual([
      ["b", 1],
      ["a", -1],
    ]);
  });
});

describe("podiumSteps", () => {
  const standings = (points: number[]) =>
    computeStandings(
      points.map((_, i) => player(`p${i}`)),
      [points.map((p, i) => solved(`p${i}`, p, 1000))],
    );

  it("has one step for one player", () => {
    const steps = podiumSteps(standings([100]));
    expect(steps.map((s) => [s.rank, ids(s.players)])).toEqual([[1, ["p0"]]]);
  });

  it("has two steps for two players", () => {
    expect(ranks(podiumSteps(standings([100, 200])))).toEqual([1, 2]);
  });

  it("keeps the top three places only", () => {
    const steps = podiumSteps(standings([500, 400, 300, 200, 100]));
    expect(steps.map((s) => ids(s.players))).toEqual([["p0"], ["p1"], ["p2"]]);
  });

  it("puts tied players on the same step", () => {
    const steps = podiumSteps(standings([300, 300, 200, 100]));
    expect(steps.map((s) => [s.rank, ids(s.players)])).toEqual([
      [1, ["p0", "p1"]],
      [3, ["p2"]],
    ]);
  });

  it("leaves out players with 0 points", () => {
    expect(podiumSteps(standings([100, 0, 0]))).toHaveLength(1);
    expect(podiumSteps(standings([0, 0]))).toEqual([]);
  });
});

describe("isTied", () => {
  it("flags rows that share a place", () => {
    const rows = [1, 2, 2, 4].map((rank) => ({ rank }));
    expect(rows.map((_, i) => isTied(rows, i))).toEqual([
      false,
      true,
      true,
      false,
    ]);
  });
});
