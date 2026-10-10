import { describe, expect, it } from "vitest";
import {
  COUNTDOWN_FROM,
  COUNTDOWN_STEP_MS,
  countdownElapsedMs,
  newSolves,
} from "./race-fx";

const START = "2026-10-09T12:00:00.000Z";
const START_MS = Date.parse(START);
const TOTAL = (COUNTDOWN_FROM + 1) * COUNTDOWN_STEP_MS;

describe("countdownElapsedMs", () => {
  it("counts from the server's countdown start", () => {
    expect(countdownElapsedMs(START, START_MS + 900, 0)).toBe(900);
  });

  it("corrects this device's clock with the offset", () => {
    // This clock is 2s behind the server.
    expect(countdownElapsedMs(START, START_MS - 1_500, 2_000)).toBe(500);
  });

  it("clamps to the countdown when the offset is known", () => {
    expect(countdownElapsedMs(START, START_MS - 300, 0)).toBe(0);
    expect(countdownElapsedMs(START, START_MS + 60_000, 0)).toBe(TOTAL);
  });

  it("trusts an unknown clock only inside the countdown", () => {
    expect(countdownElapsedMs(START, START_MS + 1_000, null)).toBe(1_000);
    expect(countdownElapsedMs(START, START_MS + 60_000, null)).toBe(0);
    expect(countdownElapsedMs(START, START_MS - 60_000, null)).toBe(0);
  });

  it("starts from the top for a bad timestamp", () => {
    expect(countdownElapsedMs("not a date", START_MS, 0)).toBe(0);
  });
});

describe("newSolves", () => {
  const scores = [
    { player_id: "c", passed: true, solve_time_ms: 30_000 },
    { player_id: "a", passed: true, solve_time_ms: 10_000 },
    { player_id: "x", passed: false, solve_time_ms: null },
    { player_id: "b", passed: true, solve_time_ms: 20_000 },
  ];

  it("lists passing results by solve time with their place", () => {
    expect(newSolves(scores, new Set())).toEqual([
      { playerId: "a", solveTimeMs: 10_000, place: 1 },
      { playerId: "b", solveTimeMs: 20_000, place: 2 },
      { playerId: "c", solveTimeMs: 30_000, place: 3 },
    ]);
  });

  it("skips solves already seen but keeps their places", () => {
    expect(newSolves(scores, new Set(["a", "b"]))).toEqual([
      { playerId: "c", solveTimeMs: 30_000, place: 3 },
    ]);
  });
});
