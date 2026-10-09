/** Share of the base points that the speed bonus can add at most. */
export const MAX_SPEED_BONUS_RATIO = 0.5;

/** Share of the base points that one hint costs. */
export const HINT_PENALTY_RATIO = 0.25;

export interface ScoreInput {
  solved: boolean;
  basePoints: number;
  timeLimitSec: number;
  /** Seconds from the start of the round to the passing run. */
  elapsedSec: number;
  hintsUsed: number;
}

export interface ScoreBreakdown {
  base: number;
  speedBonus: number;
  hintPenalty: number;
  total: number;
}

const ZERO: ScoreBreakdown = {
  base: 0,
  speedBonus: 0,
  hintPenalty: 0,
  total: 0,
};

/**
 * score = base + speed bonus - hint penalty, never below 0.
 * Unsolved, time-up and gave-up rounds score 0 (pass `solved: false`).
 * The formulas are documented in docs/ARCHITECTURE.md.
 */
export function computeScore(input: ScoreInput): ScoreBreakdown {
  const { solved, basePoints, timeLimitSec, elapsedSec, hintsUsed } = input;
  if (!solved || elapsedSec >= timeLimitSec) return ZERO;

  const remaining = Math.max(0, timeLimitSec - Math.max(0, elapsedSec));
  const speedBonus = Math.round(
    basePoints * MAX_SPEED_BONUS_RATIO * (remaining / timeLimitSec),
  );
  const hintPenalty = Math.round(
    basePoints * HINT_PENALTY_RATIO * Math.max(0, hintsUsed),
  );
  const total = Math.max(0, basePoints + speedBonus - hintPenalty);
  return { base: basePoints, speedBonus, hintPenalty, total };
}

export interface RaceScoreInput {
  passed: boolean;
  basePoints: number;
  timeLimitSec: number;
  /** Server-measured, from the round start to the passing run; null unless passed. */
  solveMs: number | null;
  hintUsed: boolean;
}

/**
 * The points of a race result, as the database stores them
 * (`private.calculate_points`): the Solo formula, except that a pass in the
 * 5 s grace after the deadline is timed at the limit and keeps the base
 * points (no speed bonus) instead of scoring 0.
 */
export function computeRaceScore(input: RaceScoreInput): ScoreBreakdown {
  const { passed, basePoints, timeLimitSec, solveMs, hintUsed } = input;
  if (!passed || solveMs === null) return ZERO;
  // 1 ms before the limit: still in time, and the speed bonus rounds to 0.
  const elapsedMs = Math.min(solveMs, timeLimitSec * 1000 - 1);
  return computeScore({
    solved: true,
    basePoints,
    timeLimitSec,
    elapsedSec: elapsedMs / 1000,
    hintsUsed: hintUsed ? 1 : 0,
  });
}
