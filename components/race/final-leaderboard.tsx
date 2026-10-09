"use client";

import { useEffect, useState } from "react";
import { Podium } from "@/components/results/podium";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { advanceRoom, type DbClient, type Player, type Room } from "@/lib/db";
import { roomErrorMessage, toStandings } from "@/lib/rooms";
import { playSound } from "@/lib/sound/sounds";
import { useLeaderboard } from "./use-race-data";

/**
 * The game is over: the top 3 on a podium, the full list below and a
 * confetti burst and a fanfare. The admin can play again (same players, scores back to 0)
 * or close the room.
 */
export function FinalLeaderboard({
  client,
  room,
  me,
}: {
  client: DbClient;
  room: Room;
  me: Player;
}) {
  const toast = useToast();
  const { entries, error, retry } = useLeaderboard(client, room, false);
  const [busy, setBusy] = useState<"play_again" | "close" | null>(null);
  const loaded = entries !== null;

  useEffect(() => {
    if (loaded) playSound("fanfare");
  }, [loaded]);

  async function advance(event: "play_again" | "close") {
    setBusy(event);
    try {
      await advanceRoom(client, room.id, event);
    } catch (caught) {
      setBusy(null);
      toast({ title: roomErrorMessage(caught), variant: "danger" });
    }
  }

  if (error) {
    return (
      <Card role="alert" className="flex flex-col items-start gap-3">
        <p className="text-danger">{error}</p>
        <Button variant="secondary" onClick={retry}>
          Try again
        </Button>
      </Card>
    );
  }
  if (!entries) {
    return (
      <Spinner
        size="lg"
        label="Loading the leaderboard"
        className="self-center"
      />
    );
  }
  return (
    <>
      <Podium
        standings={toStandings(entries)}
        currentPlayerId={me.id}
        isAdmin={me.is_admin}
        onPlayAgain={() => void advance("play_again")}
        onCloseRoom={() => void advance("close")}
        busy={busy}
      />
      {!me.is_admin && (
        <p role="status" className="text-center text-muted">
          Thanks for playing! The admin can start a new game.
        </p>
      )}
    </>
  );
}
