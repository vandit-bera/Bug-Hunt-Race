"use client";

import { useReducedMotion } from "@/components/fx/use-reduced-motion";
import { useSlideRows } from "@/components/fx/use-slide-rows";
import { ChangeMarker } from "@/components/room/live-rank-list";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/components/ui/cn";
import { isTied, type Standing } from "@/lib/game/standings";

const ROW_HEIGHT_REM = 3.75;

/**
 * Overall standings, in rank order in the DOM. Rows slide to their new place
 * when the order changes; exact ties show the same place. `standings` must be
 * ranked (see `computeStandings`).
 */
export function Leaderboard({
  standings,
  currentPlayerId,
  label = "Leaderboard",
}: {
  standings: readonly Standing[];
  currentPlayerId?: string;
  label?: string;
}) {
  const reducedMotion = useReducedMotion();
  const rowRef = useSlideRows(
    standings.map((row) => row.id),
    ROW_HEIGHT_REM,
    reducedMotion,
  );
  if (standings.length === 0) {
    return <p className="text-muted">No players yet.</p>;
  }

  return (
    <ol
      aria-label={label}
      className="relative w-full"
      style={{ height: `${standings.length * ROW_HEIGHT_REM}rem` }}
    >
      {standings.map((row, index) => {
        const you = row.id === currentPlayerId;
        return (
          <li
            key={row.id}
            ref={rowRef(row.id)}
            aria-posinset={index + 1}
            aria-setsize={standings.length}
            className={cn(
              "absolute inset-x-0 flex min-w-0 items-center gap-2 rounded-lg border-2 bg-surface-raised px-2 sm:gap-3 sm:px-3",
              you ? "border-accent" : "border-border",
              !reducedMotion && "transition-transform duration-500 ease-out",
            )}
            style={{
              height: `${ROW_HEIGHT_REM - 0.5}rem`,
              transform: `translateY(${index * ROW_HEIGHT_REM}rem)`,
            }}
          >
            <span className="w-6 shrink-0 text-center font-display font-bold">
              <span className="sr-only">Place </span>
              {row.rank}
              {isTied(standings, index) && (
                <span className="sr-only"> (tied)</span>
              )}
            </span>
            <Avatar emoji={row.emoji} name={row.name} size="sm" />
            <span className="flex w-0 min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate font-bold">
                {row.name}
                {you && <span className="text-muted"> (you)</span>}
              </span>
              <span className="truncate text-xs text-muted">
                {row.roundsSolved} solved
              </span>
            </span>
            <ChangeMarker change={row.change} />
            <span className="shrink-0 text-right font-mono font-bold tabular-nums">
              {row.totalPoints}
              <span className="sr-only"> points</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
