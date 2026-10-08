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
  setRoomLocked,
  type DbClient,
  type Player,
  type RoomMembership,
} from "@/lib/db";
import { normalizeRoomCode } from "@/lib/game/room-code";
import {
  getBrowserDbClient,
  roomErrorMessage,
  useRoomConnection,
} from "@/lib/rooms";
import { InvitePanel } from "./invite-panel";
import { PlayerList, type RoomPlayer } from "./player-list";
import { RoomErrorCard } from "./room-error-card";
import { RoomSettingsSummary } from "./room-settings-summary";
import { RoomTopBar } from "./room-top-bar";

/** The room limit (private.max_players_per_room in the database). */
const MAX_PLAYERS = 30;

type Seat =
  | { kind: "loading" }
  | { kind: "unconfigured" }
  | { kind: "failed"; message: string }
  | { kind: "ready"; client: DbClient; membership: RoomMembership };

/**
 * `/room/<code>`: finds the player's seat in the room (kept across reloads by
 * the browser's anonymous session) and shows the live lobby. Anyone without a
 * seat is sent to `/join/<code>` to pick a name first.
 */
export function RoomLobby() {
  const code = normalizeRoomCode(useParams<{ code: string }>().code);
  const router = useRouter();
  const [seat, setSeat] = useState<Seat>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const client = getBrowserDbClient();
      if (!client) {
        if (!cancelled) setSeat({ kind: "unconfigured" });
        return;
      }
      try {
        const userId = await getSignedInUserId(client);
        const membership =
          userId && (await findMyMembership(client, code, userId));
        if (cancelled) return;
        if (membership) setSeat({ kind: "ready", client, membership });
        else router.replace(`/join/${code}`);
      } catch (error) {
        if (!cancelled) {
          setSeat({ kind: "failed", message: roomErrorMessage(error) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, router, attempt]);

  if (seat.kind === "ready") {
    return <Lobby client={seat.client} membership={seat.membership} />;
  }

  return (
    <>
      <RoomTopBar />
      {seat.kind === "loading" && <Loading text={`Opening room ${code}…`} />}
      {seat.kind === "unconfigured" && (
        <p role="alert">
          Rooms are not set up yet: Supabase is not configured. See
          .env.example.
        </p>
      )}
      {seat.kind === "failed" && (
        <Card role="alert" className="flex flex-col items-center gap-3">
          <p>{seat.message}</p>
          <Button
            variant="secondary"
            onClick={() => {
              setSeat({ kind: "loading" });
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </Button>
        </Card>
      )}
    </>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-muted">
      <Spinner size="sm" label={text} />
      <span aria-hidden="true">{text}</span>
    </div>
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

  const room = live.view?.room ?? membership.room;
  const players = live.view?.players ?? [membership.player];
  const online = live.view?.online;
  const selfId = membership.player.id;
  const me = players.find((p) => p.id === selfId) ?? membership.player;

  if (live.closed && !leaving) {
    return (
      <>
        <RoomTopBar />
        <RoomErrorCard
          kind="not-found"
          action={
            <Link
              href="/join"
              className={buttonClass({ variant: "secondary" })}
            >
              Try again
            </Link>
          }
        />
      </>
    );
  }

  // Presence updates within a second; until it has synced, fall back to the
  // database's slower view.
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
    } catch (error) {
      setLeaving(false);
      toast({ title: roomErrorMessage(error), variant: "danger" });
    }
  }

  async function changeLock(locked: boolean) {
    try {
      await setRoomLocked(client, room.id, locked);
    } catch (error) {
      toast({ title: roomErrorMessage(error), variant: "danger" });
    }
  }

  return (
    <>
      <RoomTopBar>
        <ConnectionBadge
          state={
            live.error ? "reconnecting" : live.view ? "live" : "connecting"
          }
        />
        <Button variant="danger" loading={leaving} onClick={() => void leave()}>
          Leave room
        </Button>
      </RoomTopBar>

      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold">
          Room <span className="tracking-widest">{room.code}</span>
        </h1>
        <p role="status" className="text-muted">
          {room.status !== "lobby"
            ? "A round is in progress. Next round starts soon."
            : me.is_admin
              ? "You're the admin. Invite players, then start when everyone's in."
              : "Waiting for the admin to start…"}
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card>
            <CardTitle as="h2">
              Players ({players.length}/{MAX_PLAYERS})
            </CardTitle>
            <PlayerList players={listed} selfId={selfId} />
          </Card>
          <section aria-labelledby="room-settings-title">
            <h2
              id="room-settings-title"
              className="mb-2 font-display text-lg font-bold"
            >
              Settings
            </h2>
            <RoomSettingsSummary
              language={room.language}
              level={room.level}
              totalRounds={room.total_rounds}
            />
          </section>
        </div>
        {me.is_admin && (
          <InvitePanel
            roomCode={room.code}
            link={`${window.location.origin}/join/${room.code}`}
            playerCount={players.length}
            maxPlayers={MAX_PLAYERS}
            locked={room.locked}
            onLockChange={(locked) => void changeLock(locked)}
          />
        )}
      </div>
    </>
  );
}

const CONNECTION = {
  connecting: { label: "Connecting…", variant: "neutral" },
  live: { label: "Connected", variant: "success" },
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
