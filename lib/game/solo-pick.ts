import type { PublicPuzzle, PuzzleLevel } from "@/lib/puzzles/schema";
import type { Level } from "./types";

/** Levels a Mixed game steps through, one per "Play again". */
export const MIXED_ORDER: readonly PuzzleLevel[] = ["easy", "medium", "hard"];

/**
 * The puzzle level played in a given round of a game with `level`. Mixed
 * steps Easy, Medium, Hard and skips levels that have no puzzles; `hasPuzzles`
 * tells it which. Returns null when nothing can be played.
 */
export function levelForRound(
  level: Level,
  round: number,
  hasPuzzles: (level: PuzzleLevel) => boolean = () => true,
): PuzzleLevel | null {
  if (level !== "mixed") return hasPuzzles(level) ? level : null;
  const start = Math.max(0, round);
  for (let step = 0; step < MIXED_ORDER.length; step++) {
    const candidate = MIXED_ORDER[(start + step) % MIXED_ORDER.length];
    if (hasPuzzles(candidate)) return candidate;
  }
  return null;
}

export interface Pick {
  puzzle: PublicPuzzle;
  /** The played ids to store, including the picked puzzle. */
  played: string[];
}

/**
 * Picks a random puzzle that was not played yet. Once every puzzle in the
 * pool has been played, the history starts again from the picked one, which
 * is never the last played puzzle unless it is the only one.
 * Returns null for an empty pool. `random` returns [0, 1).
 */
export function pickPuzzle(
  pool: readonly PublicPuzzle[],
  played: readonly string[],
  random: () => number = Math.random,
): Pick | null {
  if (pool.length === 0) return null;
  const poolIds = new Set(pool.map((puzzle) => puzzle.id));
  const inPool = played.filter((id) => poolIds.has(id));
  const seen = new Set(inPool);
  const fresh = pool.filter((puzzle) => !seen.has(puzzle.id));
  const last = inPool.at(-1);
  const rest = pool.filter((puzzle) => puzzle.id !== last);
  const candidates = fresh.length > 0 ? fresh : rest.length > 0 ? rest : pool;
  const puzzle = candidates[Math.floor(random() * candidates.length)];
  const history = fresh.length > 0 ? [...seen] : [];
  return { puzzle, played: [...history, puzzle.id] };
}
