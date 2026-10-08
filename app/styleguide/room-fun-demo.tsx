"use client";

import { useCallback, useState } from "react";
import {
  FloatingReactions,
  type FloatingReaction,
} from "@/components/room/floating-reactions";
import { LiveRankList } from "@/components/room/live-rank-list";
import { ReactionBar } from "@/components/room/reaction-bar";
import {
  SolveToasts,
  type SolveToastData,
} from "@/components/room/solve-toast";
import { Button } from "@/components/ui/button";
import { addCapped, type RankRow } from "@/lib/game/room-fun";

const PLAYERS: RankRow[] = [
  { id: "riya", name: "Riya", emoji: "🦊", score: 120 },
  { id: "sam", name: "Sam", emoji: "🐙", score: 90 },
  { id: "kai", name: "Kai", emoji: "🦄", score: 60 },
  { id: "lee", name: "Lee", emoji: "🐢", score: 30 },
];

let nextId = 0;

export function RoomFunDemo() {
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [toasts, setToasts] = useState<SolveToastData[]>([]);
  const [rows, setRows] = useState(PLAYERS);
  const [solves, setSolves] = useState(0);

  const expire = useCallback((id: FloatingReaction["id"]) => {
    setReactions((current) => current.filter((item) => item.id !== id));
  }, []);
  const dismiss = useCallback((id: SolveToastData["id"]) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  function simulateSolve() {
    const player = PLAYERS[Math.floor(Math.random() * PLAYERS.length)];
    const rank = solves + 1;
    setSolves(rank);
    setToasts((current) => [
      ...current,
      {
        id: nextId++,
        name: player.name,
        emoji: player.emoji,
        seconds: 20 + Math.floor(Math.random() * 60),
        rank,
      },
    ]);
    setRows((current) =>
      current.map((row) =>
        row.id === player.id
          ? { ...row, score: row.score + 50 + Math.floor(Math.random() * 100) }
          : row,
      ),
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <ReactionBar
          onReact={(emoji) =>
            setReactions((current) =>
              addCapped(current, {
                id: nextId++,
                emoji,
                x: 5 + Math.random() * 85,
              }),
            )
          }
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            const emojis = ["😂", "🔥", "👏", "😱", "🐛", "🚀"];
            setReactions((current) =>
              Array.from({ length: 25 }).reduce<FloatingReaction[]>(
                (list) =>
                  addCapped(list, {
                    id: nextId++,
                    emoji: emojis[Math.floor(Math.random() * emojis.length)],
                    x: 5 + Math.random() * 85,
                  }),
                current,
              ),
            );
          }}
        >
          Simulate reaction burst
        </Button>
      </div>
      <FloatingReactions reactions={reactions} onExpire={expire} />
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={simulateSolve}>
          Simulate solve
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setRows(PLAYERS);
            setSolves(0);
          }}
        >
          Reset
        </Button>
      </div>
      <SolveToasts toasts={toasts} onDismiss={dismiss} />
      <LiveRankList rows={rows} />
    </div>
  );
}
