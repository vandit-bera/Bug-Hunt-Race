import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/components/ui/cn";
import { formatTime } from "@/components/solo/result-screen";
import type { Player, Score } from "@/lib/db";
import type { ProgressRow, RaceProgress } from "@/lib/game/race";
import { roundProgress } from "@/lib/game/race";

const LABELS: Record<RaceProgress, { icon: string; text: string }> = {
  solved: { icon: "✅", text: "Solved" },
  gave_up: { icon: "🏳️", text: "Gave up" },
  fixing: { icon: "⏳", text: "Still fixing" },
};

/** Room players and round results as progress rows (see lib/game/race). */
export function progressRows(
  players: readonly Player[],
  scores: readonly Score[],
  roundStartedAt: string,
): ProgressRow[] {
  return roundProgress(
    players.map((player) => ({
      id: player.id,
      name: player.display_name,
      avatar: player.avatar,
      joinedAt: player.joined_at,
    })),
    scores.map((score) => ({
      playerId: score.player_id,
      passed: score.passed,
      solveTimeMs: score.solve_time_ms,
      hintUsed: score.hint_used,
      points: score.points,
    })),
    roundStartedAt,
  );
}

/**
 * Who has solved the round and who is still fixing it. `ended` shows the
 * points and "Not solved" for players without a result (round results).
 */
export function RoundProgress({
  rows,
  label,
  selfId,
  ended = false,
}: {
  rows: ProgressRow[];
  label: string;
  selfId: string;
  ended?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="text-muted">Nobody played this round.</p>;
  }
  return (
    <ol aria-label={label} className="flex flex-col gap-2">
      {rows.map(({ player, progress, result }) => (
        <li
          key={player.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border-2 border-border-subtle bg-surface p-2"
        >
          <Avatar emoji={player.avatar} name={player.name} size="sm" />
          <span className="min-w-24 flex-1 basis-24 truncate font-bold">
            {player.name}
            {player.id === selfId && (
              <span className="ml-1 font-normal text-muted">(you)</span>
            )}
          </span>
          <span
            className={cn(
              "text-sm",
              progress === "solved" ? "font-bold text-success" : "text-muted",
            )}
          >
            <span aria-hidden="true">{LABELS[progress].icon} </span>
            {ended && progress === "fixing"
              ? "Not solved"
              : LABELS[progress].text}
            {result?.solveTimeMs != null &&
              ` in ${formatTime(result.solveTimeMs / 1000)}`}
            {result?.hintUsed && " (hint)"}
          </span>
          {ended && (
            <span className="font-display font-bold tabular-nums">
              {result?.points ?? 0} pts
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
