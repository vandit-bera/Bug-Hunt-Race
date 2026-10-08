import path from "node:path";
import { loadPuzzles } from "@/lib/puzzles/load";
import { findFixLeaks, readClientScripts } from "./fix-leaks";

/**
 * `pnpm fixes:check` (after `pnpm build`): fails when any reference fix from
 * puzzles/ appears in a client JavaScript file. Fixes may only reach players
 * through the fix reveal route, after the round has ended.
 */

const fixes = loadPuzzles(path.resolve("puzzles")).flatMap(({ puzzle }) =>
  puzzle ? [{ id: puzzle.meta.id, fix: puzzle.fix }] : [],
);
const scripts = readClientScripts(".next");
if (fixes.length === 0 || scripts.length === 0) {
  console.error("✗ Nothing to check: run `pnpm build` first.");
  process.exit(1);
}

const leaks = findFixLeaks(fixes, scripts);
for (const { id, file } of leaks) {
  console.log(`✗ the fix of ${id} is in ${file}`);
}
if (leaks.length > 0) {
  console.error(
    "\nReference fixes must never reach the browser. Import lib/puzzles/generated/fixes.ts from server code only.",
  );
  process.exit(1);
}
console.log(
  `✓ none of the ${fixes.length} reference fixes is in the ${scripts.length} client scripts.`,
);
