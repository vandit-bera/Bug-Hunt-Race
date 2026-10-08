/// <reference lib="webworker" />
import type { PyodideInterface } from "pyodide";
import { MAX_OUTPUT_CHARS } from "@/lib/runner/config";
import { BLOCKED_GLOBALS, lockDownGlobals } from "@/lib/runner/js/lockdown";
import type { RunRequest } from "@/lib/runner/types";
import { PYODIDE_BASE_PATH, type PyodideManifest } from "./assets";
import { runPuzzle } from "./engine";
import { PYTHON_HARNESS } from "./harness-source";
import type { WorkerEvent } from "./messages";

/**
 * Web Worker entry for Python: boots Pyodide, installs the harness, locks the
 * global scope down, then reports `ready` and waits for exactly one run. Like
 * the JS worker, it is used once and terminated, so nothing leaks between
 * runs. The result goes back on a private MessagePort that user code never
 * sees.
 */
declare const self: DedicatedWorkerGlobalScope;

// Captured before the lockdown removes `postMessage`.
const postToPage = self.postMessage.bind(self);
const send = (event: WorkerEvent) => postToPage(event);

/** Downloads every Pyodide file, reporting byte progress (0 to 1). */
async function download(baseUrl: string, onProgress: (value: number) => void) {
  const manifest = (await (
    await fetch(`${baseUrl}/manifest.json`)
  ).json()) as PyodideManifest;
  const total = Object.values(manifest.files).reduce((a, b) => a + b, 0);
  let received = 0;
  for (const file of Object.keys(manifest.files)) {
    const response = await fetch(`${baseUrl}/${file}`);
    if (!response.ok || !response.body) {
      throw new Error(`Could not download ${file} (${response.status})`);
    }
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      onProgress(received / total);
    }
  }
}

async function boot(): Promise<PyodideInterface> {
  const baseUrl = `${self.location.origin}${PYODIDE_BASE_PATH}`;
  // The files are fetched once here so progress is real; Pyodide then reads
  // them from the HTTP cache (the assets are served as immutable).
  await download(baseUrl, (value) => send({ type: "progress", value }));
  const { loadPyodide } = (await import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ `${baseUrl}/pyodide.mjs`
  )) as typeof import("pyodide");
  const pyodide = await loadPyodide({ indexURL: baseUrl });
  pyodide.runPython(PYTHON_HARNESS);
  lockDownGlobals(self, BLOCKED_GLOBALS);
  return pyodide;
}

const ready = boot();

self.addEventListener(
  "message",
  (event: MessageEvent<RunRequest>) => {
    const [port] = event.ports;
    if (!port) return;
    // A failed boot is already reported as `failed`; the page sends no run.
    void ready.then(
      (pyodide) =>
        port.postMessage(
          runPuzzle(pyodide, {
            code: event.data.code,
            tests: event.data.tests,
            maxOutputChars: MAX_OUTPUT_CHARS,
          }),
        ),
      () => {},
    );
  },
  { once: true },
);

ready.then(
  () => send({ type: "ready" }),
  (error: unknown) =>
    send({
      type: "failed",
      error: error instanceof Error ? error.message : String(error),
    }),
);
