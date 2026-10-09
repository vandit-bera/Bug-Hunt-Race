"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/components/fx/use-reduced-motion";
import { ChangeMarker } from "@/components/room/live-rank-list";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/components/ui/cn";
import { isTied, type Standing } from "@/lib/game/standings";

const ROW_HEIGHT_REM = 3.75;
/** How long `replayChanges` shows the previous order before sliding. */
const REPLAY_DELAY_MS = 400;

/**
 * Overall standings. Rows slide to their new place when the order changes;
 * exact ties show the same place. `standings` must be ranked (see
 * `computeStandings`). `replayChanges` first shows the order before the
 * last round (from `change`), then slides rows to their new place.
 */
export function Leaderboard({
  standings,
  currentPlayerId,
  label = "Leaderboard",
  replayChanges = false,
}: {
  standings: readonly Standing[];
  currentPlayerId?: string;
  label?: string;
  replayChanges?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const [replaying, setReplaying] = useState(replayChanges);
  const showPrevious = replaying && !reducedMotion;
  useEffect(() => {
    if (!replaying) return;
    const timer = setTimeout(() => setReplaying(false), REPLAY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [replaying]);
  if (standings.length === 0) {
    return <p className="text-muted">No players yet.</p>;
  }

  const position = new Map(standings.map((row, index) => [row.id, index]));
  const shown = showPrevious
    ? new Map(
        [...standings]
          .map((row, index) => ({
            id: row.id,
            index,
            before: row.rank + row.change,
          }))
          .sort((a, b) => a.before - b.before || a.index - b.index)
          .map((row, index) => [row.id, index]),
      )
    : position;
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
              transform: `translateY(${(shown.get(row.id) ?? index) * ROW_HEIGHT_REM}rem)`,
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
