import { beforeEach, describe, expect, it } from "vitest";
import {
  getBest,
  getPlayed,
  isNewBest,
  recordBest,
  setPlayed,
} from "./solo-storage";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

let storage = memoryStorage();
beforeEach(() => {
  storage = memoryStorage();
});

describe("played puzzles", () => {
  it("starts empty and keeps each language+level apart", () => {
    expect(getPlayed("python", "easy", storage)).toEqual([]);
    setPlayed("python", "easy", ["a"], storage);
    setPlayed("python", "hard", ["b"], storage);
    expect(getPlayed("python", "easy", storage)).toEqual(["a"]);
    expect(getPlayed("python", "hard", storage)).toEqual(["b"]);
  });

  it("survives corrupt storage", () => {
    storage.setItem("bhr:solo:played", "{nope");
    expect(getPlayed("python", "easy", storage)).toEqual([]);
    setPlayed("python", "easy", ["a"], storage);
    expect(getPlayed("python", "easy", storage)).toEqual(["a"]);
  });

  it("works without storage", () => {
    expect(getPlayed("python", "easy", null)).toEqual([]);
    expect(() => setPlayed("python", "easy", ["a"], null)).not.toThrow();
  });
});

describe("personal best", () => {
  it("only counts scoring runs", () => {
    expect(isNewBest(null, { points: 0, timeSec: 5 })).toBe(false);
    expect(isNewBest(null, { points: 10, timeSec: 5 })).toBe(true);
  });

  it("prefers more points, then a faster time", () => {
    const best = { points: 100, timeSec: 60 };
    expect(isNewBest(best, { points: 110, timeSec: 90 })).toBe(true);
    expect(isNewBest(best, { points: 100, timeSec: 59 })).toBe(true);
    expect(isNewBest(best, { points: 100, timeSec: 60 })).toBe(false);
    expect(isNewBest(best, { points: 90, timeSec: 10 })).toBe(false);
  });

  it("saves and reads the best per language+level", () => {
    expect(
      recordBest("python", "mixed", { points: 90, timeSec: 40 }, storage),
    ).toBe(true);
    expect(
      recordBest("python", "mixed", { points: 80, timeSec: 20 }, storage),
    ).toBe(false);
    expect(getBest("python", "mixed", storage)).toEqual({
      points: 90,
      timeSec: 40,
    });
    expect(getBest("python", "easy", storage)).toBeNull();
  });
});
