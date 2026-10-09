"use client";

import { useReducedMotion } from "@/components/fx/use-reduced-motion";
import { ChangeMarker } from "@/components/room/live-rank-list";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/components/ui/cn";
import { isTied, type Standing } from "@/lib/game/standings";
import { AwardBadges, type RoomAwards } from "./award-badges";

const ROW_HEIGHT_REM = 3.75;

/**
 * Overall standings. Rows slide to their new place when the order changes;
 * exact ties show the same place; room awards sit next to the rounds solved.
 * `standings` must be ranked (see `computeStandings`).
 */
export function Leaderboard({
  standings,
  currentPlayerId,
  label = "Leaderboard",
  awards,
}: {
  standings: readonly Standing[];
  currentPlayerId?: string;
  label?: string;
  awards?: RoomAwards | null;
}) {
  const reducedMotion = useReducedMotion();
  if (standings.length === 0) {
    return <p className="text-muted">No players yet.</p>;
  }

  const position = new Map(standings.map((row, index) => [row.id, index]));
  // Render in a fixed order so React keeps each row's element and the CSS
  // transition can slide it; the visual order comes from `translateY`.
  const stable = [...standings].sort((a, b) => a.id.localeCompare(b.id));
  return (
    <ol
      aria-label={label}
      className="relative w-full"
      style={{ height: `${standings.length * ROW_HEIGHT_REM}rem` }}
    >
      {stable.map((row) => {
        const index = position.get(row.id) ?? 0;
        const you = row.id === currentPlayerId;
        return (
          <li
            key={row.id}
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
              <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
                <span className="shrink-0">{row.roundsSolved} solved</span>
                <AwardBadges
                  awards={awards}
                  playerId={row.id}
                  className="min-w-0 flex-nowrap overflow-hidden"
                />
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
