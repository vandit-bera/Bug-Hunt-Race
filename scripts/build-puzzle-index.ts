import { writeFileSync } from "node:fs";
import path from "node:path";
import { GENERATED_PUZZLE_FILES } from "@/lib/puzzles/generated-files";
import { loadPuzzles } from "@/lib/puzzles/load";

/**
 * `pnpm puzzles:build`: writes the files generated from puzzles/: the typed
 * puzzle index the app imports, the server-only fixes and the SQL catalog.
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
Promise.all(
  GENERATED_PUZZLE_FILES.map(async ({ file, render }) => {
    const filepath = path.resolve(file);
    writeFileSync(filepath, await render(puzzles, filepath));
    console.log(`Wrote ${puzzles.length} puzzles to ${file}.`);
  }),
);
