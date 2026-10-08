import { describe, expect, it } from "vitest";
import { computeScore } from "./scoring";

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
