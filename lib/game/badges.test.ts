import { describe, expect, it } from "vitest";
import { recordRound, BADGES } from "./badges";
import { EMPTY_PROGRESS, type Progress, type RoundEvent } from "./progress";

function event(overrides: Partial<RoundEvent> = {}): RoundEvent {
  return {
    solved: true,
    language: "javascript",
    level: "easy",
    hintUsed: true,
    timeSec: 100,
    timeLimitSec: 180,
    day: "2026-03-10",
    ...overrides,
  };
}

function play(events: RoundEvent[], start: Progress = EMPTY_PROGRESS) {
  let progress = start;
  const unlocked: string[][] = [];
  for (const e of events) {
    const outcome = recordRound(progress, e);
    progress = outcome.progress;
    unlocked.push(outcome.newBadges.map((b) => b.id));
  }
  return { progress, unlocked };
}

describe("First Blood", () => {
  it("is earned by the first solve only", () => {
    const { unlocked } = play([event(), event()]);
    expect(unlocked[0]).toContain("first-blood");
    expect(unlocked[1]).not.toContain("first-blood");
  });

  it("is not earned by a failed round, but by the first solve after it", () => {
    const { unlocked } = play([event({ solved: false }), event()]);
    expect(unlocked[0]).toEqual([]);
    expect(unlocked[1]).toContain("first-blood");
  });
});

describe("Speed Demon", () => {
  it("needs a solve under 25% of the time limit", () => {
    expect(play([event({ timeSec: 44 })]).unlocked[0]).toContain("speed-demon");
  });

  it("is not earned at exactly 25%", () => {
    expect(play([event({ timeSec: 45 })]).unlocked[0]).not.toContain(
      "speed-demon",
    );
  });

  it("is not earned by a fast give-up", () => {
    expect(play([event({ solved: false, timeSec: 1 })]).unlocked[0]).toEqual(
      [],
    );
  });
});

describe("No Hints Needed", () => {
  it("is earned by a solve without a hint", () => {
    expect(play([event({ hintUsed: false })]).unlocked[0]).toContain(
      "no-hints-needed",
    );
  });

  it("is not earned when the hint was used", () => {
    expect(play([event()]).unlocked[0]).not.toContain("no-hints-needed");
  });
});

describe("Hat Trick", () => {
  it("is earned by the third solve in a row", () => {
    const { unlocked } = play([event(), event(), event()]);
    expect(unlocked[1]).not.toContain("hat-trick");
    expect(unlocked[2]).toContain("hat-trick");
  });

  it("is reset by a failed round", () => {
    const { unlocked } = play([
      event(),
      event(),
      event({ solved: false }),
      event(),
      event(),
    ]);
    expect(unlocked.flat()).not.toContain("hat-trick");
  });
});

describe("Polyglot", () => {
  it("needs a solve in every language", () => {
    const { unlocked } = play([
      event({ language: "javascript" }),
      event({ language: "typescript" }),
      event({ language: "javascript" }),
      event({ language: "python" }),
    ]);
    expect(unlocked.flat().filter((id) => id === "polyglot")).toHaveLength(1);
    expect(unlocked[3]).toContain("polyglot");
  });

  it("ignores failed rounds", () => {
    const { unlocked } = play([
      event({ language: "javascript" }),
      event({ language: "typescript" }),
      event({ language: "python", solved: false }),
    ]);
    expect(unlocked.flat()).not.toContain("polyglot");
  });
});

describe("Bug Exterminator", () => {
  it("is earned by the 10th Hard solve, not before", () => {
    const rounds = Array.from({ length: 10 }, () => event({ level: "hard" }));
    const { unlocked } = play(rounds);
    expect(unlocked.slice(0, 9).flat()).not.toContain("bug-exterminator");
    expect(unlocked[9]).toContain("bug-exterminator");
  });

  it("does not count other levels or failed Hard rounds", () => {
    const rounds = [
      ...Array.from({ length: 9 }, () => event({ level: "hard" })),
      event({ level: "medium" }),
      event({ level: "hard", solved: false }),
    ];
    expect(play(rounds).unlocked.flat()).not.toContain("bug-exterminator");
  });
});

describe("recordRound", () => {
  it("never awards a badge twice and keeps the earned day", () => {
    const first = play([event({ hintUsed: false })]);
    const second = recordRound(
      first.progress,
      event({ hintUsed: false, day: "2026-03-11" }),
    );
    expect(second.newBadges).toEqual([]);
    expect(second.progress.earned["no-hints-needed"]).toBe("2026-03-10");
  });

  it("does not change the progress it was given", () => {
    const before = JSON.stringify(EMPTY_PROGRESS);
    recordRound(EMPTY_PROGRESS, event());
    expect(JSON.stringify(EMPTY_PROGRESS)).toBe(before);
  });

  it("gives every badge a unique id and how-to text", () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
    expect(BADGES.every((b) => b.howTo.length > 0)).toBe(true);
  });
});
