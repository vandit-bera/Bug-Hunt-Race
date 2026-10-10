"use client";

import { useEffect, useState } from "react";
import type { RoomAwards } from "@/components/results/award-badges";
import { RoundResults as RoundResultsList } from "@/components/results/round-results";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import {
  advanceRoom,
  type CurrentRoundView,
  type DbClient,
  type Player,
  type Room,
  type RoomEvent,
} from "@/lib/db";
import { availableEvents } from "@/lib/game/room-machine";
import { fetchRoundFix, roomErrorMessage, toRoundRows } from "@/lib/rooms";
import { LiveStandings } from "./live-standings";
import { useLeaderboard, useRoundScores } from "./use-race-data";

const NEXT_STEPS: { event: RoomEvent; label: string }[] = [
  { event: "next_round", label: "Next round" },
  { event: "finish", label: "Final results" },
];

/**
 * After a round: who solved it, their times and points, the overall rank
 * changes, the room awards so far and the standings; if nobody solved it, the reference fix (anyone
 * can open it). The admin moves on to the next round or the final
 * leaderboard.
 */
export function RoundResults({
  client,
  room,
  view,
  players,
  me,
  awards,
}: {
  client: DbClient;
  room: Room;
  view: CurrentRoundView;
  players: Player[];
  me: Player;
  awards: RoomAwards | null;
}) {
  const toast = useToast();
  const { round } = view;
  const scores = useRoundScores(client, round.round_id, false);
  const leaderboard = useLeaderboard(client, room, false);
  const [busy, setBusy] = useState<RoomEvent | null>(null);
  if (!scores || (!leaderboard.entries && !leaderboard.error)) {
    return (
      <Spinner size="lg" label="Loading the results" className="self-center" />
    );
  }

  const rows = toRoundRows(round, players, scores, leaderboard.entries ?? []);
  const nobodySolved = !rows.some((row) => row.solveMs !== null);
  const steps = me.is_admin
    ? availableEvents(
        {
          state: room.status,
          currentRound: room.current_round,
          totalRounds: room.total_rounds,
        },
        "admin",
      )
    : [];

  async function advance(event: RoomEvent) {
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
        <CardTitle as="h2">{round.title}</CardTitle>
        <RoundResultsList
          rows={rows}
          roundNumber={round.round_number}
          currentPlayerId={me.id}
          awards={awards}
        />
      </Card>
      <LiveStandings leaderboard={leaderboard} selfId={me.id} replayChanges />
      <FixReveal
        client={client}
        roundId={round.round_id}
        autoShow={nobodySolved}
      />
      {me.is_admin ? (
        <div className="flex flex-wrap gap-2">
          {NEXT_STEPS.filter((step) => steps.includes(step.event)).map(
            (step, index) => (
              <Button
                key={step.event}
                variant={index === 0 ? "primary" : "secondary"}
                loading={busy === step.event}
                disabled={busy !== null}
                onClick={() => void advance(step.event)}
              >
                {step.label}
              </Button>
            ),
          )}
        </div>
      ) : (
        <p role="status" className="text-muted">
          Waiting for the admin to start the next round…
        </p>
      )}
    </>
  );
}

type FixState =
  | { status: "hidden" }
  | { status: "loading" }
  | { status: "shown"; fix: string }
  | { status: "error"; message: string };

/**
 * The reference fix of the ended round. It comes from the server only now
 * (`/api/rounds/<id>/fix`); it is never in the page before the round ends.
 */
function FixReveal({
  client,
  roundId,
  autoShow,
}: {
  client: DbClient;
  roundId: string;
  autoShow: boolean;
}) {
  const [state, setState] = useState<FixState>({
    status: autoShow ? "loading" : "hidden",
  });

  async function load() {
    setState({ status: "loading" });
    try {
      const { fix } = await fetchRoundFix(client, roundId);
      setState({ status: "shown", fix });
    } catch (caught) {
      setState({ status: "error", message: roomErrorMessage(caught) });
    }
  }

  useEffect(() => {
    if (!autoShow) return;
    let cancelled = false;
    fetchRoundFix(client, roundId).then(
      ({ fix }) => {
        if (!cancelled) setState({ status: "shown", fix });
      },
      (caught: unknown) => {
        if (!cancelled) {
          setState({ status: "error", message: roomErrorMessage(caught) });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [client, roundId, autoShow]);

  return (
    <Card className="flex flex-col items-start gap-3">
      <CardTitle as="h3" className="mb-0">
        {autoShow ? "Nobody solved it. Here is the fix:" : "The fix"}
      </CardTitle>
      {state.status === "shown" ? (
        <pre
          data-testid="round-fix"
          className="w-full overflow-x-auto rounded-lg border-2 border-border-subtle bg-background p-3 font-mono text-sm"
        >
          {state.fix}
        </pre>
      ) : state.status === "error" ? (
        <>
          <p role="alert" className="text-danger">
            {state.message}
          </p>
          <Button variant="secondary" onClick={() => void load()}>
            Try again
          </Button>
        </>
      ) : (
        <Button
          variant="secondary"
          loading={state.status === "loading"}
          onClick={() => void load()}
        >
          Show the fix
        </Button>
      )}
    </Card>
  );
}
