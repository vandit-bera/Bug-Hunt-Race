import { expect, type Locator } from "@playwright/test";

/**
 * Reads the seconds shown by a timer: "1:05", "0:09", "45s" or "45".
 * Returns null when the text has no time in it.
 */
export function parseTimerSeconds(text: string): number | null {
  const clock = /(\d+):([0-5]\d)/.exec(text);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const seconds = /(\d+)\s*s?\b/.exec(text);
  return seconds ? Number(seconds[1]) : null;
}

/** True when `shown` is within `tolerance` seconds of `expected`. */
export function isWithinTolerance(
  shown: number | null,
  expected: number,
  tolerance: number,
): boolean {
  return shown !== null && Math.abs(shown - expected) <= tolerance;
}

export interface TimerOptions {
  /** Allowed difference in seconds. Default 2. */
  tolerance?: number;
  /** How long to keep checking, in ms. Default 5 000. */
  timeout?: number;
}

/**
 * Asserts a timer shows about `expectedSeconds`. Timers count from the
 * server's clock, and each browser sees it through its own clock and network
 * delay, so two players' timers can differ by a second or so: never assert an
 * exact value. `expectedSeconds` may be a function, read on every check, for a
 * timer that keeps running while the assertion retries.
 */
export async function expectTimerNear(
  timer: Locator,
  expectedSeconds: number | (() => number),
  { tolerance = 2, timeout = 5_000 }: TimerOptions = {},
) {
  const expected = () =>
    typeof expectedSeconds === "function" ? expectedSeconds() : expectedSeconds;
  await expect
    .poll(
      async () => {
        const shown = (await timer.textContent()) ?? "";
        const want = expected();
        return {
          shown,
          expected: want,
          withinTolerance: isWithinTolerance(
            parseTimerSeconds(shown),
            want,
            tolerance,
          ),
        };
      },
      { message: `timer within ${tolerance} s of the expected time`, timeout },
    )
    .toMatchObject({ withinTolerance: true });
}

/**
 * Seconds left until `deadline` by this machine's clock, for use with
 * `expectTimerNear(timer, () => secondsUntil(deadline))`.
 */
export function secondsUntil(deadline: Date): number {
  return Math.max(0, Math.round((deadline.getTime() - Date.now()) / 1000));
}
