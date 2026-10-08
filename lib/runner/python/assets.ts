import pyodidePackage from "pyodide/package.json";

/**
 * Pyodide is self-hosted: `scripts/copy-pyodide.mjs` copies the files below
 * from the pinned `pyodide` npm package into `public/pyodide/<version>/`.
 * Same origin means no third-party CDN to trust or depend on, the versioned
 * path can be cached forever, and the worker's CSP only has to allow `'self'`.
 */
export const PYODIDE_VERSION = pyodidePackage.version;

/** Files the browser downloads, in this order (manifest.json holds sizes). */
export const PYODIDE_FILES = [
  "pyodide.mjs",
  "pyodide.asm.mjs",
  "python_stdlib.zip",
  "pyodide-lock.json",
  "pyodide.asm.wasm",
] as const;

export const PYODIDE_BASE_PATH = `/pyodide/${PYODIDE_VERSION}`;

export interface PyodideManifest {
  files: Record<string, number>;
}
