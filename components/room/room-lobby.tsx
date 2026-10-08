"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LEVELS } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  ensureSignedIn,
  findMyMembership,
  type DbClient,
  type Room,
  type RoomMembership,
} from "@/lib/db";
import {
  getBrowserDbClient,
  roomErrorMessage,
  useRoomConnection,
} from "@/lib/rooms";
import { LANGUAGES } from "@/lib/runner/config";
import { RoomErrorCard } from "./room-error-card";
import { RoomHeader } from "./room-header";
import { RoomReadyPanel } from "./room-ready-panel";

type Seat =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error"; message: string }
  | { status: "ready"; client: DbClient; membership: RoomMembership };

/** The room page: finds the caller's seat in this room, then connects. */
export function RoomLobby() {
  const { code } = useParams<{ code: string }>();
  const [seat, setSeat] = useState<Seat>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const client = getBrowserDbClient();
        const userId = await ensureSignedIn(client);
        const membership = await findMyMembership(client, code, userId);
        if (cancelled) return;
        setSeat(
          membership
            ? { status: "ready", client, membership }
            : { status: "missing" },
        );
      } catch (caught) {
        if (!cancelled) {
          setSeat({ status: "error", message: roomErrorMessage(caught) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, attempt]);

  switch (seat.status) {
    case "loading":
      return (
        <>
          <RoomHeader title="Room" />
          <Spinner size="lg" label="Loading the room" className="self-center" />
        </>
      );
    case "missing":
      return <RoomGone />;
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
          <Link href="/room/new" className={buttonClass()}>
            Create a room
          </Link>
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
  const live = useRoomConnection(
    client,
    membership.room.id,
    membership.player.id,
  );
  if (live.closed) return <RoomGone />;

  const room = live.view?.room ?? membership.room;
  const me =
    live.view?.players.find((player) => player.id === membership.player.id) ??
    membership.player;

  return (
    <>
      <RoomHeader title={me.is_admin ? "Room ready" : "Lobby"} />
      <p data-testid="room-settings" className="text-muted">
        {settingsSummary(room)}
      </p>
      {live.error !== null && (
        <p role="status" className="text-sm font-bold text-warning">
          Connection lost. Reconnecting…
        </p>
      )}
      {me.is_admin ? (
        <RoomReadyPanel
          client={client}
          room={room}
          playerCount={live.view?.players.length ?? 1}
        />
      ) : (
        <Card role="status">Waiting for the admin to start…</Card>
      )}
    </>
  );
}

function settingsSummary(room: Room): string {
  const level = room.level === "mixed" ? "Mixed" : LEVELS[room.level].label;
  const rounds =
    room.total_rounds === null
      ? "Play until the admin stops"
      : `${room.total_rounds} rounds`;
  return `${LANGUAGES[room.language].label} · ${level} · ${rounds}`;
}
