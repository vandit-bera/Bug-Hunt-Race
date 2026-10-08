import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { checkEntries } from "@/lib/puzzles/check";
import { PUZZLE_INDEX_FILE, renderPuzzleIndex } from "@/lib/puzzles/index-file";
import { loadPuzzles, type PuzzleSource } from "@/lib/puzzles/load";
import { runInNode } from "@/lib/runner/node";

/**
 * `pnpm puzzles:check [--dir <folder>]`: validates every puzzle, proves its
 * buggy code fails and its fix passes, and (for the real `puzzles/` folder)
 * that the generated index is up to date. Exits 1 on any problem.
 */

const DEFAULT_DIR = "puzzles";
const { values } = parseArgs({
  options: { dir: { type: "string", default: DEFAULT_DIR } },
});
const root = path.resolve(values.dir);

async function isIndexCurrent(puzzles: PuzzleSource[]): Promise<boolean> {
  const file = path.resolve(PUZZLE_INDEX_FILE);
  let current = "";
  try {
    current = readFileSync(file, "utf8");
  } catch {
    return false;
  }
  return current === (await renderPuzzleIndex(puzzles, file));
}

async function main(): Promise<number> {
  const entries = loadPuzzles(root);
  const results = await checkEntries(entries, runInNode);

  for (const { dir, ok, errors } of results) {
    console.log(`${ok ? "✓" : "✗"} ${dir}`);
    for (const error of errors) console.log(`    ${error}`);
  }
  const failed = results.filter((result) => !result.ok).length;
  console.log(
    `\n${results.length - failed} of ${results.length} puzzles OK${failed ? `, ${failed} failed` : ""}.`,
  );

  let stale = false;
  if (root === path.resolve(DEFAULT_DIR) && failed === 0) {
    const puzzles = entries.flatMap(({ puzzle }) => (puzzle ? [puzzle] : []));
    stale = !(await isIndexCurrent(puzzles));
    if (stale) {
      console.log(
        `✗ ${PUZZLE_INDEX_FILE} is out of date. Run \`pnpm puzzles:build\` and commit it.`,
      );
    }
  }
  return failed > 0 || stale || results.length === 0 ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
