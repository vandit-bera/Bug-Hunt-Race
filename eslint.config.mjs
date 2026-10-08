import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Must stay last: turns off style rules that Prettier owns.
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "test-results/**",
    "playwright-report/**",
    // Puzzle code is plain script run by the test harness (global `test` and
    // `expect`, buggy and fix declare the same names), not app code.
    "puzzles/**",
    "lib/puzzles/fixtures/**",
  ]),
]);

export default eslintConfig;
