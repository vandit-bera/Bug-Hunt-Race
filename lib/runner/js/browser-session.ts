import type { SandboxSession } from "@/lib/runner/sandbox-runner";
import type { RunRequest } from "@/lib/runner/types";
import type { HarnessOutcome } from "./harness";

/** Starts a dedicated Web Worker for one run (browser only). */
export function openWorkerSession(request: RunRequest): SandboxSession {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
    name: "bhr-js-runner",
  });
  const channel = new MessageChannel();
  const done = new Promise<HarnessOutcome>((resolve, reject) => {
    channel.port1.onmessage = (event: MessageEvent<HarnessOutcome>) =>
      resolve(event.data);
    channel.port1.onmessageerror = () =>
      reject(new Error("The runner sent an unreadable result"));
    worker.onerror = (event) => {
      event.preventDefault();
      reject(new Error(event.message || "The runner crashed"));
    };
  });
  worker.postMessage(request, [channel.port2]);
  return {
    done,
    terminate: () => {
      worker.terminate();
      channel.port1.close();
    },
  };
}
