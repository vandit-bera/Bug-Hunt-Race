import type { SandboxSession } from "@/lib/runner/sandbox-runner";
import { PreloadStore, type PreloadState } from "@/lib/runner/preload-state";
import type { HarnessOutcome } from "@/lib/runner/js/harness";
import type { RunRequest } from "@/lib/runner/types";
import type { WorkerEvent } from "./messages";

interface ReadyWorker {
  worker: Worker;
  /** Sends the request to the booted worker; the worker is then spent. */
  run(request: RunRequest): SandboxSession;
}

/**
 * Keeps one booted Pyodide worker in reserve. Booting takes seconds, so a run
 * takes the spare (instant) and a fresh spare starts booting right away. That
 * keeps "a fresh worker per run" while the player never waits, including
 * after a timeout killed the previous worker.
 */
export class PythonWorkerPool {
  readonly store = new PreloadStore();
  private spare: Promise<ReadyWorker> | null = null;
  private readonly cancelBoots = new Set<(error: Error) => void>();

  /** Starts booting the spare if there is none. Resolves when it is ready. */
  warm(): Promise<void> {
    return this.ensureSpare().then(() => undefined);
  }

  /** Hands out the spare (booting one if needed) and starts the next. */
  async open(request: RunRequest): Promise<SandboxSession> {
    const spare = this.ensureSpare();
    this.spare = null;
    let ready: ReadyWorker;
    try {
      ready = await spare;
    } catch (error) {
      this.spare = null;
      throw error;
    }
    this.ensureSpare().catch(() => {});
    return ready.run(request);
  }

  dispose(): void {
    const spare = this.spare;
    this.spare = null;
    void spare?.then(
      (ready) => ready.worker.terminate(),
      () => {},
    );
    for (const cancel of [...this.cancelBoots]) {
      cancel(new Error("The runner was stopped"));
    }
    this.cancelBoots.clear();
  }

  private ensureSpare(): Promise<ReadyWorker> {
    if (!this.spare) {
      const spare = this.boot();
      this.spare = spare;
      // A failed boot must not stick: the next warm() or run tries again.
      spare.catch(() => {
        if (this.spare === spare) this.spare = null;
      });
    }
    return this.spare;
  }

  private boot(): Promise<ReadyWorker> {
    const everReady = this.store.getState().status === "ready";
    if (!everReady) this.store.setState({ status: "loading", progress: 0 });
    return new Promise<ReadyWorker>((resolve, reject) => {
      const worker = new Worker(new URL("./worker.ts", import.meta.url), {
        type: "module",
        name: "bhr-python-runner",
      });
      let settled = false;
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        this.cancelBoots.delete(fail);
        worker.terminate();
        if (!everReady) {
          this.store.setState({
            status: "error",
            progress: 0,
            error: error.message,
          });
        }
        reject(error);
      };
      this.cancelBoots.add(fail);
      worker.onerror = (event) => {
        event.preventDefault();
        fail(new Error(event.message || "The Python runner crashed"));
      };
      worker.onmessage = (event: MessageEvent<WorkerEvent>) => {
        const message = event.data;
        if (message.type === "progress") {
          if (!everReady) this.setProgress(message.value);
        } else if (message.type === "failed") {
          fail(new Error(message.error));
        } else {
          settled = true;
          this.cancelBoots.delete(fail);
          this.store.setState({ status: "ready", progress: 1 });
          resolve({ worker, run: (request) => runOnce(worker, request) });
        }
      };
    });
  }

  private setProgress(value: number): void {
    const state: PreloadState = { status: "loading", progress: value };
    this.store.setState(state);
  }
}

function runOnce(worker: Worker, request: RunRequest): SandboxSession {
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

export const pythonPool = new PythonWorkerPool();
