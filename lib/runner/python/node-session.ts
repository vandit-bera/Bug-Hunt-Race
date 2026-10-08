import { createRequire } from "node:module";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { MAX_OUTPUT_CHARS } from "@/lib/runner/config";
import type { HarnessOutcome } from "@/lib/runner/js/harness";
import { BLOCKED_GLOBALS, lockDownGlobals } from "@/lib/runner/js/lockdown";
import type { OpenSession, SandboxSession } from "@/lib/runner/sandbox-runner";
import { runPuzzle } from "./engine";
import { PYTHON_HARNESS } from "./harness-source";

/**
 * Node side of the Python runner, for the CI puzzle checker. Pyodide runs in a
 * worker thread that is terminated on timeout, with the same harness and the
 * same lockdown as the browser worker; Pyodide reads its files straight from
 * the `pyodide` package, so there is no network. Like the browser, the thread
 * boots first (`ready`) and only then does the run (and its clock) start.
 */

const THREAD_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");
// esbuild's keepNames (used by tsx, which runs the puzzle checker) wraps
// functions in \`__name(fn, "name")\`; names are cosmetic, so a no-op will do.
const __name = (target) => target;
const lockDownGlobals = ${lockDownGlobals.toString()};
const runPuzzle = ${runPuzzle.toString()};
(async () => {
  const { loadPyodide } = require(workerData.pyodidePath);
  const pyodide = await loadPyodide();
  pyodide.runPython(workerData.harness);
  globalThis.self = globalThis;
  lockDownGlobals(globalThis, workerData.blocked);
  parentPort.on("message", (input) =>
    parentPort.postMessage({ type: "outcome", outcome: runPuzzle(pyodide, input) }),
  );
  parentPort.postMessage({ type: "ready" });
})().catch((error) =>
  parentPort.postMessage({ type: "failed", error: String(error && error.message || error) }),
);
`;

type ThreadMessage =
  | { type: "ready" }
  | { type: "failed"; error: string }
  | { type: "outcome"; outcome: HarnessOutcome };

function resolvePyodide(): string {
  const fromRoot = createRequire(join(process.cwd(), "package.json"));
  return fromRoot.resolve("pyodide");
}

export const openPythonThreadSession: OpenSession = (request) =>
  new Promise<SandboxSession>((resolve, reject) => {
    const worker = new Worker(THREAD_SOURCE, {
      eval: true,
      workerData: {
        pyodidePath: resolvePyodide(),
        harness: PYTHON_HARNESS,
        blocked: BLOCKED_GLOBALS,
      },
      stdout: true,
      stderr: true,
      resourceLimits: { maxOldGenerationSizeMb: 512 },
    });
    const done = new Promise<HarnessOutcome>((resolveDone, rejectDone) => {
      worker.on("message", (message: ThreadMessage) => {
        if (message.type === "outcome") resolveDone(message.outcome);
      });
      worker.once("error", rejectDone);
      worker.once("exit", (code) =>
        rejectDone(new Error(`The runner exited early (code ${code})`)),
      );
    });
    done.catch(() => {});
    worker.once("error", reject);
    worker.once("exit", () => reject(new Error("The runner exited early")));
    worker.on("message", (message: ThreadMessage) => {
      if (message.type === "failed") {
        void worker.terminate();
        reject(new Error(message.error));
      } else if (message.type === "ready") {
        worker.postMessage({
          code: request.code,
          tests: request.tests,
          maxOutputChars: MAX_OUTPUT_CHARS,
        });
        resolve({ done, terminate: () => void worker.terminate() });
      }
    });
  });
