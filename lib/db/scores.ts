import type { DbClient } from "./client";
import { toDbError } from "./errors";
import type { LeaderboardEntry, Score } from "./models";

export interface RecordScoreInput {
  roundId: string;
  passed: boolean;
  hintUsed: boolean;
}

/**
 * Records the caller's one result for the live round: solved (`passed`) or
 * gave up, and whether they used the hint. The database measures the solve
 * time from the round's start (pauses excluded) and computes the points, so
 * the client cannot choose them. Raises `already_submitted` on a second
 * call, `joined_late` for a player who joined after the round started, and
 * `round_not_live` while paused or once the round is over. The last result
 * from the players who were in at the start ends the round.
 */
export async function recordScore(
  client: DbClient,
  input: RecordScoreInput,
): Promise<Score> {
  const { data, error } = await client.rpc("record_score", {
    round_id: input.roundId,
    passed: input.passed,
    hint_used: input.hintUsed,
  });
  if (error) throw toDbError(error);
  return data;
}

/**
 * One player's result for a round, or null if they have none yet. Room
 * members can read every result in their room.
 */
export async function getScore(
  client: DbClient,
  roundId: string,
  playerId: string,
): Promise<Score | null> {
  const { data, error } = await client
    .from("scores")
    .select()
    .eq("round_id", roundId)
    .eq("player_id", playerId)
    .maybeSingle();
  if (error) throw toDbError(error);
  return data;
}

/**
 * Leaderboard of the room's current game, best first: a new game (Play
 * again) starts everyone at 0. Ties on points go to the player whose last
 * solve came first (server time); exact ties share the same rank.
 * `previous_rank` is the rank before the latest round, for the up/down
 * arrows (null until the game's second round).
 */
export async function getLeaderboard(
  client: DbClient,
  roomId: string,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await client
    .from("room_leaderboard")
    .select()
    .eq("room_id", roomId)
    .order("rank")
    .order("display_name");
  if (error) throw toDbError(error);
  // See LeaderboardEntry for which view columns can be null.
  return data as LeaderboardEntry[];
}
