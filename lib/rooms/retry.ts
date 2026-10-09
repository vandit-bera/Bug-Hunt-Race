import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { DbError } from "@/lib/db";

/**
 * Whether a failed call never reached the database (network or Supabase
 * down), so the same call may work later: a `DbError` with code
 * `unavailable`, or Supabase Auth failing to reach its server.
 */
export function isUnavailableError(error: unknown): boolean {
  return (
    (error instanceof DbError && error.code === "unavailable") ||
    isAuthRetryableFetchError(error)
  );
}

/** Wait before retry `attempt` (0-based): 1 s, 2 s, 4 s, 8 s, then 10 s. */
export function backoffDelayMs(attempt: number): number {
  return Math.min(1_000 * 2 ** attempt, 10_000);
}

export interface RetryOptions {
  /** Attempts in total, the first one included. Default 6 (about 25 s). */
  attempts?: number;
  /** Stops retrying; the last error is thrown. */
  signal?: AbortSignal;
  /** For tests. */
  sleep?: (ms: number) => Promise<void>;
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs `call` and retries it with `backoffDelayMs` while it fails with an
 * unavailable error. Any other error is thrown at once, as is the last error
 * once the attempts run out or `signal` aborts. Only for calls that are safe
 * to repeat: a call whose answer was lost may already have happened.
 */
export async function retryWhileUnavailable<T>(
  call: (attempt: number) => Promise<T>,
  { attempts = 6, signal, sleep = wait }: RetryOptions = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await call(attempt);
    } catch (error) {
      const last = attempt + 1 >= attempts || signal?.aborted;
      if (last || !isUnavailableError(error)) throw error;
    }
    await sleep(backoffDelayMs(attempt));
  }
}
