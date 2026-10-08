import { describe, expect, it } from "vitest";
import {
  clockOffsetMs,
  elapsedMs,
  formatTimeLeft,
  timeLeftMs,
  type RoundClock,
} from "./round-clock";

const START = Date.parse("2026-10-08T12:00:00.000Z");
const at = (ms: number) => new Date(START + ms).toISOString();

const live: RoundClock = {
  startedAt: at(0),
  pausedAt: null,
  pausedMs: 0,
  endedAt: null,
  timeLimitSeconds: 180,
};

describe("timeLeftMs", () => {
  it("counts down from the time limit", () => {
    expect(timeLeftMs(live, START)).toBe(180_000);
    expect(timeLeftMs(live, START + 60_000)).toBe(120_000);
  });

  it("adds earlier pauses back", () => {
    const round = { ...live, pausedMs: 30_000 };
    expect(timeLeftMs(round, START + 90_000)).toBe(120_000);
  });

  it("is frozen while paused", () => {
    // 40 s of play, paused since then, 30 s of earlier pauses.
    const round = { ...live, pausedMs: 30_000, pausedAt: at(70_000) };
    expect(timeLeftMs(round, START + 70_000)).toBe(140_000);
    expect(timeLeftMs(round, START + 500_000)).toBe(140_000);
  });

  it("stops when the round ends", () => {
    const round = { ...live, endedAt: at(45_000) };
    expect(timeLeftMs(round, START + 100_000)).toBe(135_000);
  });

  it("never goes below 0 or above the limit", () => {
    expect(timeLeftMs(live, START + 999_000)).toBe(0);
    expect(timeLeftMs(live, START - 5_000)).toBe(180_000);
  });

  it("is the same for every client once each applies its clock offset", () => {
    const round = { ...live, pausedMs: 12_000 };
    const serverNow = START + 75_000;
    // Three clients whose clocks are off by different amounts, each with a
    // different network delay on the request that measured its offset.
    const clients = [
      { skew: 0, delay: 40 },
      { skew: -4_000, delay: 300 },
      { skew: 7_500, delay: 120 },
    ];
    const shown = clients.map(({ skew, delay }) => {
      const sent = serverNow - delay / 2 + skew;
      const received = serverNow + delay / 2 + skew;
      const offset = clockOffsetMs(
        new Date(serverNow).toISOString(),
        sent,
        received,
      );
      const localNow = serverNow + skew;
      return timeLeftMs(round, localNow + offset);
    });
    expect(new Set(shown)).toEqual(new Set([117_000]));
  });
});

describe("elapsedMs", () => {
  it("is play time without pauses", () => {
    expect(elapsedMs({ ...live, pausedMs: 10_000 }, START + 50_000)).toBe(
      40_000,
    );
  });
});

describe("clockOffsetMs", () => {
  it("is how far the server clock is ahead", () => {
    expect(clockOffsetMs(at(10_000), START, START + 200)).toBe(9_900);
    expect(clockOffsetMs(at(0), START + 3_000, START + 3_000)).toBe(-3_000);
  });
});

describe("formatTimeLeft", () => {
  it("shows m:ss, rounding up", () => {
    expect(formatTimeLeft(180_000)).toBe("3:00");
    expect(formatTimeLeft(65_001)).toBe("1:06");
    expect(formatTimeLeft(9_000)).toBe("0:09");
    expect(formatTimeLeft(1)).toBe("0:01");
    expect(formatTimeLeft(0)).toBe("0:00");
    expect(formatTimeLeft(-50)).toBe("0:00");
  });
});
