import { measureRoutes } from "./bundle-budget";

/**
 * `pnpm bundle:check` (after `pnpm build`): fails when a page's first-load
 * JavaScript is over its budget in `scripts/bundle-budget.ts`.
 */

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

let failed = false;
for (const { route, gzipBytes, maxGzipBytes, scripts } of measureRoutes(
  ".next",
)) {
  const ok = gzipBytes <= maxGzipBytes;
  failed ||= !ok;
  console.log(
    `${ok ? "✓" : "✗"} ${route}: ${kb(gzipBytes)} gzipped (budget ${kb(maxGzipBytes)}, ${scripts.length} scripts)`,
  );
  if (!ok) {
    for (const script of [...scripts].sort((a, b) => b.gzipBytes - a.gzipBytes))
      console.log(`    ${kb(script.gzipBytes).padStart(9)}  ${script.url}`);
  }
}
if (failed) {
  console.error(
    "\nOver budget. Load the new code on demand (next/dynamic or import()), or raise the budget in scripts/bundle-budget.ts and explain why in the PR.",
  );
  process.exit(1);
}
