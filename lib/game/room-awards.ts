/**
 * Race Room awards, computed only from server data (rounds and scores as
 * stored, server timestamps), so every browser in the room shows the same
 * awards and nobody can fake one.
 *
 * Per game (the room's current game, ended rounds only):
 *   - First Blood: the first correct solve of the game (earliest server time).
 *   - Speed Demon: the fastest single solve; equal times go to the earlier
 *     server time.
 *   - No Hints Needed: solved every round they played, none with the hint,
 *     at least `NO_HINTS_MIN_ROUNDS` rounds.
 * Across games (Play again): the win streak, the number of finished games in
 * a row, up to the latest one, the player won (rank 1 with points, same
 * order as the leaderboard). Shown from `WIN_STREAK_MIN` games.
 *
 * Exact ties share an award, like the leaderboard.
 */

export const NO_HINTS_MIN_ROUNDS = 2;
export const WIN_STREAK_MIN = 2;

export type GameAwardId = "first-blood" | "speed-demon" | "no-hints-needed";

export interface AwardDefinition {
  id: GameAwardId | "win-streak";
  name: string;
  emoji: string;
  howTo: string;
}

export const ROOM_AWARDS = {
  "first-blood": {
    id: "first-blood",
    name: "First Blood",
    emoji: "🩸",
    howTo: "The first correct solve of the game.",
  },
  "speed-demon": {
    id: "speed-demon",
    name: "Speed Demon",
    emoji: "⚡",
    howTo: "The fastest single solve of the game.",
  },
  "no-hints-needed": {
    id: "no-hints-needed",
    name: "No Hints Needed",
    emoji: "🧠",
    howTo: `Solve every round you play without a hint (at least ${NO_HINTS_MIN_ROUNDS}).`,
  },
  "win-streak": {
    id: "win-streak",
    name: "Win streak",
    emoji: "🔥",
    howTo: "Win games in a row in this room.",
  },
} as const satisfies Record<AwardDefinition["id"], AwardDefinition>;

const GAME_AWARD_IDS: readonly GameAwardId[] = [
  "first-blood",
  "speed-demon",
  "no-hints-needed",
];

export interface AwardPlayer {
  id: string;
  /** Server time the player joined; rounds that started earlier don't count. */
  joinedAt: string;
}

export interface AwardRound {
  id: string;
  gameNumber: number;
  startedAt: string;
  /** Only ended rounds count, so awards don't change while a round is on. */
  ended: boolean;
}

export interface AwardScore {
  roundId: string;
  playerId: string;
  passed: boolean;
  /** Server-measured solve time; null unless passed. */
  solveMs: number | null;
  hintUsed: boolean;
  points: number;
  /** Server timestamp of the result. */
  submittedAt: string;
}

export interface RoomAwardsInput {
  players: readonly AwardPlayer[];
  rounds: readonly AwardRound[];
  scores: readonly AwardScore[];
  /** The room's current game (`rooms.game_number`). */
  gameNumber: number;
  /** True once the current game is over (final leaderboard). */
  gameOver: boolean;
}

export interface PlayerAwards {
  /** In `ROOM_AWARDS` order. */
  awards: GameAwardId[];
  /** Games won in a row; 0 below `WIN_STREAK_MIN`. */
  winStreak: number;
}

const NO_AWARDS: PlayerAwards = { awards: [], winStreak: 0 };

/**
 * Microseconds since the epoch of a Postgres timestamp such as
 * `2026-10-09T12:00:00.123456+00:00`. `Date.parse` keeps only milliseconds,
 * which would turn distinct server times into ties.
 */
export function serverTimeMicros(timestamp: string): number {
  const match = /^(.*?:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)$/.exec(
    timestamp,
  );
  if (!match) return Date.parse(timestamp) * 1000;
  const [, seconds, fraction = "", zone] = match;
  const micros = Number(fraction.slice(0, 6).padEnd(6, "0"));
  return Date.parse(`${seconds}${zone}`) * 1000 + micros;
}

/** The ids of the items with the lowest key under `compare` (ties share). */
function winners<T>(
  items: readonly T[],
  compare: (a: T, b: T) => number,
  id: (item: T) => string,
): Set<string> {
  let best: T[] = [];
  for (const item of items) {
    const order = best.length === 0 ? -1 : compare(item, best[0]);
    if (order < 0) best = [item];
    else if (order === 0) best.push(item);
  }
  return new Set(best.map(id));
}

function gameAwards(
  players: readonly AwardPlayer[],
  rounds: readonly AwardRound[],
  scores: readonly AwardScore[],
): Map<string, GameAwardId[]> {
  const roundIds = new Set(rounds.map((round) => round.id));
  const results = scores.filter((score) => roundIds.has(score.roundId));
  const solves = results
    .filter((score) => score.passed && score.solveMs !== null)
    .map((score) => ({
      playerId: score.playerId,
      solveMs: score.solveMs ?? 0,
      at: serverTimeMicros(score.submittedAt),
    }));
  const byPlayer = (solve: { playerId: string }) => solve.playerId;

  const earned: Record<GameAwardId, Set<string>> = {
    "first-blood": winners(solves, (a, b) => a.at - b.at, byPlayer),
    "speed-demon": winners(
      solves,
      (a, b) => a.solveMs - b.solveMs || a.at - b.at,
      byPlayer,
    ),
    "no-hints-needed": new Set(
      players
        .filter((player) => {
          const joined = Date.parse(player.joinedAt);
          const played = rounds.filter(
            (round) => joined <= Date.parse(round.startedAt),
          );
          return (
            played.length >= NO_HINTS_MIN_ROUNDS &&
            played.every((round) =>
              results.some(
                (score) =>
                  score.roundId === round.id &&
                  score.playerId === player.id &&
                  score.passed &&
                  !score.hintUsed,
              ),
            )
          );
        })
        .map((player) => player.id),
    ),
  };

  const awards = new Map<string, GameAwardId[]>();
  for (const id of GAME_AWARD_IDS) {
    for (const playerId of earned[id]) {
      awards.set(playerId, [...(awards.get(playerId) ?? []), id]);
    }
  }
  return awards;
}

/**
 * The winners of one game: rank 1 on the leaderboard (most points, then the
 * earlier last solve by server time; exact ties share), with points.
 */
function gameWinners(
  rounds: readonly AwardRound[],
  scores: readonly AwardScore[],
): Set<string> {
  const roundIds = new Set(rounds.map((round) => round.id));
  const totals = new Map<string, { points: number; lastSolve: number }>();
  for (const score of scores) {
    if (!roundIds.has(score.roundId)) continue;
    const total = totals.get(score.playerId) ?? { points: 0, lastSolve: 0 };
    total.points += score.points;
    if (score.passed) {
      total.lastSolve = Math.max(
        total.lastSolve,
        serverTimeMicros(score.submittedAt),
      );
    }
    totals.set(score.playerId, total);
  }
  const scored = [...totals].filter(([, total]) => total.points > 0);
  return winners(
    scored,
    ([, a], [, b]) => b.points - a.points || a.lastSolve - b.lastSolve,
    ([playerId]) => playerId,
  );
}

function winStreaks(input: RoomAwardsInput): Map<string, number> {
  const lastFinished = input.gameOver ? input.gameNumber : input.gameNumber - 1;
  const streaks = new Map<string, number>();
  let alive: Set<string> | null = null;
  for (let game = lastFinished; game >= 1; game--) {
    const won = gameWinners(
      input.rounds.filter((round) => round.gameNumber === game),
      input.scores,
    );
    const still: Set<string> = new Set(
      [...won].filter((id) => alive === null || alive.has(id)),
    );
    if (still.size === 0) break;
    for (const id of still) streaks.set(id, (streaks.get(id) ?? 0) + 1);
    alive = still;
  }
  return streaks;
}

/**
 * Every player's awards: the current game's awards from its ended rounds,
 * and the win streak over finished games. Players without any are left out.
 */
export function computeRoomAwards(
  input: RoomAwardsInput,
): Map<string, PlayerAwards> {
  const ended = input.rounds.filter((round) => round.ended);
  const game = gameAwards(
    input.players,
    ended.filter((round) => round.gameNumber === input.gameNumber),
    input.scores,
  );
  const streaks = winStreaks({ ...input, rounds: ended });

  const result = new Map<string, PlayerAwards>();
  for (const id of new Set([...game.keys(), ...streaks.keys()])) {
    const streak = streaks.get(id) ?? 0;
    const awards = game.get(id) ?? [];
    const winStreak = streak >= WIN_STREAK_MIN ? streak : 0;
    if (awards.length > 0 || winStreak > 0) {
      result.set(id, { awards, winStreak });
    }
  }
  return result;
}

/** A player's awards, or none. */
export function awardsOf(
  awards: ReadonlyMap<string, PlayerAwards> | null,
  playerId: string,
): PlayerAwards {
  return awards?.get(playerId) ?? NO_AWARDS;
}

/**
 * Keys for the awards a player holds, for "did they just earn it?": a game
 * award counts once per game; a streak once per length, named by the game it
 * started in (the same while the next game is on as when the last one ended).
 */
export function awardKeys(
  awards: PlayerAwards,
  game: { gameNumber: number; gameOver: boolean },
): string[] {
  const keys = awards.awards.map((id) => `${game.gameNumber}:${id}`);
  if (awards.winStreak > 0) {
    const lastFinished = game.gameOver ? game.gameNumber : game.gameNumber - 1;
    const since = lastFinished - awards.winStreak + 1;
    keys.push(`streak:${since}:${awards.winStreak}`);
  }
  return keys;
}
