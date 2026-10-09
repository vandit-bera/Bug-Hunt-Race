"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  advanceRoom,
  getCurrentRound,
  pauseRound,
  recordScore,
  resumeRound,
  roundClock,
  skipRound,
  startRound,
  stopGame,
  type CurrentRoundView,
  type DbClient,
  type Room,
} from "@/lib/db";
import { formatTimeLeft, timeLeftMs } from "@/lib/game/round-clock";
import { fetchRoundFix, roomErrorMessage } from "@/lib/rooms";

interface RoundPanelProps {
  client: DbClient;
  room: Room;
  isAdmin: boolean;
}

/** Bare round controls for the lab; the race screens (TB-35) replace them. */
export function RoundPanel({ client, room, isAdmin }: RoundPanelProps) {
  const [view, setView] = useState<CurrentRoundView | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [fix, setFix] = useState<{ roundId: string; text: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  // Every round change (start, pause, resume, end) changes the room status.
  useEffect(() => {
    let cancelled = false;
    getCurrentRound(client, room.id).then(
      (next) => {
        if (!cancelled) setView(next);
      },
      (caught: unknown) => {
        if (!cancelled) setError(roomErrorMessage(caught));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [client, room.id, room.status, room.current_round, reload]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  async function act(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      setReload((n) => n + 1);
    } catch (caught) {
      setError(roomErrorMessage(caught));
    }
  }

  const round = view?.round;
  const live = room.status === "round_live";
  return (
    <section aria-label="Round" className="flex flex-col gap-2">
      {round ? (
        <>
          <p>
            Round {round.round_number}:{" "}
            <span data-testid="round-puzzle">{round.puzzle_id}</span> (
            {round.level})
          </p>
          <p>
            Time left:{" "}
            <span data-testid="round-time-left">
              {formatTimeLeft(
                timeLeftMs(roundClock(round), now + view.clockOffsetMs),
              )}
            </span>
          </p>
          {round.joined_late && !round.ended_at && (
            <p role="status">
              You joined mid-round: you play from the next one.
            </p>
          )}
          {round.submitted && <p role="status">Result sent.</p>}
        </>
      ) : (
        <p data-testid="round-puzzle">No round on.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {isAdmin && room.status === "countdown" && (
          <Button
            size="sm"
            onClick={() => act(() => startRound(client, room.id))}
          >
            Start round
          </Button>
        )}
        {isAdmin && live && (
          <Button
            size="sm"
            onClick={() => act(() => pauseRound(client, room.id))}
          >
            Pause
          </Button>
        )}
        {isAdmin && room.status === "paused" && (
          <Button
            size="sm"
            onClick={() => act(() => resumeRound(client, room.id))}
          >
            Resume
          </Button>
        )}
        {isAdmin && live && (
          <Button
            size="sm"
            onClick={() => act(() => skipRound(client, room.id))}
          >
            Skip round
          </Button>
        )}
        {isAdmin && (live || room.status === "paused") && (
          <Button
            size="sm"
            variant="danger"
            onClick={() => act(() => stopGame(client, room.id))}
          >
            Stop game
          </Button>
        )}
        {isAdmin && room.status === "round_results" && (
          <Button
            size="sm"
            onClick={() =>
              act(() => advanceRoom(client, room.id, "next_round"))
            }
          >
            Next round
          </Button>
        )}
        {round && live && !round.submitted && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              act(() =>
                recordScore(client, {
                  roundId: round.round_id,
                  passed: true,
                  hintUsed: false,
                }),
              )
            }
          >
            Submit solve
          </Button>
        )}
        {round && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              act(async () => {
                const { fix: text } = await fetchRoundFix(
                  client,
                  round.round_id,
                );
                setFix({ roundId: round.round_id, text });
              })
            }
          >
            Show fix
          </Button>
        )}
      </div>
      {fix && fix.roundId === round?.round_id && (
        <pre data-testid="round-fix" className="font-mono text-sm">
          {fix.text}
        </pre>
      )}
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
