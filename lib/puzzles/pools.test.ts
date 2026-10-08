import { describe, expect, it } from "vitest";
import { PUZZLES } from "@/lib/puzzles/generated";
import { countPools, poolSize } from "./pools";

describe("countPools", () => {
  it("starts every language and level at 0", () => {
    expect(countPools([])).toEqual({
      javascript: { easy: 0, medium: 0, hard: 0 },
      typescript: { easy: 0, medium: 0, hard: 0 },
      python: { easy: 0, medium: 0, hard: 0 },
    });
  });

  it("counts puzzles per language and level", () => {
    const sizes = countPools([
      { language: "python", level: "easy" },
      { language: "python", level: "easy" },
      { language: "python", level: "hard" },
      { language: "typescript", level: "medium" },
    ]);
    expect(sizes.python).toEqual({ easy: 2, medium: 0, hard: 1 });
    expect(sizes.typescript).toEqual({ easy: 0, medium: 1, hard: 0 });
    expect(sizes.javascript).toEqual({ easy: 0, medium: 0, hard: 0 });
  });

  it("matches the puzzle pack", () => {
    const sizes = countPools(PUZZLES);
    for (const puzzle of PUZZLES) {
      expect(sizes[puzzle.language][puzzle.level]).toBe(
        PUZZLES.filter(
          (p) => p.language === puzzle.language && p.level === puzzle.level,
        ).length,
      );
    }
  });
});

describe("poolSize", () => {
  const sizes = countPools([
    { language: "javascript", level: "easy" },
    { language: "javascript", level: "hard" },
    { language: "javascript", level: "hard" },
  ]);

  it("returns one level's count", () => {
    expect(poolSize(sizes, "javascript", "hard")).toBe(2);
    expect(poolSize(sizes, "javascript", "medium")).toBe(0);
  });

  it("adds up every level for Mixed", () => {
    expect(poolSize(sizes, "javascript", "mixed")).toBe(3);
    expect(poolSize(sizes, "python", "mixed")).toBe(0);
  });
});
