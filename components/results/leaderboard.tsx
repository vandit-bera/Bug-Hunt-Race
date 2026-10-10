"use client";

import { useReducedMotion } from "@/components/fx/use-reduced-motion";
import { ChangeMarker } from "@/components/room/live-rank-list";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/components/ui/cn";
import { awardsOf } from "@/lib/game/room-awards";
import { isTied, type Standing } from "@/lib/game/standings";
import { AwardBadges, type RoomAwards } from "./award-badges";

// Row pitch. On phones, award chips get a line of their own.
const ROW_HEIGHT = "[--row:3.75rem]";
const ROW_HEIGHT_WITH_AWARDS = "[--row:3.75rem] max-sm:[--row:4.75rem]";

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
  const anyAwards = standings.some((row) => {
    const held = awardsOf(awards ?? null, row.id);
    return held.awards.length > 0 || held.winStreak > 0;
  });
  return (
    <ol
      aria-label={label}
      className={cn(
        "relative w-full",
        anyAwards ? ROW_HEIGHT_WITH_AWARDS : ROW_HEIGHT,
      )}
      style={{ height: `calc(var(--row) * ${standings.length})` }}
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
              height: "calc(var(--row) - 0.5rem)",
              transform: `translateY(calc(var(--row) * ${index}))`,
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
              <span className="flex min-w-0 gap-x-1.5 text-xs text-muted max-sm:flex-col sm:items-center">
                <span className="shrink-0">{row.roundsSolved} solved</span>
                <AwardBadges
                  awards={awards}
                  playerId={row.id}
                  compact
                  className="min-w-0 overflow-hidden"
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
