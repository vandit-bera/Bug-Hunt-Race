import type { RunRequest, RunResult } from "@/lib/runner/types";
import type { PuzzleEntry, PuzzleSource } from "./load";

export type RunCode = (request: RunRequest) => Promise<RunResult>;

export interface PuzzleCheck {
  dir: string;
  ok: boolean;
  errors: string[];
}

function summarize(result: RunResult): string {
  if (result.status === "error" || result.status === "timeout") {
    return `${result.status}: ${result.error ?? "unknown error"}`;
  }
  const failed = result.tests.filter((test) => !test.passed);
  return `${result.tests.length - failed.length}/${result.tests.length} tests passed`;
}

function firstFailures(result: RunResult): string {
  return result.tests
    .filter((test) => !test.passed)
    .slice(0, 3)
    .map((test) => `\n      - ${test.name}: ${test.message ?? "failed"}`)
    .join("");
}

/**
 * Proves a puzzle is fair: the buggy code must fail at least one test (a
 * syntax error or crash does not count, the player must see a failing test),
 * and the reference fix must pass every test.
 */
export async function checkPuzzle(
  puzzle: PuzzleSource,
  run: RunCode,
): Promise<string[]> {
  const { language } = puzzle.meta;
  const [buggy, fix] = await Promise.all([
    run({ language, code: puzzle.buggy, tests: puzzle.tests }),
    run({ language, code: puzzle.fix, tests: puzzle.tests }),
  ]);
  const errors: string[] = [];
  if (buggy.status !== "failed") {
    errors.push(
      `buggy code must fail at least one test, got ${summarize(buggy)}`,
    );
  }
  if (fix.status !== "passed") {
    errors.push(
      `reference fix must pass every test, got ${summarize(fix)}${firstFailures(fix)}`,
    );
  }
  return errors;
}

/**
 * Runs `checkPuzzle` on every valid entry; format errors pass through. At most
 * `concurrency` puzzles run at once so a big pack does not starve the worker
 * threads and trip the 5 s timeout. Results keep the input order.
 */
export async function checkEntries(
  entries: PuzzleEntry[],
  run: RunCode,
  concurrency = 4,
): Promise<PuzzleCheck[]> {
  const results: PuzzleCheck[] = new Array(entries.length);
  let next = 0;
  const work = async () => {
    while (next < entries.length) {
      const index = next++;
      const { dir, puzzle, errors } = entries[index];
      const all = puzzle ? await checkPuzzle(puzzle, run) : errors;
      results[index] = { dir, ok: all.length === 0, errors: all };
    }
  };
  await Promise.all(Array.from({ length: concurrency }, work));
  return results;
}
