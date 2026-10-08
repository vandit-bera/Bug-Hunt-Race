import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LANGUAGES } from "@/lib/runner/config";
import {
  countCodeLines,
  LEVEL_RULES,
  MAX_BUG_COUNT,
  PUZZLE_ID_PATTERN,
  PUZZLE_LEVELS,
  validatePuzzleMeta,
  type PuzzleMeta,
} from "./schema";

const VALID: PuzzleMeta = {
  id: "sum-of-evens",
  title: "Sum of evens",
  language: "javascript",
  level: "easy",
  description: "Sums the even numbers.",
  hint: "Look at the loop.",
  bugCount: 1,
  timeLimitSec: 180,
  basePoints: 100,
  tags: ["off-by-one"],
};

function errorsFor(value: unknown): string[] {
  const result = validatePuzzleMeta(value);
  return result.ok ? [] : result.errors;
}

describe("validatePuzzleMeta", () => {
  it("accepts a valid puzzle", () => {
    expect(validatePuzzleMeta(VALID)).toEqual({ ok: true, meta: VALID });
  });

  it("accepts every level with its own time limit and points", () => {
    for (const level of PUZZLE_LEVELS) {
      const { timeLimitSec, basePoints, minBugs } = LEVEL_RULES[level];
      expect(
        errorsFor({
          ...VALID,
          level,
          timeLimitSec,
          basePoints,
          bugCount: minBugs,
        }),
      ).toEqual([]);
    }
  });

  it("rejects a non-object", () => {
    expect(errorsFor([])).toEqual(["puzzle.json must be a JSON object"]);
    expect(errorsFor(null)).toEqual(["puzzle.json must be a JSON object"]);
  });

  it("reports missing and unknown fields", () => {
    const value: Record<string, unknown> = { ...VALID, fix: "x" };
    delete value.hint;
    expect(errorsFor(value)).toEqual([
      `"hint" is missing`,
      `"fix" is not a known field`,
    ]);
  });

  it("reports every bad value at once", () => {
    expect(
      errorsFor({
        ...VALID,
        id: "Sum Of Evens",
        title: " ",
        language: "ruby",
        level: "expert",
        bugCount: 1.5,
        tags: ["Off By One"],
      }),
    ).toEqual([
      `"id" must be kebab-case, e.g. "sum-of-evens"`,
      `"title" must be a non-empty string`,
      `"language" must be one of: javascript, typescript, python`,
      `"level" must be one of: easy, medium, hard`,
      `"bugCount" must be a whole number from 1 to ${MAX_BUG_COUNT}`,
      `"tags" must be a non-empty list of kebab-case strings, e.g. ["off-by-one"]`,
    ]);
  });

  it("requires the time limit and points of the level", () => {
    expect(
      errorsFor({
        ...VALID,
        level: "hard",
        timeLimitSec: 180,
        basePoints: 100,
        bugCount: 2,
      }),
    ).toEqual([
      `"timeLimitSec" must be 480 for hard`,
      `"basePoints" must be 300 for hard`,
    ]);
  });

  it("requires the bug count of the level", () => {
    const hard = {
      ...VALID,
      level: "hard",
      timeLimitSec: 480,
      basePoints: 300,
    };
    const medium = {
      ...VALID,
      level: "medium",
      timeLimitSec: 300,
      basePoints: 200,
    };
    expect(errorsFor({ ...VALID, bugCount: 2 })).toEqual([
      `"bugCount" must be 1 for easy`,
    ]);
    expect(errorsFor({ ...medium, bugCount: 2 })).toEqual([]);
    expect(errorsFor({ ...medium, bugCount: 3 })).toEqual([
      `"bugCount" must be 1 to 2 for medium`,
    ]);
    expect(errorsFor({ ...hard, bugCount: 1 })).toEqual([
      `"bugCount" must be 2 to 3 for hard`,
    ]);
    expect(errorsFor({ ...hard, bugCount: 2 })).toEqual([]);
    expect(errorsFor({ ...hard, bugCount: 3 })).toEqual([]);
  });

  it("rejects bug counts out of range and empty tags", () => {
    expect(errorsFor({ ...VALID, bugCount: 0, tags: [] })).toHaveLength(2);
    expect(errorsFor({ ...VALID, bugCount: MAX_BUG_COUNT + 1 })).toHaveLength(
      1,
    );
  });
});

describe("countCodeLines", () => {
  it("skips blank lines", () => {
    expect(countCodeLines("a\n\n  \nb\n")).toBe(2);
    expect(countCodeLines("")).toBe(0);
  });
});

describe("puzzles/puzzle.schema.json", () => {
  const schema = JSON.parse(
    readFileSync("puzzles/puzzle.schema.json", "utf8"),
  ) as {
    required: string[];
    properties: Record<string, Record<string, unknown>>;
    allOf: {
      if: { properties: { level: { const: string } } };
      then: {
        properties: {
          timeLimitSec: { const: number };
          basePoints: { const: number };
          bugCount: { minimum: number; maximum: number };
        };
      };
    }[];
  };

  it("matches the TypeScript validator", () => {
    expect([...schema.required].sort()).toEqual(Object.keys(VALID).sort());
    expect(schema.properties.language.enum).toEqual(Object.keys(LANGUAGES));
    expect(schema.properties.level.enum).toEqual([...PUZZLE_LEVELS]);
    expect(schema.properties.id.pattern).toBe(PUZZLE_ID_PATTERN.source);
    expect(schema.properties.bugCount.maximum).toBe(MAX_BUG_COUNT);

    const rules = Object.fromEntries(
      schema.allOf.map(({ if: when, then }) => [
        when.properties.level.const,
        {
          timeLimitSec: then.properties.timeLimitSec.const,
          basePoints: then.properties.basePoints.const,
          minBugs: then.properties.bugCount.minimum,
          maxBugs: then.properties.bugCount.maximum,
        },
      ]),
    );
    expect(rules).toEqual(
      Object.fromEntries(
        PUZZLE_LEVELS.map((level) => [
          level,
          {
            timeLimitSec: LEVEL_RULES[level].timeLimitSec,
            basePoints: LEVEL_RULES[level].basePoints,
            minBugs: LEVEL_RULES[level].minBugs,
            maxBugs: LEVEL_RULES[level].maxBugs,
          },
        ]),
      ),
    );
  });
});
