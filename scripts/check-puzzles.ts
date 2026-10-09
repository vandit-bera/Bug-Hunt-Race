import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { checkEntries } from "@/lib/puzzles/check";
import { GENERATED_PUZZLE_FILES } from "@/lib/puzzles/generated-files";
import { loadPuzzles, type PuzzleSource } from "@/lib/puzzles/load";
import { runInNode } from "@/lib/runner/node";

/**
 * `pnpm puzzles:check [--dir <folder>]`: validates every puzzle, proves its
 * buggy code fails and its fix passes, and (for the real `puzzles/` folder)
 * that the generated files are up to date. Exits 1 on any problem.
 */

const DEFAULT_DIR = "puzzles";
const { values } = parseArgs({
  options: { dir: { type: "string", default: DEFAULT_DIR } },
});
const root = path.resolve(values.dir);

/** Generated files that do not match puzzles/. */
async function staleFiles(puzzles: PuzzleSource[]): Promise<string[]> {
  const stale: string[] = [];
  for (const { file, render } of GENERATED_PUZZLE_FILES) {
    const filepath = path.resolve(file);
    let current = "";
    try {
      current = readFileSync(filepath, "utf8");
    } catch {
      // Missing counts as stale.
    }
    if (current !== (await render(puzzles, filepath))) stale.push(file);
  }
  return stale;
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

  let stale: string[] = [];
  if (root === path.resolve(DEFAULT_DIR) && failed === 0) {
    const puzzles = entries.flatMap(({ puzzle }) => (puzzle ? [puzzle] : []));
    stale = await staleFiles(puzzles);
    for (const file of stale) {
      console.log(
        `✗ ${file} is out of date. Run \`pnpm puzzles:build\` and commit it.`,
      );
    }
  }
  return failed > 0 || stale.length > 0 || results.length === 0 ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
