import { LANGUAGES } from "@/lib/runner/config";
import type { LanguageId } from "@/lib/runner/types";

/**
 * Puzzle metadata (`puzzle.json`). Kept in sync with
 * `puzzles/puzzle.schema.json`, which editors use for autocomplete.
 */

export const PUZZLE_LEVELS = ["easy", "medium", "hard"] as const;
export type PuzzleLevel = (typeof PUZZLE_LEVELS)[number];

export interface LevelRules {
  timeLimitSec: number;
  basePoints: number;
  /** Lines of code (blank lines not counted) in `buggy.*` and `fix.*`. */
  minLines: number;
  maxLines: number;
  /** Allowed `bugCount`, inclusive. */
  minBugs: number;
  maxBugs: number;
}

export const LEVEL_RULES: Record<PuzzleLevel, LevelRules> = {
  easy: {
    timeLimitSec: 180,
    basePoints: 100,
    minLines: 5,
    maxLines: 15,
    minBugs: 1,
    maxBugs: 1,
  },
  medium: {
    timeLimitSec: 300,
    basePoints: 200,
    minLines: 15,
    maxLines: 40,
    minBugs: 1,
    maxBugs: 2,
  },
  hard: {
    timeLimitSec: 480,
    basePoints: 300,
    minLines: 40,
    maxLines: 80,
    minBugs: 2,
    maxBugs: 3,
  },
};

export const PUZZLE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PUZZLE_TAG_PATTERN = PUZZLE_ID_PATTERN;
export const MAX_BUG_COUNT = 3;

export interface PuzzleMeta {
  /** Kebab-case, unique across all puzzles, equal to the folder name. */
  id: string;
  title: string;
  language: LanguageId;
  level: PuzzleLevel;
  /** What the code is supposed to do. */
  description: string;
  hint: string;
  bugCount: number;
  timeLimitSec: number;
  basePoints: number;
  tags: string[];
}

const KEYS: readonly (keyof PuzzleMeta)[] = [
  "id",
  "title",
  "language",
  "level",
  "description",
  "hint",
  "bugCount",
  "timeLimitSec",
  "basePoints",
  "tags",
];

export type ValidationResult =
  { ok: true; meta: PuzzleMeta } | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isLanguage(value: unknown): value is LanguageId {
  return typeof value === "string" && Object.hasOwn(LANGUAGES, value);
}

function isLevel(value: unknown): value is PuzzleLevel {
  return (PUZZLE_LEVELS as readonly unknown[]).includes(value);
}

function bugRange({ minBugs, maxBugs }: LevelRules): string {
  return minBugs === maxBugs ? `${minBugs}` : `${minBugs} to ${maxBugs}`;
}

/** Validates parsed `puzzle.json` content. Reports every problem at once. */
export function validatePuzzleMeta(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, errors: ["puzzle.json must be a JSON object"] };
  }
  const errors: string[] = [];

  for (const key of KEYS) {
    if (!(key in value)) errors.push(`"${key}" is missing`);
  }
  for (const key of Object.keys(value)) {
    if (!(KEYS as readonly string[]).includes(key)) {
      errors.push(`"${key}" is not a known field`);
    }
  }

  const { id, language, level, bugCount, timeLimitSec, basePoints, tags } =
    value;

  if (
    "id" in value &&
    !(typeof id === "string" && PUZZLE_ID_PATTERN.test(id))
  ) {
    errors.push(`"id" must be kebab-case, e.g. "sum-of-evens"`);
  }
  for (const key of ["title", "description", "hint"] as const) {
    if (key in value && !isNonEmptyString(value[key])) {
      errors.push(`"${key}" must be a non-empty string`);
    }
  }
  if ("language" in value && !isLanguage(language)) {
    errors.push(
      `"language" must be one of: ${Object.keys(LANGUAGES).join(", ")}`,
    );
  }
  if ("level" in value && !isLevel(level)) {
    errors.push(`"level" must be one of: ${PUZZLE_LEVELS.join(", ")}`);
  }
  const isBugCount =
    Number.isInteger(bugCount) &&
    (bugCount as number) >= 1 &&
    (bugCount as number) <= MAX_BUG_COUNT;
  if ("bugCount" in value && !isBugCount) {
    errors.push(`"bugCount" must be a whole number from 1 to ${MAX_BUG_COUNT}`);
  }
  if (isLevel(level)) {
    const rules = LEVEL_RULES[level];
    if (
      isBugCount &&
      ((bugCount as number) < rules.minBugs ||
        (bugCount as number) > rules.maxBugs)
    ) {
      errors.push(`"bugCount" must be ${bugRange(rules)} for ${level}`);
    }
    if ("timeLimitSec" in value && timeLimitSec !== rules.timeLimitSec) {
      errors.push(`"timeLimitSec" must be ${rules.timeLimitSec} for ${level}`);
    }
    if ("basePoints" in value && basePoints !== rules.basePoints) {
      errors.push(`"basePoints" must be ${rules.basePoints} for ${level}`);
    }
  }
  if (
    "tags" in value &&
    !(
      Array.isArray(tags) &&
      tags.length > 0 &&
      tags.every(
        (tag) => typeof tag === "string" && PUZZLE_TAG_PATTERN.test(tag),
      )
    )
  ) {
    errors.push(
      `"tags" must be a non-empty list of kebab-case strings, e.g. ["off-by-one"]`,
    );
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, meta: value as unknown as PuzzleMeta };
}

/** Lines of code, blank lines not counted. */
export function countCodeLines(source: string): number {
  return source.split("\n").filter((line) => line.trim().length > 0).length;
}

/** What the app ships to players: everything except the reference fix. */
export interface PublicPuzzle extends PuzzleMeta {
  buggy: string;
  tests: string;
}
