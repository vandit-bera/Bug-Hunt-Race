import type { DbClient } from "./client";
import { toDbError } from "./errors";
import type { LeaderboardEntry, Score } from "./models";

export interface RecordScoreInput {
  roundId: string;
  passed: boolean;
  hintUsed: boolean;
}

/**
 * Records the caller's result for the live round. The database measures the
 * solve time and computes the points, so they cannot be chosen by the client.
 * A passing result is final; calling again returns it unchanged.
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
 * Room leaderboard, best first. Ties on points go to the lower total solve
 * time; exact ties share the same rank.
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
  // See LeaderboardEntry: the view's columns are never null.
  return data as LeaderboardEntry[];
}
