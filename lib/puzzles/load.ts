import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { LANGUAGES } from "@/lib/runner/config";
import {
  countCodeLines,
  LEVEL_RULES,
  validatePuzzleMeta,
  type PuzzleMeta,
} from "./schema";

/**
 * Reads puzzle folders from disk (Node only: the checker and the index
 * build). Layout: `<root>/<language>/<level>/<id>/` holding `puzzle.json`,
 * `buggy.<ext>`, `fix.<ext>` and `tests.<ext>`.
 */

export interface PuzzleSource {
  meta: PuzzleMeta;
  buggy: string;
  fix: string;
  tests: string;
}

export interface PuzzleEntry {
  /** Folder relative to the root, e.g. `javascript/easy/sum-of-evens`. */
  dir: string;
  /** Set when the folder is valid; the code has not been run yet. */
  puzzle?: PuzzleSource;
  /** Format problems; empty when `puzzle` is set. */
  errors: string[];
}

/** Files at the root that are not puzzles. */
const ROOT_FILES = new Set(["README.md", "puzzle.schema.json"]);
const PUZZLE_FILES = ["buggy", "fix", "tests"] as const;

function listDir(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => !name.startsWith("."))
    .sort();
}

function isDir(file: string): boolean {
  return statSync(file).isDirectory();
}

function readJson(file: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(readFileSync(file, "utf8")) };
  } catch {
    return { ok: false };
  }
}

function loadPuzzleDir(root: string, dir: string): PuzzleEntry {
  const [language, level, id] = dir.split("/");
  const abs = path.join(root, dir);
  const errors: string[] = [];

  const metaFile = path.join(abs, "puzzle.json");
  const files = listDir(abs);
  if (!files.includes("puzzle.json")) {
    return { dir, errors: ["puzzle.json is missing"] };
  }
  const json = readJson(metaFile);
  if (!json.ok) return { dir, errors: ["puzzle.json is not valid JSON"] };
  const validation = validatePuzzleMeta(json.value);
  if (!validation.ok) return { dir, errors: validation.errors };
  const { meta } = validation;

  if (meta.id !== id) errors.push(`"id" must match the folder name "${id}"`);
  if (meta.language !== language) {
    errors.push(`"language" is ${meta.language} but the folder is ${language}`);
  }
  if (meta.level !== level) {
    errors.push(`"level" is ${meta.level} but the folder is ${level}`);
  }

  const ext = LANGUAGES[meta.language].fileExtension;
  const expected = ["puzzle.json", ...PUZZLE_FILES.map((f) => `${f}.${ext}`)];
  for (const name of expected) {
    if (!files.includes(name)) errors.push(`${name} is missing`);
  }
  for (const name of files) {
    if (!expected.includes(name)) errors.push(`${name} is not expected here`);
  }
  if (errors.length > 0) return { dir, errors };

  const [buggy, fix, tests] = PUZZLE_FILES.map((name) =>
    readFileSync(path.join(abs, `${name}.${ext}`), "utf8"),
  );

  const { minLines, maxLines } = LEVEL_RULES[meta.level];
  for (const [name, source] of [
    [`buggy.${ext}`, buggy],
    [`fix.${ext}`, fix],
  ] as const) {
    const lines = countCodeLines(source);
    if (lines < minLines || lines > maxLines) {
      errors.push(
        `${name} has ${lines} lines of code; ${meta.level} needs ${minLines}-${maxLines}`,
      );
    }
  }
  if (buggy.trim() === fix.trim()) {
    errors.push(`buggy.${ext} and fix.${ext} are identical`);
  }
  if (countCodeLines(tests) === 0) errors.push(`tests.${ext} is empty`);

  if (errors.length > 0) return { dir, errors };
  return { dir, puzzle: { meta, buggy, fix, tests }, errors: [] };
}

/**
 * Loads every puzzle folder under `root`. Never throws for a bad puzzle:
 * problems, including stray files and duplicate ids, come back as entries
 * with `errors`, so the checker can report all of them in one run.
 */
export function loadPuzzles(root: string): PuzzleEntry[] {
  const entries: PuzzleEntry[] = [];
  const walk = (rel: string, depth: number) => {
    for (const name of listDir(path.join(root, rel))) {
      const child = rel ? `${rel}/${name}` : name;
      if (depth === 0 && ROOT_FILES.has(name)) continue;
      if (!isDir(path.join(root, child))) {
        entries.push({
          dir: child,
          errors: ["Unexpected file: puzzles go in <language>/<level>/<id>/"],
        });
      } else if (depth === 2) {
        entries.push(loadPuzzleDir(root, child));
      } else {
        walk(child, depth + 1);
      }
    }
  };
  walk("", 0);

  const dirsById = new Map<string, string[]>();
  for (const entry of entries) {
    if (!entry.puzzle) continue;
    const dirs = dirsById.get(entry.puzzle.meta.id) ?? [];
    dirsById.set(entry.puzzle.meta.id, [...dirs, entry.dir]);
  }
  for (const entry of entries) {
    if (!entry.puzzle) continue;
    const others = dirsById
      .get(entry.puzzle.meta.id)!
      .filter((dir) => dir !== entry.dir);
    if (others.length > 0) {
      entry.errors.push(`"id" is also used by ${others.join(", ")}`);
      delete entry.puzzle;
    }
  }
  return entries;
}
