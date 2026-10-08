import { describe, expect, it } from "vitest";
import {
  EMPTY_PROGRESS,
  applyRound,
  currentDailyStreak,
  sanitizeProgress,
  toDay,
  type RoundEvent,
} from "./progress";

function event(overrides: Partial<RoundEvent> = {}): RoundEvent {
  return {
    solved: true,
    language: "python",
    level: "easy",
    hintUsed: false,
    timeSec: 60,
    timeLimitSec: 180,
    day: "2026-03-10",
    ...overrides,
  };
}

describe("win streak", () => {
  it("counts consecutive solves and resets on a miss", () => {
    let p = applyRound(EMPTY_PROGRESS, event());
    p = applyRound(p, event());
    expect(p.winStreak).toBe(2);
    p = applyRound(p, event({ solved: false }));
    expect(p.winStreak).toBe(0);
    expect(p.bestWinStreak).toBe(2);
    expect(p.totalSolves).toBe(2);
  });
});

describe("daily streak", () => {
  it("starts at 1 and ignores extra rounds on the same day", () => {
    let p = applyRound(EMPTY_PROGRESS, event());
    p = applyRound(p, event());
    expect(p.dailyStreak).toBe(1);
  });

  it("grows on consecutive days, across month and year ends", () => {
    let p = applyRound(EMPTY_PROGRESS, event({ day: "2026-12-31" }));
    p = applyRound(p, event({ day: "2027-01-01" }));
    p = applyRound(p, event({ day: "2027-01-02" }));
    expect(p.dailyStreak).toBe(3);
  });

  it("restarts after a missed day but keeps the best", () => {
    let p = applyRound(EMPTY_PROGRESS, event({ day: "2026-03-10" }));
    p = applyRound(p, event({ day: "2026-03-11" }));
    p = applyRound(p, event({ day: "2026-03-13" }));
    expect(p.dailyStreak).toBe(1);
    expect(p.bestDailyStreak).toBe(2);
  });

  it("counts a failed round as playing that day", () => {
    const p = applyRound(EMPTY_PROGRESS, event({ solved: false }));
    expect(p.dailyStreak).toBe(1);
  });

  it("does not move backwards if the clock goes back", () => {
    let p = applyRound(EMPTY_PROGRESS, event({ day: "2026-03-10" }));
    p = applyRound(p, event({ day: "2026-03-09" }));
    expect(p.lastPlayedDay).toBe("2026-03-10");
  });

  it("keeps the streak if the clock goes back a day", () => {
    let p = applyRound(EMPTY_PROGRESS, event({ day: "2026-03-10" }));
    p = applyRound(p, event({ day: "2026-03-11" }));
    p = applyRound(p, event({ day: "2026-03-10" }));
    expect(p.dailyStreak).toBe(2);
    p = applyRound(p, event({ day: "2026-03-12" }));
    expect(p.dailyStreak).toBe(3);
  });

  it("shows 0 once a day has been missed", () => {
    const p = applyRound(EMPTY_PROGRESS, event({ day: "2026-03-10" }));
    expect(currentDailyStreak(p, "2026-03-10")).toBe(1);
    expect(currentDailyStreak(p, "2026-03-11")).toBe(1);
    expect(currentDailyStreak(p, "2026-03-12")).toBe(0);
    expect(currentDailyStreak(EMPTY_PROGRESS, "2026-03-12")).toBe(0);
  });
});

describe("toDay", () => {
  it("formats the local calendar day with padding", () => {
    expect(toDay(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("sanitizeProgress", () => {
  it.each([null, undefined, 5, "x", [], [1, 2]])("rejects %j", (value) => {
    expect(sanitizeProgress(value)).toEqual(EMPTY_PROGRESS);
  });

  it("drops bad fields but keeps good ones", () => {
    const p = sanitizeProgress({
      totalSolves: "many",
      winStreak: 4,
      bestWinStreak: 1,
      dailyStreak: -3,
      lastPlayedDay: "yesterday",
      solvedLanguages: ["python", "cobol", 7],
      hardSolves: 1.5,
      earned: { "hat-trick": "2026-03-10", broken: 12 },
    });
    expect(p).toMatchObject({
      totalSolves: 0,
      winStreak: 4,
      bestWinStreak: 4,
      dailyStreak: 0,
      lastPlayedDay: null,
      solvedLanguages: ["python"],
      hardSolves: 0,
      earned: { "hat-trick": "2026-03-10" },
    });
  });

  it("round-trips valid progress", () => {
    const p = applyRound(EMPTY_PROGRESS, event());
    expect(sanitizeProgress(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
});
