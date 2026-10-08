import { describe, expect, it } from "vitest";
import type { PublicPuzzle } from "@/lib/puzzles/schema";
import { levelForRound, pickPuzzle } from "./solo-pick";

function puzzle(id: string): PublicPuzzle {
  return { id } as PublicPuzzle;
}

const pool = [puzzle("a"), puzzle("b"), puzzle("c")];

describe("levelForRound", () => {
  it("keeps a fixed level", () => {
    expect(levelForRound("hard", 5)).toBe("hard");
  });

  it("steps Easy, Medium, Hard, then starts again in Mixed", () => {
    expect(
      [0, 1, 2, 3, 4].map((round) => levelForRound("mixed", round)),
    ).toEqual(["easy", "medium", "hard", "easy", "medium"]);
  });
});

describe("levelForRound with missing levels", () => {
  const noMedium = (level: string) => level !== "medium";

  it("skips levels without puzzles in Mixed", () => {
    expect(levelForRound("mixed", 1, noMedium)).toBe("hard");
  });

  it("returns null when the chosen level or every level is empty", () => {
    expect(levelForRound("medium", 0, noMedium)).toBeNull();
    expect(levelForRound("mixed", 0, () => false)).toBeNull();
  });
});

describe("pickPuzzle", () => {
  it("returns null for an empty pool", () => {
    expect(pickPuzzle([], [])).toBeNull();
  });

  it("never repeats until the pool is exhausted", () => {
    let played: string[] = [];
    const seen: string[] = [];
    for (let i = 0; i < pool.length; i++) {
      const pick = pickPuzzle(pool, played, () => 0)!;
      seen.push(pick.puzzle.id);
      played = pick.played;
    }
    expect(seen.toSorted()).toEqual(["a", "b", "c"]);
  });

  it("starts the history again after the pool is exhausted", () => {
    const pick = pickPuzzle(pool, ["a", "b", "c"], () => 0.99)!;
    expect(pick.puzzle.id).toBe("b");
    expect(pick.played).toEqual(["b"]);
  });

  it("never picks the last played puzzle after the pool is exhausted", () => {
    for (const random of [0, 0.5, 0.99]) {
      const pick = pickPuzzle(pool, ["a", "c", "b"], () => random)!;
      expect(pick.puzzle.id).not.toBe("b");
    }
  });

  it("uses the last played id that is still in the pool", () => {
    const pick = pickPuzzle(pool, ["a", "b", "c", "gone"], () => 0.99)!;
    expect(pick.puzzle.id).toBe("b");
  });

  it("ignores played ids that are not in the pool", () => {
    const pick = pickPuzzle(pool, ["gone", "a", "b"], () => 0)!;
    expect(pick.puzzle.id).toBe("c");
    expect(pick.played).toEqual(["a", "b", "c"]);
  });

  it("repeats the only puzzle of a one-puzzle pool", () => {
    const pick = pickPuzzle([puzzle("a")], ["a"], () => 0)!;
    expect(pick.puzzle.id).toBe("a");
  });
});
