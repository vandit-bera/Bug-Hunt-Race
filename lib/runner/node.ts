import { Worker } from "node:worker_threads";
import { prepareHarnessInput } from "./js/compile";
import { runHarness, type HarnessOutcome } from "./js/harness";
import { BLOCKED_GLOBALS, lockDownGlobals } from "./js/lockdown";
import {
  SandboxRunner,
  type OpenSession,
  type SandboxSession,
} from "./sandbox-runner";
import type { CodeRunner, LanguageId, RunRequest, RunResult } from "./types";

/**
 * Node entry point for the CI puzzle checker. Same compiler, same harness and
 * same lockdown as the browser; a worker thread stands in for the Web Worker
 * and is terminated on timeout just like it.
 */

// The harness and lockdown are self-contained, so their source can be shipped
// to the thread as text. That keeps one implementation for both environments.
const THREAD_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");
const lockDownGlobals = ${lockDownGlobals.toString()};
const runHarness = ${runHarness.toString()};
lockDownGlobals(globalThis, workerData.blocked);
// A Web Worker stays alive until terminated; without this a test that never
// settles would end the thread early instead of hitting the timeout.
setInterval(() => {}, 1 << 30);
runHarness(workerData.input).then((outcome) => parentPort.postMessage(outcome));
`;

const openThreadSession: OpenSession = (request): SandboxSession => {
  const prepared = prepareHarnessInput(request);
  if (!prepared.ok) {
    const outcome: HarnessOutcome = {
      status: "error",
      tests: [],
      output: "",
      error: prepared.error,
    };
    return { done: Promise.resolve(outcome), terminate: () => {} };
  }
  const worker = new Worker(THREAD_SOURCE, {
    eval: true,
    workerData: { input: prepared.input, blocked: BLOCKED_GLOBALS },
    stdout: true,
    stderr: true,
    resourceLimits: { maxOldGenerationSizeMb: 256 },
  });
  const done = new Promise<HarnessOutcome>((resolve, reject) => {
    worker.once("message", resolve);
    worker.once("error", reject);
    worker.once("exit", (code) =>
      reject(new Error(`The runner exited early (code ${code})`)),
    );
  });
  return { done, terminate: () => void worker.terminate() };
};

export function createNodeRunner(language: LanguageId): CodeRunner {
  return new SandboxRunner(language, openThreadSession);
}

/** Runs one request in a fresh worker thread. Never rejects. */
export function runInNode(request: RunRequest): Promise<RunResult> {
  return createNodeRunner(request.language).run(request);
}
