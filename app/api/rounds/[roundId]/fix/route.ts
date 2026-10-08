import { createUserDbClient, revealRoundPuzzle } from "@/lib/db";
import { PUZZLE_FIXES } from "@/lib/puzzles/generated/fixes";
import { handleFixRequest } from "./handler";

/** The reference fix of an ended round, for players who were in it. */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/rounds/[roundId]/fix">,
) {
  const { roundId } = await ctx.params;
  return handleFixRequest(request, roundId, {
    revealPuzzle: (accessToken, id) =>
      revealRoundPuzzle(createUserDbClient(accessToken), id),
    fixFor: (puzzleId) =>
      Object.hasOwn(PUZZLE_FIXES, puzzleId)
        ? PUZZLE_FIXES[puzzleId]
        : undefined,
  });
}
