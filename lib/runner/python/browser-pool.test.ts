import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOOT_STALL_MS, PythonWorkerPool } from "./browser-pool";
import type { WorkerEvent } from "./messages";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<WorkerEvent>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();

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
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const REQUEST = { language: "python", code: "", tests: "" } as const;

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

describe("PythonWorkerPool stuck boots (TB-78)", () => {
  it("fails a boot that sends nothing for BOOT_STALL_MS", async () => {
    vi.useFakeTimers();
    const pool = new PythonWorkerPool();
    const warm = pool.warm();
    vi.advanceTimersByTime(BOOT_STALL_MS);
    await expect(warm).rejects.toThrow("Python took too long to load.");
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalled();
    expect(pool.store.getState()).toMatchObject({
      status: "error",
      error: "Python took too long to load.",
    });
  });

  it("does not fail a boot that keeps reporting progress", async () => {
    vi.useFakeTimers();
    const pool = new PythonWorkerPool();
    const warm = pool.warm();
    for (let i = 1; i <= 3; i++) {
      vi.advanceTimersByTime(BOOT_STALL_MS - 1);
      FakeWorker.instances[0].emit({ type: "progress", value: i / 4 });
    }
    FakeWorker.instances[0].emit({ type: "ready" });
    await warm;
    expect(pool.store.getState().status).toBe("ready");
  });

  it("a run whose boot stalls gets one fresh worker", async () => {
    vi.useFakeTimers();
    const pool = new PythonWorkerPool();
    const opened = pool.open(REQUEST);
    vi.advanceTimersByTime(BOOT_STALL_MS);
    await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
    FakeWorker.instances[1].emit({ type: "ready" });
    await opened;
    expect(FakeWorker.instances[1].postMessage).toHaveBeenCalledWith(
      REQUEST,
      expect.any(Array),
    );
  });

  it("a run gives up when the fresh worker fails too", async () => {
    const pool = new PythonWorkerPool();
    const opened = pool.open(REQUEST);
    FakeWorker.instances[0].emit({ type: "failed", error: "network down" });
    await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
    FakeWorker.instances[1].emit({ type: "failed", error: "still down" });
    await expect(opened).rejects.toThrow("still down");
    expect(FakeWorker.instances).toHaveLength(2);
  });

  it("a run stopped by dispose does not retry", async () => {
    const pool = new PythonWorkerPool();
    const opened = pool.open(REQUEST);
    pool.dispose();
    await expect(opened).rejects.toThrow("The runner was stopped");
    expect(FakeWorker.instances).toHaveLength(1);
  });
});
