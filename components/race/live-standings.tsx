"use client";

import { Leaderboard } from "@/components/results/leaderboard";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toStandings } from "@/lib/rooms";
import type { LeaderboardState } from "./use-race-data";

/**
 * The game's standings in a card: rank, avatar, name, points and rounds
 * solved, with ▲▼ for places changed in the last round.
 */
export function LiveStandings({
  leaderboard,
  selfId,
  title = "Leaderboard",
}: {
  leaderboard: LeaderboardState;
  selfId: string;
  title?: string;
}) {
  const { entries, error, retry } = leaderboard;
  return (
    <Card>
      <CardTitle as="h3">{title}</CardTitle>
      {error ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="text-danger">{error}</p>
          <Button variant="secondary" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : entries ? (
        <Leaderboard
          standings={toStandings(entries)}
          currentPlayerId={selfId}
          label={title}
        />
      ) : (
        <Spinner label="Loading the leaderboard" />
      )}
    </Card>
  );
}
