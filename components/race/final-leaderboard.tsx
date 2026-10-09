"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import {
  advanceRoom,
  getLeaderboard,
  type DbClient,
  type LeaderboardEntry,
  type Player,
  type Room,
} from "@/lib/db";
import { roomErrorMessage } from "@/lib/rooms";

/**
 * The game is over: a plain ranked list of the raw results. Task 3.5
 * (TB-36) turns it into the podium. The admin can play again or close.
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
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<"play_again" | "close" | null>(null);

  useEffect(() => {
    let cancelled = false;
    getLeaderboard(client, room.id).then(
      (next) => {
        if (!cancelled) setEntries(next);
      },
      (caught: unknown) => {
        if (!cancelled) setError(roomErrorMessage(caught));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [client, room.id, attempt]);

  async function advance(event: "play_again" | "close") {
    setBusy(event);
    try {
      await advanceRoom(client, room.id, event);
    } catch (caught) {
      setBusy(null);
      toast({ title: roomErrorMessage(caught), variant: "danger" });
    }
  }

  return (
    <>
      <Card>
        <CardTitle as="h2">Leaderboard</CardTitle>
        {error ? (
          <div role="alert" className="flex flex-col items-start gap-3">
            <p className="text-danger">{error}</p>
            <Button
              variant="secondary"
              onClick={() => {
                setError(null);
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </Button>
          </div>
        ) : !entries ? (
          <Spinner label="Loading the leaderboard" />
        ) : (
          <ol aria-label="Leaderboard" className="flex flex-col gap-2">
            {entries.map((entry) => (
              <li
                key={entry.player_id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border-2 border-border-subtle bg-surface p-2"
              >
                <span className="w-8 text-center font-display font-bold tabular-nums">
                  #{entry.rank}
                </span>
                <Avatar
                  emoji={entry.avatar}
                  name={entry.display_name}
                  size="sm"
                />
                <span className="min-w-24 flex-1 basis-24 truncate font-bold">
                  {entry.display_name}
                  {entry.player_id === me.id && (
                    <span className="ml-1 font-normal text-muted">(you)</span>
                  )}
                </span>
                <span className="font-display font-bold tabular-nums">
                  {entry.total_points} pts
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
      {me.is_admin ? (
        <div className="flex flex-wrap gap-2">
          <Button
            loading={busy === "play_again"}
            disabled={busy !== null}
            onClick={() => void advance("play_again")}
          >
            Play again
          </Button>
          <Button
            variant="secondary"
            loading={busy === "close"}
            disabled={busy !== null}
            onClick={() => void advance("close")}
          >
            Close room
          </Button>
        </div>
      ) : (
        <p role="status" className="text-muted">
          Thanks for playing! The admin can start a new game.
        </p>
      )}
    </>
  );
}
