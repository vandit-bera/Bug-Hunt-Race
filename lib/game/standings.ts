import type { ScoreBreakdown } from "./scoring";

/**
 * Ranking for the race results screens. Same order as the `room_leaderboard`
 * view: points (highest first), then server-measured solve time (fastest
 * first); exact ties share the place (1, 1, 3), like SQL `rank()`.
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
 * Sorts by `points` (desc), then `time` (asc), and gives exact ties the same
 * rank. Ties are listed by name, then id, so the order is stable.
 */
function assignRanks<T extends StandingsPlayer>(
  items: readonly T[],
  points: (item: T) => number,
  time: (item: T) => number,
): (T & { rank: number })[] {
  const sorted = [...items].sort(
    (a, b) =>
      points(b) - points(a) ||
      time(a) - time(b) ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  );
  let rank = 0;
  return sorted.map((item, index) => {
    const prev = sorted[index - 1];
    const tied =
      prev !== undefined &&
      points(prev) === points(item) &&
      time(prev) === time(item);
    if (!tied) rank = index + 1;
    return { ...item, rank };
  });
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

function rankTotals(
  players: readonly StandingsPlayer[],
  rounds: readonly (readonly RoundResult[])[],
) {
  return assignRanks(
    totals(players, rounds),
    (row) => row.totalPoints,
    (row) => row.totalSolveMs,
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
    (row) => row.score.total,
    (row) => row.solveMs ?? Infinity,
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
