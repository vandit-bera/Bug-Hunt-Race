import type { Player, RoomResultsRound } from "@/lib/db";
import { computeRoomAwards, type PlayerAwards } from "@/lib/game/room-awards";

/**
 * Every player's room awards from the server rows (`listRoomResults`) and
 * the room's current game. Inputs are the same for everyone in the room,
 * so every browser shows the same awards.
 */
export function toRoomAwards(
  rounds: readonly RoomResultsRound[],
  players: readonly Pick<Player, "id" | "joined_at">[],
  game: { gameNumber: number; gameOver: boolean },
): Map<string, PlayerAwards> {
  return computeRoomAwards({
    ...game,
    players: players.map((player) => ({
      id: player.id,
      joinedAt: player.joined_at,
    })),
    rounds: rounds.map((round) => ({
      id: round.id,
      gameNumber: round.game_number,
      startedAt: round.started_at,
      ended: round.ended_at !== null,
    })),
    scores: rounds.flatMap((round) =>
      round.scores.map((score) => ({
        roundId: round.id,
        playerId: score.player_id,
        passed: score.passed,
        solveMs: score.solve_time_ms,
        hintUsed: score.hint_used,
        points: score.points,
        submittedAt: score.submitted_at,
      })),
    ),
  });
}
