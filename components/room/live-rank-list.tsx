"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/components/ui/cn";
import { rankRows, type RankRow, type RankedRow } from "@/lib/game/room-fun";

const ROW_HEIGHT_REM = 3.5;
const COUNT_UP_MS = 600;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function useCountUp(target: number, disabled: boolean) {
  const [shown, setShown] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    if (disabled) return;
    let frame = 0;
    const from = current.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / COUNT_UP_MS, 1);
      current.current = Math.round(from + (target - from) * t);
      setShown(current.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, disabled]);
  return disabled ? target : shown;
}

function ChangeMarker({ change }: { change: number }) {
  if (change === 0) return <span className="w-8" />;
  const up = change > 0;
  return (
    <span
      className={cn(
        "w-8 text-xs font-bold",
        up ? "text-success" : "text-danger",
      )}
    >
      <span aria-hidden="true">{up ? "▲" : "▼"}</span>
      <span className="sr-only">{up ? "Up" : "Down"} </span>
      {Math.abs(change)}
    </span>
  );
}

function RankItem({
  row,
  reducedMotion,
}: {
  row: RankedRow;
  reducedMotion: boolean;
}) {
  const score = useCountUp(row.score, reducedMotion);
  return (
    <li
      className={cn(
        "absolute inset-x-0 flex items-center gap-3 rounded-lg border-2 border-border bg-surface-raised px-3",
        !reducedMotion && "transition-transform duration-500 ease-out",
      )}
      style={{
        height: `${ROW_HEIGHT_REM - 0.5}rem`,
        transform: `translateY(${(row.rank - 1) * ROW_HEIGHT_REM}rem)`,
      }}
    >
      <span className="w-6 text-center font-display font-bold">{row.rank}</span>
      <Avatar emoji={row.emoji} name={row.name} size="sm" />
      <span className="flex-1 truncate font-bold">{row.name}</span>
      <ChangeMarker change={row.change} />
      <span className="w-14 text-right font-mono font-bold tabular-nums">
        {score}
      </span>
    </li>
  );
}

/** Leaderboard that slides rows to their new place and counts scores up. */
export function LiveRankList({ rows }: { rows: readonly RankRow[] }) {
  const reducedMotion = usePrefersReducedMotion();
  const [source, setSource] = useState(rows);
  const [ranked, setRanked] = useState(() => rankRows(rows));
  if (source !== rows) {
    setSource(rows);
    setRanked(rankRows(rows, ranked));
  }

  if (ranked.length === 0) {
    return <p className="text-muted">No players yet.</p>;
  }
  return (
    <ol
      aria-label="Live leaderboard"
      className="relative w-full"
      style={{ height: `${ranked.length * ROW_HEIGHT_REM}rem` }}
    >
      {[...ranked]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((row) => (
          <RankItem key={row.id} row={row} reducedMotion={reducedMotion} />
        ))}
    </ol>
  );
}
