"use client";

import { useEffect, useState } from "react";
import { Countdown } from "@/components/fx/countdown";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { DbError, startRound, type DbClient, type Room } from "@/lib/db";
import { countdownElapsedMs } from "@/lib/game/race-fx";
import { roomErrorMessage } from "@/lib/rooms";
import { playSound } from "@/lib/sound/sounds";

/**
 * 3-2-1 on every screen when the room enters `countdown`, timed from the
 * moment the server changed the room (`updated_at`), so all screens show the
 * same number with beeps and "go". When it is over,
 * the admin's client starts the round; the database picks the puzzle and
 * starts the clock, so every player gets the same one. If the admin role
 * moves on during the countdown, the new admin's client starts it.
 */
export function RaceCountdown({
  client,
  room,
  isAdmin,
  clockOffsetMs,
}: {
  client: DbClient;
  room: Room;
  isAdmin: boolean;
  clockOffsetMs: number | null;
}) {
  const [elapsedMs] = useState(() =>
    countdownElapsedMs(room.updated_at, Date.now(), clockOffsetMs),
  );
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!done || !isAdmin) return;
    let cancelled = false;
    startRound(client, room.id).catch((caught: unknown) => {
      // invalid_transition: another client already started it.
      if (cancelled) return;
      if (caught instanceof DbError && caught.code === "invalid_transition") {
        return;
      }
      setError(roomErrorMessage(caught));
    });
    return () => {
      cancelled = true;
    };
  }, [client, room.id, done, isAdmin, attempt]);

  if (error) {
    return (
      <Card role="alert" className="flex flex-col items-start gap-3">
        <p>Could not start the round: {error}</p>
        <Button
          onClick={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </Button>
      </Card>
    );
  }
  if (done) {
    return (
      <Spinner size="lg" label="Starting the round" className="self-center" />
    );
  }
  return (
    <Countdown
      elapsedMs={elapsedMs}
      onStep={(value) => playSound(value === 0 ? "go" : "tick")}
      onDone={() => setDone(true)}
    />
  );
}
