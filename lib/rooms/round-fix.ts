import { DbError, toDbError, type DbClient } from "@/lib/db";

/**
 * The fix reveal: after a round ends, players can see the reference fix.
 * Fixes never go in the database or the client bundle; the route
 * `GET /api/rounds/<round id>/fix` (app/api/rounds/[roundId]/fix) asks the
 * database, as the calling player, whether the round has ended, and only then
 * reads the fix from the server-only lib/puzzles/generated/fixes.ts.
 */

export interface RoundFix {
  puzzleId: string;
  fix: string;
}

/** Body of a failed request: a DbErrorCode, or `fix_not_found`. */
export interface RoundFixError {
  error: string;
}

export function roundFixPath(roundId: string): string {
  return `/api/rounds/${encodeURIComponent(roundId)}/fix`;
}

/**
 * Fetches the reference fix of an ended round the caller was in. Throws a
 * `DbError`: `round_not_over` while the round is on, `round_not_found` for
 * a round the caller never saw, `not_authenticated` without a session.
 */
export async function fetchRoundFix(
  client: DbClient,
  roundId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RoundFix> {
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new DbError("not_authenticated");

  const response = await fetchImpl(roundFixPath(roundId), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as
    RoundFix | RoundFixError | null;
  if (response.ok && body && "fix" in body) return body;
  throw toDbError({
    message: body && "error" in body ? body.error : `HTTP ${response.status}`,
  });
}
