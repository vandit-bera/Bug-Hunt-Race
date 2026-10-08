/// <reference lib="webworker" />
import type { RunRequest } from "@/lib/runner/types";
import { prepareHarnessInput } from "./compile";
import { runHarness, type HarnessOutcome } from "./harness";
import { BLOCKED_GLOBALS, lockDownGlobals } from "./lockdown";

/**
 * Web Worker entry: one worker per run. The page sends the request plus a
 * private MessagePort; the outcome goes back on that port only, so user code
 * (which never sees the port) cannot post a fake result.
 */
declare const self: DedicatedWorkerGlobalScope;

// Same policy as the Node thread: unhandled rejections are ignored (a test
// fails only through what it awaits); uncaught errors end the run as `error`.
self.addEventListener("unhandledrejection", (event) => event.preventDefault());
const onUncaughtError = (handler: (error: unknown) => void) =>
  self.addEventListener("error", (event) => {
    event.preventDefault();
    handler(event.error ?? new Error(event.message));
  });

self.addEventListener(
  "message",
  (event: MessageEvent<RunRequest>) => {
    const [port] = event.ports;
    if (!port) return;
    const prepared = prepareHarnessInput(event.data);
    const result: Promise<HarnessOutcome> = prepared.ok
      ? runHarness(prepared.input, onUncaughtError)
      : Promise.resolve({
          status: "error",
          tests: [],
          output: "",
          error: prepared.error,
        });
    void result.then((outcome) => port.postMessage(outcome));
  },
  { once: true },
);

lockDownGlobals(self, BLOCKED_GLOBALS);
