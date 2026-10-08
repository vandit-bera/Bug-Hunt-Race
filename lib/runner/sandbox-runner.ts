import { DEFAULT_RUN_TIMEOUT_MS } from "./config";
import type { HarnessOutcome } from "./js/harness";
import type { CodeRunner, LanguageId, RunRequest, RunResult } from "./types";

/** One isolated run: a Web Worker in the browser, a worker thread in Node. */
export interface SandboxSession {
  /** Settles with the harness outcome, or rejects if the sandbox crashed. */
  done: Promise<HarnessOutcome>;
  /** Kills the sandbox immediately. Safe to call more than once. */
  terminate(): void;
}

/**
 * May be async: a slow start (Pyodide booting) happens before the timeout
 * clock starts, so it never eats into the player's time.
 */
export type OpenSession = (
  request: RunRequest,
) => SandboxSession | Promise<SandboxSession>;

type Settled =
  | { kind: "outcome"; outcome: HarnessOutcome }
  | { kind: "error"; error: string };

const STOPPED = "The runner was stopped";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function resolveTimeoutMs(timeoutMs: number | undefined): number {
  return timeoutMs !== undefined && Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : DEFAULT_RUN_TIMEOUT_MS;
}

/**
 * Runs each request in a fresh sandbox session and enforces the timeout from
 * outside: when it fires, the session is terminated, whatever the code is
 * doing. `run` never rejects.
 */
export class SandboxRunner implements CodeRunner {
  private readonly cancels = new Set<(error: string) => void>();
  /** Bumped by `dispose`, so runs still starting up know they were stopped. */
  private generation = 0;

  constructor(
    readonly language: LanguageId,
    private readonly openSession: OpenSession,
  ) {}

  async run(request: RunRequest): Promise<RunResult> {
    let startedAt = performance.now();
    const timeoutMs = resolveTimeoutMs(request.timeoutMs);
    const elapsed = () => Math.round(performance.now() - startedAt);
    const fail = (error: string): RunResult => ({
      status: "error",
      tests: [],
      output: "",
      error,
      durationMs: elapsed(),
    });

    if (request.language !== this.language) {
      return fail(`This runner runs ${this.language}, not ${request.language}`);
    }

    const generation = this.generation;
    let session: SandboxSession;
    try {
      session = await this.openSession(request);
    } catch (error) {
      return fail(`Could not start the runner: ${errorMessage(error)}`);
    }
    if (generation !== this.generation) {
      session.terminate();
      return fail(STOPPED);
    }
    // Starting up (Pyodide boot) is not part of the run.
    startedAt = performance.now();

    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancel: ((error: string) => void) | undefined;
    const settled = await Promise.race<Settled | "timeout">([
      session.done.then(
        (outcome) => ({ kind: "outcome", outcome }),
        (error: unknown) => ({ kind: "error", error: errorMessage(error) }),
      ),
      new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), timeoutMs);
      }),
      new Promise<Settled>((resolve) => {
        cancel = (error) => resolve({ kind: "error", error });
        this.cancels.add(cancel);
      }),
    ]);
    clearTimeout(timer);
    if (cancel) this.cancels.delete(cancel);
    session.terminate();

    if (settled === "timeout") {
      return {
        status: "timeout",
        tests: [],
        output: "",
        error: `Time limit exceeded (${timeoutMs / 1000}s). Look for an infinite loop.`,
        durationMs: elapsed(),
      };
    }
    if (settled.kind === "error") return fail(settled.error);
    return { ...settled.outcome, durationMs: elapsed() };
  }

  /** Stops every run in flight; each resolves with `status: "error"`. */
  dispose(): void {
    this.generation++;
    for (const cancel of [...this.cancels]) cancel(STOPPED);
    this.cancels.clear();
  }
}
