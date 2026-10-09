import {
  DbError,
  getScore,
  recordScore,
  type DbClient,
  type RecordScoreInput,
  type Score,
} from "@/lib/db";
import { retryWhileUnavailable, type RetryOptions } from "./retry";

export interface SubmitRoundResultInput extends RecordScoreInput {
  /** The caller's own player, to read back a result that is already in. */
  playerId: string;
}

/**
 * Sends the caller's result for the live round and makes sure it counts
 * exactly once. While Supabase is unreachable it retries with backoff. If
 * an earlier attempt did reach the database but its answer was lost, the
 * retry gets `already_submitted`; the stored result is then read back and
 * returned, so the player sees their points and nothing is counted twice
 * (the database keeps one result per player per round). Other errors, such
 * as `round_not_live` once time is up, are thrown as they are.
 */
export function submitRoundResult(
  client: DbClient,
  input: SubmitRoundResultInput,
  options?: RetryOptions,
): Promise<Score> {
  return retryWhileUnavailable(async () => {
    try {
      return await recordScore(client, input);
    } catch (error) {
      if (error instanceof DbError && error.code === "already_submitted") {
        const saved = await getScore(client, input.roundId, input.playerId);
        if (saved) return saved;
      }
      throw error;
    }
  }, options);
}
