"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { FinalLeaderboard } from "@/components/race/final-leaderboard";
import { RaceCountdown } from "@/components/race/race-countdown";
import { RaceRound } from "@/components/race/race-round";
import { RoundResults } from "@/components/race/round-results";
import { useAwardToasts } from "@/components/race/use-award-toasts";
import {
  useCurrentRound,
  useRoomAwards,
} from "@/components/race/use-race-data";
import {
  advanceRoom,
  findMyMembership,
  getSignedInUserId,
  type DbClient,
  type Player,
  type RoomMembership,
} from "@/lib/db";
import { racePhase, type RacePhase } from "@/lib/game/race";
import { normalizeRoomCode } from "@/lib/game/room-code";
import {
  MAX_PLAYERS_PER_ROOM,
  getBrowserDbClient,
  roomErrorMessage,
  useRoomConnection,
} from "@/lib/rooms";
import { PlayerList, type RoomPlayer } from "./player-list";
import { RoomErrorCard } from "./room-error-card";
import { RoomHeader } from "./room-header";
import { RoomReadyPanel } from "./room-ready-panel";
import { describeRoomSettings } from "./room-settings";

type Seat =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; client: DbClient; membership: RoomMembership };

/**
 * The room page: finds the caller's seat in this room, then connects. The
 * seat survives reloads (it belongs to the browser's anonymous session).
 * Without a seat, the player goes to `/join/<code>` to pick a name first.
 */
export function RoomLobby() {
  const code = normalizeRoomCode(useParams<{ code: string }>().code);
  const router = useRouter();
  const [seat, setSeat] = useState<Seat>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const client = getBrowserDbClient();
        const userId = await getSignedInUserId(client);
        const membership =
          userId && (await findMyMembership(client, code, userId));
        if (cancelled) return;
        if (membership) setSeat({ status: "ready", client, membership });
        else router.replace(`/join/${code}`);
      } catch (caught) {
        if (!cancelled) {
          setSeat({ status: "error", message: roomErrorMessage(caught) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, router, attempt]);

  switch (seat.status) {
    case "loading":
      return (
        <RoomFrame>
          <RoomHeader title="Room" />
          <Spinner size="lg" label="Loading the room" className="self-center" />
        </RoomFrame>
      );
    case "error":
      return (
        <RoomFrame>
          <RoomHeader title="Room" />
          <RoomErrorCard
            kind="disconnected"
            action={
              <Button
                onClick={() => {
                  setSeat({ status: "loading" });
                  setAttempt((n) => n + 1);
                }}
              >
                Try again
              </Button>
            }
          />
        </RoomFrame>
      );
    case "ready":
      return <Lobby client={seat.client} membership={seat.membership} />;
  }
}

/** The room closed (admin Close, or abandoned) while the player was in it. */
function RoomGone() {
  return (
    <RoomFrame>
      <RoomHeader title="Room" />
      <RoomErrorCard
        kind="closed"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/join" className={buttonClass()}>
              Try again
            </Link>
            <Link
              href="/room/new"
              className={buttonClass({ variant: "secondary" })}
            >
              Create a room
            </Link>
          </div>
        }
      />
    </RoomFrame>
  );
}

function phaseTitle(phase: RacePhase, isAdmin: boolean, round: number) {
  switch (phase) {
    case "lobby":
      return isAdmin ? "Room ready" : "Lobby";
    case "waiting":
      return "Lobby";
    case "countdown":
      return "Get ready";
    case "loading":
    case "playing":
      return `Round ${round}`;
    case "results":
      return `Round ${round} results`;
    case "final":
      return "Final leaderboard";
  }
}

function Lobby({
  client,
  membership,
}: {
  client: DbClient;
  membership: RoomMembership;
}) {
  const router = useRouter();
  const toast = useToast();
  const live = useRoomConnection(
    client,
    membership.room.id,
    membership.player.id,
  );
  const room = live.view?.room ?? membership.room;
  const current = useCurrentRound(client, room);
  const [leaving, setLeaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const players = live.view?.players ?? [membership.player];
  const me =
    players.find((player) => player.id === membership.player.id) ??
    membership.player;
  const awards = useRoomAwards(client, room, players);
  useAwardToasts(awards, me.id, {
    gameNumber: room.game_number,
    gameOver: room.status === "final_leaderboard",
  });
  if (live.closed && !leaving) return <RoomGone />;
  const phase =
    room.status === "closed"
      ? "lobby"
      : racePhase(
          room.status,
          current.view && { joinedLate: current.view.round.joined_late },
        );

  // Presence notices a dropped player within a second; until it has
  // synced, fall back to the database's slower view.
  const online = live.view?.online;
  const isOnline = (player: Player) =>
    online && online.size > 0 ? online.has(player.id) : player.connected;
  const listed: RoomPlayer[] = players.map((player) => ({
    id: player.id,
    name: player.display_name,
    avatar: player.avatar,
    isAdmin: player.is_admin,
    connected: isOnline(player),
  }));

  async function leave() {
    setLeaving(true);
    try {
      await live.leave();
      router.push("/");
    } catch (caught) {
      setLeaving(false);
      toast({ title: roomErrorMessage(caught), variant: "danger" });
    }
  }

  async function start() {
    setStarting(true);
    try {
      await advanceRoom(client, room.id, "start");
    } catch (caught) {
      toast({ title: roomErrorMessage(caught), variant: "danger" });
    } finally {
      setStarting(false);
    }
  }

  let body: ReactNode;
  switch (phase) {
    case "lobby":
    case "waiting":
      body = (
        <>
          {phase === "waiting" ? (
            <Card role="status">
              A round is in progress. You&apos;ll play from the next round.
            </Card>
          ) : me.is_admin ? (
            <div className="flex flex-col items-start gap-2">
              <Button size="lg" loading={starting} onClick={() => void start()}>
                Start game
              </Button>
              <p className="text-sm text-muted">
                Everyone in the lobby plays. Players who join later wait for the
                next round.
              </p>
            </div>
          ) : (
            <Card role="status">Waiting for the admin to start…</Card>
          )}
          {me.is_admin && (
            <RoomReadyPanel
              client={client}
              room={room}
              playerCount={players.length}
            />
          )}
          <Card>
            <CardTitle as="h2">
              Players ({players.length}/{MAX_PLAYERS_PER_ROOM})
            </CardTitle>
            <PlayerList players={listed} selfId={me.id} />
          </Card>
        </>
      );
      break;
    case "countdown":
      body = (
        <RaceCountdown
          key={`${room.game_number}-${room.current_round}`}
          client={client}
          room={room}
          isAdmin={me.is_admin}
        />
      );
      break;
    case "loading":
      body = current.error ? (
        <Card role="alert" className="flex flex-col items-start gap-3">
          <p>Could not load the round: {current.error}</p>
          <Button onClick={current.retry}>Try again</Button>
        </Card>
      ) : (
        <Spinner size="lg" label="Loading the round" className="self-center" />
      );
      break;
    case "playing":
      body = current.view && (
        <RaceRound
          key={current.view.round.round_id}
          client={client}
          room={room}
          view={current.view}
          players={players}
          me={me}
        />
      );
      break;
    case "results":
      body = current.view && (
        <RoundResults
          key={current.view.round.round_id}
          client={client}
          room={room}
          view={current.view}
          players={players}
          me={me}
          awards={awards}
        />
      );
      break;
    case "final":
      body = (
        <FinalLeaderboard client={client} room={room} me={me} awards={awards} />
      );
      break;
  }

  return (
    <RoomFrame wide={phase === "playing"}>
      <RoomHeader
        title={phaseTitle(phase, me.is_admin, room.current_round)}
        actions={
          <>
            <ConnectionBadge
              state={
                live.error !== null
                  ? "reconnecting"
                  : live.view
                    ? "connected"
                    : "connecting"
              }
            />
            <Button
              variant="danger"
              loading={leaving}
              onClick={() => void leave()}
            >
              Leave room
            </Button>
          </>
        }
      />
      <p data-testid="room-settings" className="text-muted">
        {describeRoomSettings({
          language: room.language,
          level: room.level,
          totalRounds: room.total_rounds,
        })}
      </p>
      {live.error !== null && (
        <p role="status" className="text-sm font-bold text-warning">
          Connection lost. Reconnecting…
        </p>
      )}
      {body}
    </RoomFrame>
  );
}

/** The race needs the full width for the editor; other screens stay narrow. */
function RoomFrame({
  wide = false,
  children,
}: {
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-1 flex-col gap-6",
        wide ? "max-w-6xl" : "max-w-2xl",
      )}
    >
      {children}
    </div>
  );
}

const CONNECTION = {
  connecting: { label: "Connecting…", variant: "neutral" },
  connected: { label: "Connected", variant: "success" },
  reconnecting: { label: "Reconnecting…", variant: "warning" },
} as const;

function ConnectionBadge({ state }: { state: keyof typeof CONNECTION }) {
  const { label, variant } = CONNECTION[state];
  return (
    <Badge variant={variant} role="status" aria-label={`Connection: ${label}`}>
      {label}
    </Badge>
  );
}
