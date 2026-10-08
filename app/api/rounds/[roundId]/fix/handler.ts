import { DbError } from "@/lib/db";
import type { RoundFix, RoundFixError } from "@/lib/rooms/round-fix";

export interface FixRevealDeps {
  /**
   * Asks the database, as the player who owns `accessToken`, which puzzle an
   * ended round played. Throws a `DbError` (`round_not_over`,
   * `round_not_found`, `not_authenticated`).
   */
  revealPuzzle(accessToken: string, roundId: string): Promise<string>;
  /** The reference fix of a puzzle, from the server-only fixes. */
  fixFor(puzzleId: string): string | undefined;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS: Record<string, number> = {
  not_authenticated: 401,
  round_not_found: 404,
  round_not_over: 403,
};

function json(body: RoundFix | RoundFixError, status: number): Response {
  // Per player and per moment (before / after the round ends): never cache.
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function bearerToken(request: Request): string | null {
  const match = /^Bearer (\S+)$/.exec(
    request.headers.get("authorization") ?? "",
  );
  return match?.[1] ?? null;
}

/**
 * `GET /api/rounds/<round id>/fix`. The fix is read only after the database
 * has confirmed, for the calling player, that the round has ended.
 */
export async function handleFixRequest(
  request: Request,
  roundId: string,
  deps: FixRevealDeps,
): Promise<Response> {
  const token = bearerToken(request);
  if (!token) return json({ error: "not_authenticated" }, 401);
  if (!UUID.test(roundId)) return json({ error: "round_not_found" }, 404);

  let puzzleId: string;
  try {
    puzzleId = await deps.revealPuzzle(token, roundId);
  } catch (error) {
    const code = error instanceof DbError ? error.code : "unknown";
    return json({ error: code }, STATUS[code] ?? 500);
  }

  const fix = deps.fixFor(puzzleId);
  if (fix === undefined) return json({ error: "fix_not_found" }, 404);
  return json({ puzzleId, fix }, 200);
}
