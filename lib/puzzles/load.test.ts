import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadPuzzles } from "./load";
import type { PuzzleMeta } from "./schema";

const CODE = (op: string) =>
  `// Returns n times two.\nfunction double(n) {\n  const factor = 2;\n  return n ${op} factor;\n}\n`;
const TESTS = 'test("doubles", () => {\n  expect(double(3)).toBe(6);\n});\n';

let root: string;

function meta(id: string, overrides: Partial<PuzzleMeta> = {}): PuzzleMeta {
  return {
    id,
    title: "Double",
    language: "javascript",
    level: "easy",
    description: "Doubles a number.",
    hint: "Read the operator.",
    bugCount: 1,
    timeLimitSec: 180,
    basePoints: 100,
    tags: ["operators"],
    ...overrides,
  };
}

function write(dir: string, files: Record<string, string>) {
  mkdirSync(path.join(root, dir), { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(root, dir, name), content);
  }
}

function puzzle(dir: string, metaJson: unknown, ext = "js") {
  write(dir, {
    "puzzle.json": JSON.stringify(metaJson),
    [`buggy.${ext}`]: CODE("+"),
    [`fix.${ext}`]: CODE("*"),
    [`tests.${ext}`]: TESTS,
  });
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "puzzles-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("loadPuzzles", () => {
  it("loads a valid puzzle and ignores the root docs", () => {
    write("", { "README.md": "# Puzzles", "puzzle.schema.json": "{}" });
    puzzle("javascript/easy/double", meta("double"));
    expect(loadPuzzles(root)).toEqual([
      {
        dir: "javascript/easy/double",
        errors: [],
        puzzle: {
          meta: meta("double"),
          buggy: CODE("+"),
          fix: CODE("*"),
          tests: TESTS,
        },
      },
    ]);
  });

  it("reports invalid JSON and a missing puzzle.json", () => {
    write("javascript/easy/broken", { "puzzle.json": "{ nope" });
    write("javascript/easy/empty", { "buggy.js": CODE("+") });
    expect(loadPuzzles(root)).toEqual([
      {
        dir: "javascript/easy/broken",
        errors: ["puzzle.json is not valid JSON"],
      },
      { dir: "javascript/easy/empty", errors: ["puzzle.json is missing"] },
    ]);
  });

  it("passes schema errors through", () => {
    puzzle("javascript/easy/double", { ...meta("double"), hint: "" });
    expect(loadPuzzles(root)[0].errors).toEqual([
      `"hint" must be a non-empty string`,
    ]);
  });

  it("requires the folder to match id, language and level", () => {
    puzzle(
      "javascript/medium/double",
      meta("twice", { language: "typescript" }),
    );
    expect(loadPuzzles(root)[0].errors).toEqual([
      `"id" must match the folder name "double"`,
      `"language" is typescript but the folder is javascript`,
      `"level" is easy but the folder is medium`,
      "buggy.ts is missing",
      "fix.ts is missing",
      "tests.ts is missing",
      "buggy.js is not expected here",
      "fix.js is not expected here",
      "tests.js is not expected here",
    ]);
  });

  it("enforces the line limits of the level on buggy and fix", () => {
    write("javascript/easy/double", {
      "puzzle.json": JSON.stringify(meta("double")),
      "buggy.js": "const x = 1;\n",
      "fix.js": Array.from({ length: 16 }, (_, i) => `x${i};`).join("\n"),
      "tests.js": TESTS,
    });
    expect(loadPuzzles(root)[0].errors).toEqual([
      "buggy.js has 1 lines of code; easy needs 5-15",
      "fix.js has 16 lines of code; easy needs 5-15",
    ]);
  });

  it("rejects identical buggy and fix, and empty tests", () => {
    write("javascript/easy/double", {
      "puzzle.json": JSON.stringify(meta("double")),
      "buggy.js": CODE("*"),
      "fix.js": `${CODE("*")}\n`,
      "tests.js": "\n",
    });
    expect(loadPuzzles(root)[0].errors).toEqual([
      "buggy.js and fix.js are identical",
      "tests.js is empty",
    ]);
  });

  it("rejects the same id in two folders", () => {
    puzzle("javascript/easy/double", meta("double"));
    puzzle(
      "typescript/easy/double",
      meta("double", { language: "typescript" }),
      "ts",
    );
    expect(loadPuzzles(root)).toEqual([
      {
        dir: "javascript/easy/double",
        errors: [`"id" is also used by typescript/easy/double`],
      },
      {
        dir: "typescript/easy/double",
        errors: [`"id" is also used by javascript/easy/double`],
      },
    ]);
  });

  it("reports files outside a puzzle folder", () => {
    write("javascript", { "notes.txt": "hi" });
    expect(loadPuzzles(root)).toEqual([
      {
        dir: "javascript/notes.txt",
        errors: ["Unexpected file: puzzles go in <language>/<level>/<id>/"],
      },
    ]);
  });
});
