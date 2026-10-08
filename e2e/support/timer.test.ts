import { describe, expect, it } from "vitest";
import { isWithinTolerance, parseTimerSeconds } from "./timer";

describe("parseTimerSeconds", () => {
  it.each([
    ["1:05", 65],
    ["0:09", 9],
    ["Time left 2:30", 150],
    ["45s", 45],
    ["45 s left", 45],
    ["7", 7],
  ])("reads %j as %i s", (text, seconds) => {
    expect(parseTimerSeconds(text)).toBe(seconds);
  });

  it("returns null without a time", () => {
    expect(parseTimerSeconds("Paused")).toBeNull();
    expect(parseTimerSeconds("")).toBeNull();
  });
});

describe("isWithinTolerance", () => {
  it("accepts a difference up to the tolerance either way", () => {
    expect(isWithinTolerance(28, 30, 2)).toBe(true);
    expect(isWithinTolerance(32, 30, 2)).toBe(true);
    expect(isWithinTolerance(30, 30, 0)).toBe(true);
  });

  it("rejects a bigger difference or no reading", () => {
    expect(isWithinTolerance(27, 30, 2)).toBe(false);
    expect(isWithinTolerance(33, 30, 2)).toBe(false);
    expect(isWithinTolerance(null, 30, 2)).toBe(false);
  });
});
