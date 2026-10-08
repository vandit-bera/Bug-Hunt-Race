import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PUZZLES } from "@/lib/puzzles/generated";
import {
  PUZZLE_INDEX_FILE,
  renderPuzzleIndex,
  toPublicPuzzle,
} from "./index-file";
import { loadPuzzles } from "./load";

const sources = loadPuzzles("puzzles").flatMap(({ puzzle }) =>
  puzzle ? [puzzle] : [],
);
const indexSource = readFileSync(PUZZLE_INDEX_FILE, "utf8");

describe("generated puzzle index", () => {
  it("lists every puzzle in puzzles/", () => {
    expect(PUZZLES.map((p) => p.id).sort()).toEqual(
      sources.map((p) => p.meta.id).sort(),
    );
  });

  it("is up to date", async () => {
    expect(
      await renderPuzzleIndex(sources, path.resolve(PUZZLE_INDEX_FILE)),
    ).toBe(indexSource);
  });

  it("never contains a reference fix", () => {
    for (const { meta, fix } of sources) {
      expect(indexSource, meta.id).not.toContain(JSON.stringify(fix));
      expect(JSON.stringify(PUZZLES), meta.id).not.toContain(
        JSON.stringify(fix),
      );
    }
    for (const puzzle of PUZZLES) {
      expect(Object.keys(puzzle)).not.toContain("fix");
    }
  });

  it("keeps the buggy code and tests players need", () => {
    for (const source of sources) {
      const puzzle = PUZZLES.find((p) => p.id === source.meta.id);
      expect(puzzle).toEqual({
        ...source.meta,
        buggy: source.buggy,
        tests: source.tests,
      });
    }
  });
});

describe("toPublicPuzzle", () => {
  it("drops the fix", () => {
    const [source] = sources;
    expect(toPublicPuzzle(source)).not.toHaveProperty("fix");
  });
});
