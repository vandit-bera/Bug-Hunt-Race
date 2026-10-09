"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import {
  findMyMembership,
  getSignedInUserId,
  type DbClient,
  type Player,
  type RoomMembership,
} from "@/lib/db";
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
        <>
          <RoomHeader title="Room" />
          <Spinner size="lg" label="Loading the room" className="self-center" />
        </>
      );
    case "error":
      return (
        <>
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
        </>
      );
    case "ready":
      return <Lobby client={seat.client} membership={seat.membership} />;
  }
}

function RoomGone() {
  return (
    <>
      <RoomHeader title="Room" />
      <RoomErrorCard
        kind="not-found"
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
    </>
  );
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
  const [leaving, setLeaving] = useState(false);
  if (live.closed && !leaving) return <RoomGone />;

  const room = live.view?.room ?? membership.room;
  const players = live.view?.players ?? [membership.player];
  const me =
    players.find((player) => player.id === membership.player.id) ??
    membership.player;

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

  return (
    <>
      <RoomHeader
        title={me.is_admin ? "Room ready" : "Lobby"}
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
      {room.status !== "lobby" ? (
        <Card role="status">
          A round is in progress. Next round starts soon.
        </Card>
      ) : (
        !me.is_admin && (
          <Card role="status">Waiting for the admin to start…</Card>
        )
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
