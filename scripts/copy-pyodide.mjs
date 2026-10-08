// Copies the Pyodide runtime from the pinned npm package into
// public/pyodide/<version>/ so the app serves it from its own origin.
// Runs after `pnpm install`; the output is git-ignored.
import {
  copyFileSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const FILES = [
  "pyodide.mjs",
  "pyodide.asm.mjs",
  "python_stdlib.zip",
  "pyodide-lock.json",
  "pyodide.asm.wasm",
];

const require = createRequire(import.meta.url);
const packageJson = require.resolve("pyodide/package.json");
const { version } = require(packageJson);
const source = dirname(packageJson);

const root = join(import.meta.dirname, "..", "public", "pyodide");
const target = join(root, version);
rmSync(root, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

const sizes = {};
for (const file of FILES) {
  copyFileSync(join(source, file), join(target, file));
  sizes[file] = statSync(join(source, file)).size;
}
writeFileSync(join(target, "manifest.json"), JSON.stringify({ files: sizes }));
console.log(`Pyodide ${version} copied to public/pyodide/${version}`);
