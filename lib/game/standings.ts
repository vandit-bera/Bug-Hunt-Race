import type { ScoreBreakdown } from "./scoring";

/**
 * Ranking for the race results screens. Same order as the `room_leaderboard`
 * view: points (highest first), then the earlier server time of the last
 * solve; exact ties share the place (1, 1, 3), like SQL `rank()`. Rounds run
 * one after another and every player's solve time counts from the same
 * start, so "earlier last solve" is: solved last in an earlier round, or in
 * the same round with a lower solve time.
 */

export interface StandingsPlayer {
  id: string;
  name: string;
  emoji: string;
}

export interface RoundResult {
  playerId: string;
  /** Server-measured time from round start to the passing run; null = not solved. */
  solveMs: number | null;
  score: ScoreBreakdown;
}

export type RoundRow = StandingsPlayer & {
  rank: number;
  solveMs: number | null;
  score: ScoreBreakdown;
  /** Overall places gained (positive) or lost (negative) this round. */
  change: number;
};

export type Standing = StandingsPlayer & {
  rank: number;
  totalPoints: number;
  roundsSolved: number;
  totalSolveMs: number;
  /** Places gained (positive) or lost (negative) in the last round. */
  change: number;
};

export interface PodiumStep {
  rank: number;
  players: Standing[];
}

const NOT_SOLVED: ScoreBreakdown = {
  base: 0,
  speedBonus: 0,
  hintPenalty: 0,
  total: 0,
};

/**
 * Sorts by `compare` and gives items it finds equal the same rank. Ties are
 * listed by name, then id, so the order is stable.
 */
function assignRanks<T extends StandingsPlayer>(
  items: readonly T[],
  compare: (a: T, b: T) => number,
): (T & { rank: number })[] {
  const sorted = [...items].sort(
    (a, b) =>
      compare(a, b) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
  let rank = 0;
  return sorted.map((item, index) => {
    const prev = sorted[index - 1];
    if (prev === undefined || compare(prev, item) !== 0) rank = index + 1;
    return { ...item, rank };
  });
}

/** When a player's last solve happened: round index, then solve time. */
interface LastSolve {
  round: number;
  solveMs: number;
}

function totals(
  players: readonly StandingsPlayer[],
  rounds: readonly (readonly RoundResult[])[],
): Omit<Standing, "rank" | "change">[] {
  return players.map((player) => {
    let totalPoints = 0;
    let roundsSolved = 0;
    let totalSolveMs = 0;
    for (const round of rounds) {
      const result = round.find((r) => r.playerId === player.id);
      if (result?.solveMs == null) continue;
      totalPoints += result.score.total;
      roundsSolved += 1;
      totalSolveMs += result.solveMs;
    }
    return { ...player, totalPoints, roundsSolved, totalSolveMs };
  });
}

function lastSolve(
  playerId: string,
  rounds: readonly (readonly RoundResult[])[],
): LastSolve | null {
  for (let round = rounds.length - 1; round >= 0; round--) {
    const solveMs = rounds[round].find((r) => r.playerId === playerId)?.solveMs;
    if (solveMs != null) return { round, solveMs };
  }
  return null;
}

/** Ascending, with null (never solved) last and equal to another null. */
function compareNullsLast<T>(
  a: T | null,
  b: T | null,
  compare: (a: T, b: T) => number,
): number {
  if (a === null || b === null) return Number(a === null) - Number(b === null);
  return compare(a, b);
}

const earlierSolve = (a: LastSolve, b: LastSolve) =>
  a.round - b.round || a.solveMs - b.solveMs;

const fasterMs = (a: number, b: number) => a - b;

function rankTotals(
  players: readonly StandingsPlayer[],
  rounds: readonly (readonly RoundResult[])[],
) {
  const last = new Map(players.map((p) => [p.id, lastSolve(p.id, rounds)]));
  return assignRanks(
    totals(players, rounds),
    (a, b) =>
      b.totalPoints - a.totalPoints ||
      compareNullsLast(
        last.get(a.id) ?? null,
        last.get(b.id) ?? null,
        earlierSolve,
      ),
  );
}

/**
 * Overall standings after every round so far. `change` compares with the
 * standings before the last round (0 after the first round).
 */
export function computeStandings(
  players: readonly StandingsPlayer[],
  rounds: readonly (readonly RoundResult[])[],
): Standing[] {
  const now = rankTotals(players, rounds);
  if (rounds.length < 2) return now.map((row) => ({ ...row, change: 0 }));
  const before = new Map(
    rankTotals(players, rounds.slice(0, -1)).map((row) => [row.id, row.rank]),
  );
  return now.map((row) => ({
    ...row,
    change: (before.get(row.id) ?? row.rank) - row.rank,
  }));
}

/**
 * Results of the last round: solvers by points then time, then everyone who
 * did not solve it with 0. `change` is the overall rank change this round.
 */
export function roundResults(
  players: readonly StandingsPlayer[],
  rounds: readonly (readonly RoundResult[])[],
): RoundRow[] {
  const last = rounds.at(-1) ?? [];
  const changes = new Map(
    computeStandings(players, rounds).map((row) => [row.id, row.change]),
  );
  const rows = players.map((player) => {
    const result = last.find((r) => r.playerId === player.id);
    const solveMs = result?.solveMs ?? null;
    return {
      ...player,
      solveMs,
      score: result && solveMs !== null ? result.score : NOT_SOLVED,
      change: changes.get(player.id) ?? 0,
    };
  });
  return assignRanks(
    rows,
    (a, b) =>
      b.score.total - a.score.total ||
      compareNullsLast(a.solveMs, b.solveMs, fasterMs),
  );
}

/**
 * Up to three podium steps (1st, 2nd, 3rd place) from ranked standings. Tied
 * players share a step, so 1, 1, 3 gives a gold step with two players and a
 * bronze step. Players with 0 points don't get a medal.
 */
export function podiumSteps(standings: readonly Standing[]): PodiumStep[] {
  const steps: PodiumStep[] = [];
  for (const row of standings) {
    if (row.rank > 3 || row.totalPoints <= 0) continue;
    const step = steps.find((s) => s.rank === row.rank);
    if (step) step.players.push(row);
    else steps.push({ rank: row.rank, players: [row] });
  }
  return steps.sort((a, b) => a.rank - b.rank);
}

/** True when the row at `index` of a ranked list shares its place. */
export function isTied(rows: readonly { rank: number }[], index: number) {
  const rank = rows[index].rank;
  return rows[index - 1]?.rank === rank || rows[index + 1]?.rank === rank;
}
