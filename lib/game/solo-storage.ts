import type { LanguageId } from "@/lib/runner/types";
import type { PuzzleLevel } from "@/lib/puzzles/schema";
import type { Level } from "./types";

export interface PersonalBest {
  points: number;
  timeSec: number;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const PLAYED_KEY = "bhr:solo:played";
const BEST_KEY = "bhr:solo:best";

function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readJson(storage: StorageLike | null, key: string): unknown {
  try {
    return JSON.parse(storage?.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

function writeJson(storage: StorageLike | null, key: string, value: unknown) {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be blocked or full; the game works without history.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getPlayed(
  language: LanguageId,
  level: PuzzleLevel,
  storage: StorageLike | null = browserStorage(),
): string[] {
  const all = readJson(storage, PLAYED_KEY);
  const list = isRecord(all) ? all[`${language}:${level}`] : null;
  return Array.isArray(list)
    ? list.filter((id): id is string => typeof id === "string")
    : [];
}

export function setPlayed(
  language: LanguageId,
  level: PuzzleLevel,
  ids: string[],
  storage: StorageLike | null = browserStorage(),
) {
  const all = readJson(storage, PLAYED_KEY);
  writeJson(storage, PLAYED_KEY, {
    ...(isRecord(all) ? all : {}),
    [`${language}:${level}`]: ids,
  });
}

function isBest(value: unknown): value is PersonalBest {
  return (
    isRecord(value) &&
    typeof value.points === "number" &&
    typeof value.timeSec === "number"
  );
}

export function getBest(
  language: LanguageId,
  level: Level,
  storage: StorageLike | null = browserStorage(),
): PersonalBest | null {
  const all = readJson(storage, BEST_KEY);
  const best = isRecord(all) ? all[`${language}:${level}`] : null;
  return isBest(best) ? best : null;
}

/** Higher points win; on equal points the faster time wins. */
export function isNewBest(
  previous: PersonalBest | null,
  next: PersonalBest,
): boolean {
  if (next.points <= 0) return false;
  if (!previous) return true;
  return (
    next.points > previous.points ||
    (next.points === previous.points && next.timeSec < previous.timeSec)
  );
}

/** Saves `next` if it beats the stored best. Returns true when it did. */
export function recordBest(
  language: LanguageId,
  level: Level,
  next: PersonalBest,
  storage: StorageLike | null = browserStorage(),
): boolean {
  if (!isNewBest(getBest(language, level, storage), next)) return false;
  const all = readJson(storage, BEST_KEY);
  writeJson(storage, BEST_KEY, {
    ...(isRecord(all) ? all : {}),
    [`${language}:${level}`]: next,
  });
  return true;
}
