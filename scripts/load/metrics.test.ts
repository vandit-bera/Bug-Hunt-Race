import { describe, expect, it } from "vitest";
import {
  MessageMeter,
  checkDuplicateNames,
  distinctSnapshots,
  expectedRanks,
  frameEvent,
  messageKind,
  percentile,
  summarize,
} from "./metrics";

describe("percentile", () => {
  it("uses the nearest rank", () => {
    const values = [5, 1, 4, 2, 3, 10, 9, 8, 7, 6];
    expect(percentile(values, 50)).toBe(5);
    expect(percentile(values, 95)).toBe(10);
    expect(percentile(values, 10)).toBe(1);
  });

  it("handles one value and no values", () => {
    expect(percentile([42], 95)).toBe(42);
    expect(percentile([], 50)).toBeNaN();
  });
});

describe("summarize", () => {
  it("reports count, p50, p95 and max", () => {
    expect(summarize([300, 100, 200])).toEqual({
      count: 3,
      p50: 200,
      p95: 300,
      max: 300,
    });
  });
});

describe("frameEvent", () => {
  it("reads protocol 2.0.0 array frames", () => {
    const frame = JSON.stringify([
      null,
      null,
      "realtime:room:1",
      "presence_diff",
      {},
    ]);
    expect(frameEvent(frame)).toBe("presence_diff");
  });

  it("reads protocol 1.0.0 object frames", () => {
    const frame = JSON.stringify({
      topic: "phoenix",
      event: "phx_reply",
      payload: {},
      ref: "1",
    });
    expect(frameEvent(frame)).toBe("phx_reply");
  });

  it("names binary and unparsable frames", () => {
    expect(frameEvent(new ArrayBuffer(4))).toBe("binary");
    expect(frameEvent("not json")).toBe("unknown");
    expect(frameEvent("[1,2]")).toBe("unknown");
  });
});

describe("messageKind", () => {
  it("groups room updates and skips protocol replies", () => {
    expect(messageKind("postgres_changes")).toBe("postgres_changes");
    expect(messageKind("presence_state")).toBe("presence");
    expect(messageKind("presence_diff")).toBe("presence");
    expect(messageKind("system")).toBe("other");
    expect(messageKind("phx_reply")).toBeNull();
    expect(messageKind("heartbeat")).toBeNull();
  });

  it("counts only presence updates among sent messages", () => {
    expect(messageKind("presence", true)).toBe("presence_sent");
    expect(messageKind("phx_join", true)).toBeNull();
    expect(messageKind("access_token", true)).toBeNull();
  });
});

describe("MessageMeter", () => {
  it("finds the busiest second per kind and overall", () => {
    const meter = new MessageMeter(1_000);
    meter.record("presence_diff", 1_100);
    meter.record("presence_diff", 1_900);
    meter.record("postgres_changes", 2_100);
    meter.record("postgres_changes", 2_200);
    meter.record("postgres_changes", 2_999);
    meter.record("phx_reply", 2_500);

    expect(meter.peak()).toEqual({ perSecond: 3, atMs: 1_000 });
    expect(meter.peak("presence")).toEqual({ perSecond: 2, atMs: 0 });
    expect(meter.total()).toBe(5);
    expect(meter.totals.get("postgres_changes")).toBe(3);
  });

  it("keeps a peak per phase, splitting a window at a phase change", () => {
    const meter = new MessageMeter(0);
    meter.setPhase("join");
    meter.record("presence_diff", 100);
    meter.record("presence_diff", 200);
    meter.setPhase("round");
    meter.record("postgres_changes", 300);
    meter.record("postgres_changes", 1_500);

    expect(meter.peak("all", "join")).toEqual({ perSecond: 2, atMs: 0 });
    expect(meter.peak("all", "round")).toEqual({ perSecond: 1, atMs: 0 });
    expect(meter.peak("presence", "round")).toEqual({ perSecond: 0, atMs: 0 });
    expect(meter.peak()).toEqual({ perSecond: 3, atMs: 0 });
  });

  it("keeps sent presence updates out of the received totals", () => {
    const meter = new MessageMeter(0);
    meter.record("presence", 100, true);
    meter.record("presence_diff", 200);

    expect(meter.total()).toBe(1);
    expect(meter.peak()).toEqual({ perSecond: 1, atMs: 0 });
    expect(meter.peak("presence_sent")).toEqual({ perSecond: 1, atMs: 0 });
  });

  it("reports zero when nothing was received", () => {
    expect(new MessageMeter(0).peak()).toEqual({ perSecond: 0, atMs: 0 });
  });
});

describe("checkDuplicateNames", () => {
  it("accepts Name, Name (2), Name (3) in any order", () => {
    const granted = new Map([
      ["Riya", ["Riya (3)", "Riya", "Riya (2)"]],
      ["Ben", ["Ben"]],
    ]);
    expect(checkDuplicateNames(granted)).toEqual([]);
  });

  it("reports a repeated or missing suffix", () => {
    const granted = new Map([["Riya", ["Riya", "Riya", "Riya (3)"]]]);
    expect(checkDuplicateNames(granted)).toHaveLength(1);
  });
});

describe("expectedRanks", () => {
  it("ranks by points, then lower server solve time; exact ties share", () => {
    const ranks = expectedRanks([
      { playerId: "a", points: 100, solveMs: 900 },
      { playerId: "b", points: 120, solveMs: 950 },
      { playerId: "c", points: 100, solveMs: 800 },
      { playerId: "d", points: 100, solveMs: 900 },
      { playerId: "e", points: 0, solveMs: 0 },
    ]);
    expect(Object.fromEntries(ranks)).toEqual({ b: 1, c: 2, a: 3, d: 3, e: 5 });
  });
});

describe("distinctSnapshots", () => {
  it("counts how many clients hold each distinct view", () => {
    expect(
      distinctSnapshots([
        [1, 2],
        [1, 2],
        [2, 1],
      ]),
    ).toEqual([2, 1]);
    expect(distinctSnapshots([{ a: 1 }, { a: 1 }])).toEqual([2]);
  });
});
