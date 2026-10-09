import { describe, expect, it } from "vitest";
import { computeRaceScore, computeScore } from "./scoring";

const easy = { basePoints: 100, timeLimitSec: 180 };

describe("computeScore", () => {
  it("gives base plus a full speed bonus for an instant solve", () => {
    expect(
      computeScore({ ...easy, solved: true, elapsedSec: 0, hintsUsed: 0 }),
    ).toEqual({ base: 100, speedBonus: 50, hintPenalty: 0, total: 150 });
  });

  it("scales the speed bonus with the time left", () => {
    const score = computeScore({
      ...easy,
      solved: true,
      elapsedSec: 90,
      hintsUsed: 0,
    });
    expect(score.speedBonus).toBe(25);
    expect(score.total).toBe(125);
  });

  it("gives only the base points when solved with 0 seconds left", () => {
    // Solving exactly at the limit still counts as in time.
    expect(
      computeScore({ ...easy, solved: true, elapsedSec: 179.9, hintsUsed: 0 })
        .total,
    ).toBe(100);
  });

  it("scores 0 when the time is up", () => {
    expect(
      computeScore({ ...easy, solved: true, elapsedSec: 180, hintsUsed: 0 })
        .total,
    ).toBe(0);
    expect(
      computeScore({ ...easy, solved: true, elapsedSec: 500, hintsUsed: 0 })
        .total,
    ).toBe(0);
  });

  it("scores 0 when not solved", () => {
    expect(
      computeScore({ ...easy, solved: false, elapsedSec: 10, hintsUsed: 0 }),
    ).toEqual({ base: 0, speedBonus: 0, hintPenalty: 0, total: 0 });
  });

  it("takes a quarter of the base points per hint", () => {
    const score = computeScore({
      ...easy,
      solved: true,
      elapsedSec: 0,
      hintsUsed: 1,
    });
    expect(score.hintPenalty).toBe(25);
    expect(score.total).toBe(125);
  });

  it("never goes below 0 with hints and a slow solve", () => {
    const score = computeScore({
      ...easy,
      solved: true,
      elapsedSec: 179,
      hintsUsed: 10,
    });
    expect(score.total).toBe(0);
  });

  it("ignores negative elapsed time and hints", () => {
    const score = computeScore({
      ...easy,
      solved: true,
      elapsedSec: -5,
      hintsUsed: -2,
    });
    expect(score.total).toBe(150);
  });
});

/**
 * The same cases are checked against the database's `calculate_points` in
 * supabase/tests/09_scoring.test.sql: keep the two lists in step.
 * [base points, time limit (s), solve time (ms), hint used, points]
 */
const RACE_CASES: [number, number, number, boolean, number][] = [
  [100, 180, 0, false, 150],
  [100, 180, 30_000, false, 142],
  [100, 180, 60_000, false, 133],
  [100, 120, 30_000, false, 138],
  [100, 180, 60_000, true, 108],
  [200, 300, 100_000, false, 267],
  [200, 300, 100_000, true, 217],
  [300, 480, 240_000, false, 375],
  [300, 480, 1_000, true, 375],
  [100, 180, 179_999, false, 100],
  [100, 180, 180_000, false, 100],
  [100, 180, 180_000, true, 75],
  // Speed bonus exactly .5 (44.5, 58.5, 118.5): rounds up, not down.
  [100, 180, 19_800, false, 145],
  [200, 300, 127_500, false, 258],
  [300, 480, 100_800, false, 419],
];

describe("computeRaceScore", () => {
  it.each(RACE_CASES)(
    "base %i, %i s limit, solved in %i ms, hint %s: %i points",
    (basePoints, timeLimitSec, solveMs, hintUsed, points) => {
      expect(
        computeRaceScore({
          passed: true,
          basePoints,
          timeLimitSec,
          solveMs,
          hintUsed,
        }).total,
      ).toBe(points);
    },
  );

  it("adds up base + speed bonus - hint penalty", () => {
    expect(
      computeRaceScore({
        passed: true,
        basePoints: 200,
        timeLimitSec: 300,
        solveMs: 100_000,
        hintUsed: true,
      }),
    ).toEqual({ base: 200, speedBonus: 67, hintPenalty: 50, total: 217 });
  });

  it("matches Solo for a pass before the time limit", () => {
    expect(
      computeRaceScore({
        passed: true,
        basePoints: 100,
        timeLimitSec: 180,
        solveMs: 45_500,
        hintUsed: false,
      }),
    ).toEqual(
      computeScore({
        solved: true,
        basePoints: 100,
        timeLimitSec: 180,
        elapsedSec: 45.5,
        hintsUsed: 0,
      }),
    );
  });

  it("keeps the base points for a pass in the grace after the deadline", () => {
    expect(
      computeRaceScore({
        passed: true,
        basePoints: 100,
        timeLimitSec: 180,
        solveMs: 180_000,
        hintUsed: false,
      }),
    ).toEqual({ base: 100, speedBonus: 0, hintPenalty: 0, total: 100 });
  });

  it("scores 0 when given up or not solved", () => {
    const zero = { base: 0, speedBonus: 0, hintPenalty: 0, total: 0 };
    expect(
      computeRaceScore({
        passed: false,
        basePoints: 100,
        timeLimitSec: 180,
        solveMs: null,
        hintUsed: true,
      }),
    ).toEqual(zero);
    expect(
      computeRaceScore({
        passed: true,
        basePoints: 100,
        timeLimitSec: 180,
        solveMs: null,
        hintUsed: false,
      }),
    ).toEqual(zero);
  });
});
