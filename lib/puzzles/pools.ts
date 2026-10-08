import type { Level } from "@/lib/game/types";
import { LANGUAGES } from "@/lib/runner/config";
import type { LanguageId } from "@/lib/runner/types";
import { PUZZLE_LEVELS, type PuzzleLevel, type PuzzleMeta } from "./schema";

/** How many puzzles each language + level pool holds. */
export type PoolSizes = Record<LanguageId, Record<PuzzleLevel, number>>;

/**
 * Counts the pools. Pages call this on the server and pass the result down,
 * so a screen that only shows counts does not ship the puzzle pack.
 */
export function countPools(
  puzzles: readonly Pick<PuzzleMeta, "language" | "level">[],
): PoolSizes {
  const sizes = Object.fromEntries(
    (Object.keys(LANGUAGES) as LanguageId[]).map((language) => [
      language,
      Object.fromEntries(PUZZLE_LEVELS.map((level) => [level, 0])),
    ]),
  ) as PoolSizes;
  for (const { language, level } of puzzles) sizes[language][level] += 1;
  return sizes;
}

/** Size of a pool; Mixed draws from every level. */
export function poolSize(
  sizes: PoolSizes,
  language: LanguageId,
  level: Level,
): number {
  if (level !== "mixed") return sizes[language][level];
  return PUZZLE_LEVELS.reduce((sum, each) => sum + sizes[language][each], 0);
}
