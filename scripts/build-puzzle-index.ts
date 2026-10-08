import { writeFileSync } from "node:fs";
import path from "node:path";
import { PUZZLE_INDEX_FILE, renderPuzzleIndex } from "@/lib/puzzles/index-file";
import { loadPuzzles } from "@/lib/puzzles/load";

/**
 * `pnpm puzzles:build`: writes the typed puzzle index the app imports.
 * Refuses to write while any puzzle folder is invalid.
 */

const entries = loadPuzzles(path.resolve("puzzles"));
const invalid = entries.filter((entry) => !entry.puzzle);
if (invalid.length > 0) {
  for (const { dir, errors } of invalid) {
    console.error(`✗ ${dir}\n    ${errors.join("\n    ")}`);
  }
  console.error("\nFix the puzzles above, then run this again.");
  process.exit(1);
}

const puzzles = entries.flatMap(({ puzzle }) => (puzzle ? [puzzle] : []));
const file = path.resolve(PUZZLE_INDEX_FILE);
renderPuzzleIndex(puzzles, file).then((source) => {
  writeFileSync(file, source);
  console.log(`Wrote ${puzzles.length} puzzles to ${PUZZLE_INDEX_FILE}.`);
});
