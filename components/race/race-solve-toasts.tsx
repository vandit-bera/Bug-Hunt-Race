"use client";

import { useCallback, useState } from "react";
import {
  SolveToasts,
  type SolveToastData,
} from "@/components/room/solve-toast";
import type { Player, Score } from "@/lib/db";
import { MAX_SOLVE_TOASTS, newSolves } from "@/lib/game/race-fx";
import { capNewest } from "@/lib/game/room-fun";

/**
 * "Name fixed it in 42s!" for every other player's solve this round. Solves
 * already in the first read (e.g. after a reload) do not toast. At most
 * `MAX_SOLVE_TOASTS` show; each one dismisses itself.
 */
export function RaceSolveToasts({
  roundId,
  scores,
  players,
  selfId,
}: {
  roundId: string;
  scores: Score[] | null;
  players: readonly Player[];
  selfId: string;
}) {
  const [source, setSource] = useState<Score[] | null>(null);
  const [seen, setSeen] = useState<ReadonlySet<string> | null>(null);
  const [toasts, setToasts] = useState<SolveToastData[]>([]);
  const dismiss = useCallback((id: SolveToastData["id"]) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  if (scores && scores !== source) {
    setSource(scores);
    const fresh = newSolves(scores, seen ?? new Set());
    setSeen(new Set([...(seen ?? []), ...fresh.map((s) => s.playerId)]));
    if (seen) {
      const added = fresh.flatMap((solve): SolveToastData[] => {
        const player = players.find((p) => p.id === solve.playerId);
        if (!player || player.id === selfId) return [];
        return [
          {
            id: `${roundId}:${player.id}`,
            name: player.display_name,
            emoji: player.avatar,
            seconds: Math.round(solve.solveTimeMs / 1000),
            rank: solve.place,
          },
        ];
      });
      if (added.length > 0) {
        setToasts((current) =>
          capNewest([...current, ...added], MAX_SOLVE_TOASTS),
        );
      }
    }
  }

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex justify-center sm:right-auto">
      <SolveToasts toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
