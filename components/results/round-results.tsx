import { ChangeMarker } from "@/components/room/live-rank-list";
import { formatTime } from "@/components/solo/result-screen";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/components/ui/cn";
import { isTied, type RoundRow } from "@/lib/game/standings";

function Breakdown({ score }: { score: RoundRow["score"] }) {
  return (
    <span>
      {score.base}
      {score.speedBonus > 0 && <> + {score.speedBonus} speed</>}
      {score.hintPenalty > 0 && <> − {score.hintPenalty} hint</>}
    </span>
  );
}

/**
 * One round's results: who solved it, how fast, the points (base + speed
 * bonus − hint) and the overall rank change. `rows` come from `roundResults`.
 */
export function RoundResults({
  rows,
  roundNumber,
  currentPlayerId,
}: {
  rows: readonly RoundRow[];
  roundNumber: number;
  currentPlayerId?: string;
}) {
  const title = `Round ${roundNumber} results`;
  if (rows.length === 0) {
    return <p className="text-muted">No players in this round.</p>;
  }
  return (
    <ol aria-label={title} className="flex w-full flex-col gap-2">
      {rows.map((row, index) => {
        const solved = row.solveMs !== null;
        const you = row.id === currentPlayerId;
        return (
          <li
            key={row.id}
            className={cn(
              "flex min-w-0 items-center gap-2 rounded-lg border-2 bg-surface-raised px-2 py-1.5 sm:gap-3 sm:px-3",
              you ? "border-accent" : "border-border",
              !solved && "opacity-75",
            )}
          >
            <span className="w-6 shrink-0 text-center font-display font-bold">
              <span className="sr-only">Place </span>
              {row.rank}
              {isTied(rows, index) && <span className="sr-only"> (tied)</span>}
            </span>
            <Avatar emoji={row.emoji} name={row.name} size="sm" />
            <span className="flex w-0 min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate font-bold">
                {row.name}
                {you && <span className="text-muted"> (you)</span>}
              </span>
              {solved ? (
                <span className="flex flex-wrap gap-x-2 text-xs text-muted">
                  <span>
                    <span className="sr-only">Solved in </span>
                    <span aria-hidden="true">⏱ </span>
                    {formatTime((row.solveMs ?? 0) / 1000)}
                  </span>
                  <Breakdown score={row.score} />
                </span>
              ) : (
                <span className="text-xs text-muted">Not solved</span>
              )}
            </span>
            <ChangeMarker change={row.change} />
            <span className="shrink-0 font-mono font-bold tabular-nums">
              {solved ? `+${row.score.total}` : "0"}
              <span className="sr-only"> points</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
