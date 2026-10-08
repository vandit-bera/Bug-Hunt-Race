import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_RUN_TIMEOUT_MS } from "./config";
import type { HarnessOutcome } from "./js/harness";
import {
  resolveTimeoutMs,
  SandboxRunner,
  type SandboxSession,
} from "./sandbox-runner";
import type { RunRequest } from "./types";

const request: RunRequest = { language: "javascript", code: "", tests: "" };
const passed: HarnessOutcome = {
  status: "passed",
  tests: [{ name: "t", passed: true }],
  output: "hi\n",
};

function fakeSession(done: Promise<HarnessOutcome>) {
  const session: SandboxSession = { done, terminate: vi.fn() };
  return session;
}

const never = () => new Promise<HarnessOutcome>(() => {});

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("SandboxRunner", () => {
  it("returns the outcome with a duration and ends the session", async () => {
    const session = fakeSession(Promise.resolve(passed));
    const runner = new SandboxRunner("javascript", () => session);
    expect(await runner.run(request)).toEqual({ ...passed, durationMs: 0 });
    expect(session.terminate).toHaveBeenCalledOnce();
  });

  it("terminates the session when the timeout fires", async () => {
    const session = fakeSession(never());
    const runner = new SandboxRunner("javascript", () => session);
    const pending = runner.run({ ...request, timeoutMs: 1_000 });
    await vi.advanceTimersByTimeAsync(999);
    expect(session.terminate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({
      status: "timeout",
      tests: [],
      output: "",
      error: "Time limit exceeded (1s). Look for an infinite loop.",
      durationMs: 1_000,
    });
    expect(session.terminate).toHaveBeenCalledOnce();
  });

  it("uses the default timeout", async () => {
    const runner = new SandboxRunner("javascript", () => fakeSession(never()));
    const pending = runner.run(request);
    await vi.advanceTimersByTimeAsync(DEFAULT_RUN_TIMEOUT_MS);
    expect((await pending).status).toBe("timeout");
  });

  it("maps a crashed session to an error", async () => {
    const runner = new SandboxRunner("javascript", () =>
      fakeSession(Promise.reject(new Error("worker crashed"))),
    );
    expect(await runner.run(request)).toMatchObject({
      status: "error",
      error: "worker crashed",
    });
  });

  it("maps a session that cannot start to an error", async () => {
    const runner = new SandboxRunner("javascript", () => {
      throw new Error("Worker is not defined");
    });
    expect(await runner.run(request)).toMatchObject({
      status: "error",
      error: "Could not start the runner: Worker is not defined",
    });
  });

  it("refuses a request for another language without starting a session", async () => {
    const open = vi.fn();
    const runner = new SandboxRunner("typescript", open);
    expect(await runner.run(request)).toMatchObject({
      status: "error",
      error: "This runner runs typescript, not javascript",
    });
    expect(open).not.toHaveBeenCalled();
  });

  it("starts the clock only after an async session has opened", async () => {
    const session = fakeSession(never());
    const runner = new SandboxRunner(
      "javascript",
      () => new Promise((resolve) => setTimeout(() => resolve(session), 4_000)),
    );
    const pending = runner.run({ ...request, timeoutMs: 1_000 });
    await vi.advanceTimersByTimeAsync(4_000);
    expect(session.terminate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await pending).toMatchObject({
      status: "timeout",
      durationMs: 1_000,
    });
  });

  it("maps an async session that fails to open to an error", async () => {
    const runner = new SandboxRunner("javascript", () =>
      Promise.reject(new Error("download failed")),
    );
    expect(await runner.run(request)).toMatchObject({
      status: "error",
      error: "Could not start the runner: download failed",
    });
  });

  it("dispose stops a run that is still starting", async () => {
    const session = fakeSession(never());
    const runner = new SandboxRunner("javascript", () =>
      Promise.resolve(session),
    );
    const pending = runner.run(request);
    runner.dispose();
    expect(await pending).toMatchObject({
      status: "error",
      error: "The runner was stopped",
    });
    expect(session.terminate).toHaveBeenCalledOnce();
  });

  it("dispose stops runs in flight", async () => {
    const sessions = [fakeSession(never()), fakeSession(never())];
    const runner = new SandboxRunner("javascript", () => sessions.shift()!);
    const first = sessions[0];
    const runs = [runner.run(request), runner.run(request)];
    runner.dispose();
    for (const result of await Promise.all(runs)) {
      expect(result).toMatchObject({
        status: "error",
        error: "The runner was stopped",
      });
    }
    expect(first.terminate).toHaveBeenCalledOnce();
  });
});

describe("resolveTimeoutMs", () => {
  it.each([undefined, 0, -5, Number.NaN, Number.POSITIVE_INFINITY])(
    "falls back to the default for %s",
    (value) => {
      expect(resolveTimeoutMs(value)).toBe(DEFAULT_RUN_TIMEOUT_MS);
    },
  );

  it("keeps a valid timeout", () => {
    expect(resolveTimeoutMs(250)).toBe(250);
  });
});
