import { PUZZLE_CATALOG_FILE, renderPuzzleCatalogSql } from "./catalog-sql";
import { PUZZLE_FIXES_FILE, renderPuzzleFixes } from "./fixes-file";
import { PUZZLE_INDEX_FILE, renderPuzzleIndex } from "./index-file";
import type { PuzzleSource } from "./load";

/** A file `pnpm puzzles:build` writes and `pnpm puzzles:check` keeps current. */
export interface GeneratedPuzzleFile {
  /** Relative to the repo root. */
  file: string;
  render(puzzles: PuzzleSource[], filepath: string): Promise<string> | string;
}

export const GENERATED_PUZZLE_FILES: readonly GeneratedPuzzleFile[] = [
  { file: PUZZLE_INDEX_FILE, render: renderPuzzleIndex },
  { file: PUZZLE_FIXES_FILE, render: renderPuzzleFixes },
  { file: PUZZLE_CATALOG_FILE, render: renderPuzzleCatalogSql },
];
