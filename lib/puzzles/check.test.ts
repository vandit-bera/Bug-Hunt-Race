import { describe, expect, it } from "vitest";
import { runInNode } from "@/lib/runner/node";
import type { RunRequest, RunResult } from "@/lib/runner/types";
import { checkEntries } from "./check";
import { loadPuzzles } from "./load";

const FIXTURES = "lib/puzzles/fixtures";

describe("checkEntries", () => {
  it("accepts a puzzle whose buggy code fails and fix passes", async () => {
    const results = await checkEntries(
      loadPuzzles(`${FIXTURES}/valid`),
      runInNode,
    );
    expect(results).toEqual([
      { dir: "javascript/easy/double-it", ok: true, errors: [] },
    ]);
  });

  it("rejects every kind of broken puzzle", async () => {
    const results = await checkEntries(
      loadPuzzles(`${FIXTURES}/broken`),
      runInNode,
    );
    expect(results).toEqual([
      {
        dir: "javascript/easy/bad-meta",
        ok: false,
        errors: [
          `"hint" is missing`,
          `"level" must be one of: easy, medium, hard`,
          `"bugCount" must be a whole number from 1 to 3`,
          `"tags" must be a non-empty list of kebab-case strings, e.g. ["off-by-one"]`,
        ],
      },
      {
        dir: "javascript/easy/buggy-crashes",
        ok: false,
        errors: [
          "buggy code must fail at least one test, got error: Error: crashed while loading",
        ],
      },
      {
        dir: "javascript/easy/buggy-passes",
        ok: false,
        errors: [
          "buggy code must fail at least one test, got 2/2 tests passed",
        ],
      },
      {
        dir: "javascript/easy/fix-fails",
        ok: false,
        errors: [
          "reference fix must pass every test, got 0/2 tests passed" +
            "\n      - doubles 3: Expected 6, received 1" +
            "\n      - doubles 0: Expected 0, received -2",
        ],
      },
    ]);
  });

  it("limits how many runs happen at once and keeps the order", async () => {
    const [entry] = loadPuzzles(`${FIXTURES}/valid`);
    const entries = Array.from({ length: 6 }, (_, i) => ({
      ...entry,
      dir: `puzzle-${i}`,
    }));
    let active = 0;
    let peak = 0;
    const run = async (request: RunRequest): Promise<RunResult> => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      const passed = request.code === entry.puzzle!.fix;
      return {
        status: passed ? "passed" : "failed",
        tests: [{ name: "t", passed }],
        output: "",
        durationMs: 0,
      };
    };
    const results = await checkEntries(entries, run, 2);
    expect(results.map((result) => result.dir)).toEqual(
      entries.map((e) => e.dir),
    );
    expect(results.every((result) => result.ok)).toBe(true);
    // Each puzzle runs its buggy code and fix side by side.
    expect(peak).toBe(4);
  });
});
