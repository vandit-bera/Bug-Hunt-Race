import { describe, expect, it } from "vitest";
import { DEFAULT_LAB_SETTINGS, parseLabSettings } from "./lab-settings";

describe("parseLabSettings", () => {
  it("uses the defaults without a query", () => {
    expect(parseLabSettings("")).toEqual(DEFAULT_LAB_SETTINGS);
  });

  it("reads language, level and rounds", () => {
    expect(parseLabSettings("?language=python&level=mixed&rounds=7")).toEqual({
      language: "python",
      level: "mixed",
      totalRounds: 7,
    });
  });

  it("reads endless rounds as null", () => {
    expect(parseLabSettings("?rounds=endless").totalRounds).toBeNull();
  });

  it.each([
    ["language=ruby", "language"],
    ["level=insane", "level"],
    ["rounds=0", "totalRounds"],
    ["rounds=51", "totalRounds"],
    ["rounds=2.5", "totalRounds"],
    ["rounds=", "totalRounds"],
  ] as const)("falls back to the default for %s", (query, key) => {
    expect(parseLabSettings(`?${query}`)[key]).toBe(DEFAULT_LAB_SETTINGS[key]);
  });
});
