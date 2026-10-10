/**
 * Race Rooms effects: the shared 3-2-1 and "who just solved it". Pure: no
 * React, no Supabase.
 */

/** How long each countdown number shows, in milliseconds. */
export const COUNTDOWN_STEP_MS = 800;
/** The countdown starts at this number; 0 is "Go!". */
export const COUNTDOWN_FROM = 3;
/** Solve toasts on screen at once; older ones go first. */
export const MAX_SOLVE_TOASTS = 3;

/**
 * How far into the countdown this screen is, in milliseconds. Every screen
 * counts from the moment the server moved the room to `countdown`, so a
 * screen that heard about it late (or reloaded) catches up instead of
 * starting its own 3-2-1. Without a measured clock offset this device's
 * clock may be off by any amount, so a result outside the countdown is
 * not trusted and the countdown starts from the top.
 */
export function countdownElapsedMs(
  startedAt: string,
  nowMs: number,
  clockOffsetMs: number | null,
): number {
  const elapsed = nowMs + (clockOffsetMs ?? 0) - Date.parse(startedAt);
  const total = (COUNTDOWN_FROM + 1) * COUNTDOWN_STEP_MS;
  if (Number.isNaN(elapsed)) return 0;
  if (clockOffsetMs === null && (elapsed < 0 || elapsed > total)) return 0;
  return Math.min(Math.max(0, elapsed), total);
}

export interface RoundSolve {
  playerId: string;
  solveTimeMs: number;
  /** 1-based finishing place in the round. */
  place: number;
}

/**
 * Passing results not in `seen`, in the order they were solved, with their
 * finishing place among all passing results of the round.
 */
export function newSolves(
  scores: readonly {
    player_id: string;
    passed: boolean;
    solve_time_ms: number | null;
  }[],
  seen: ReadonlySet<string>,
): RoundSolve[] {
  return scores
    .filter((score) => score.passed && score.solve_time_ms !== null)
    .map((score) => ({
      playerId: score.player_id,
      solveTimeMs: score.solve_time_ms ?? 0,
    }))
    .sort((a, b) => a.solveTimeMs - b.solveTimeMs)
    .map((solve, index) => ({ ...solve, place: index + 1 }))
    .filter((solve) => !seen.has(solve.playerId));
}
