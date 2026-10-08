import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PythonWorkerPool } from "./browser-pool";
import type { WorkerEvent } from "./messages";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<WorkerEvent>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminate = vi.fn();

  constructor() {
    FakeWorker.instances.push(this);
  }

  emit(event: WorkerEvent) {
    this.onmessage?.({ data: event } as MessageEvent<WorkerEvent>);
  }
}

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PythonWorkerPool preload", () => {
  it("reports progress and becomes ready", async () => {
    const pool = new PythonWorkerPool();
    const warm = pool.warm();
    expect(pool.store.getState().status).toBe("loading");
    FakeWorker.instances[0].emit({ type: "progress", value: 0.5 });
    expect(pool.store.getState()).toEqual({ status: "loading", progress: 0.5 });
    FakeWorker.instances[0].emit({ type: "ready" });
    await warm;
    expect(pool.store.getState()).toEqual({ status: "ready", progress: 1 });
  });

  it("does not start a second worker while one is booting", () => {
    const pool = new PythonWorkerPool();
    void pool.warm();
    void pool.warm();
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it("retries after a failed preload", async () => {
    const pool = new PythonWorkerPool();
    const first = pool.warm();
    FakeWorker.instances[0].emit({ type: "failed", error: "network down" });
    await expect(first).rejects.toThrow("network down");
    expect(pool.store.getState()).toMatchObject({
      status: "error",
      error: "network down",
    });

    const second = pool.warm();
    expect(FakeWorker.instances).toHaveLength(2);
    expect(pool.store.getState().status).toBe("loading");
    FakeWorker.instances[1].emit({ type: "ready" });
    await second;
    expect(pool.store.getState().status).toBe("ready");
  });
});
