import { beforeEach, describe, expect, it } from "vitest";
import { EMPTY_PROGRESS, applyRound } from "./progress";
import { loadProgress, saveProgress } from "./progress-storage";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

let storage = memoryStorage();
beforeEach(() => {
  storage = memoryStorage();
});

const KEY = "bhr:solo:progress:v1";

describe("progress storage", () => {
  it("starts empty", () => {
    expect(loadProgress(storage)).toEqual(EMPTY_PROGRESS);
  });

  it("saves and loads", () => {
    const progress = applyRound(EMPTY_PROGRESS, {
      solved: true,
      language: "python",
      level: "hard",
      hintUsed: false,
      timeSec: 10,
      timeLimitSec: 480,
      day: "2026-03-10",
    });
    saveProgress(progress, storage);
    expect(loadProgress(storage)).toEqual(progress);
  });

  it("does not crash on corrupt JSON", () => {
    storage.setItem(KEY, "{nope");
    expect(loadProgress(storage)).toEqual(EMPTY_PROGRESS);
  });

  it("does not crash on data of the wrong shape or an old version", () => {
    storage.setItem(KEY, JSON.stringify({ totalSolves: "lots", earned: 3 }));
    expect(loadProgress(storage)).toEqual(EMPTY_PROGRESS);
    storage.setItem("bhr:solo:progress", JSON.stringify({ totalSolves: 9 }));
    expect(loadProgress(storage).totalSolves).toBe(0);
  });

  it("works without storage or when storage throws", () => {
    expect(loadProgress(null)).toEqual(EMPTY_PROGRESS);
    expect(() => saveProgress(EMPTY_PROGRESS, null)).not.toThrow();
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(loadProgress(broken)).toEqual(EMPTY_PROGRESS);
    expect(() => saveProgress(EMPTY_PROGRESS, broken)).not.toThrow();
  });
});
