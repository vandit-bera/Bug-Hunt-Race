"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  advanceRoom,
  createBrowserDbClient,
  createRoom,
  ensureSignedIn,
  joinRoom,
  setRoomLocked,
  type DbClient,
  type RoomMembership,
} from "@/lib/db";
import { roomErrorMessage, useRoomConnection } from "@/lib/rooms";

// Survives a reload in this tab, so the lab can show a reconnect.
const STORAGE_KEY = "bhr-room-lab";
const AVATAR = "🦊";

interface Saved {
  code: string;
  name: string;
}

function isConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function RoomLab() {
  const [client] = useState(() =>
    isConfigured() ? createBrowserDbClient() : null,
  );
  if (!client) {
    return (
      <p role="alert">
        Supabase is not configured. Set the variables from .env.example and run{" "}
        <code>pnpm db:start</code>.
      </p>
    );
  }
  return <Lab client={client} />;
}

function Lab({ client }: { client: DbClient }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [membership, setMembership] = useState<RoomMembership | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = useRoomConnection(
    client,
    membership?.room.id ?? null,
    membership?.player.id ?? null,
  );

  async function enter(
    action: () => Promise<RoomMembership>,
    saveName: string,
  ) {
    setBusy(true);
    setError(null);
    try {
      await ensureSignedIn(client);
      const next = await action();
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          code: next.room.code,
          name: saveName,
        } satisfies Saved),
      );
      setMembership(next);
    } catch (caught) {
      setError(roomErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Saved;
    let cancelled = false;
    (async () => {
      try {
        await ensureSignedIn(client);
        const next = await joinRoom(client, {
          code: saved.code,
          displayName: saved.name,
          avatar: AVATAR,
        });
        if (!cancelled) setMembership(next);
      } catch (caught) {
        if (!cancelled) setError(roomErrorMessage(caught));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  async function act(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(roomErrorMessage(caught));
    }
  }

  function reset() {
    sessionStorage.removeItem(STORAGE_KEY);
    setMembership(null);
  }

  if (membership && live.closed) {
    return (
      <Card>
        <p role="status">Room closed.</p>
        <Button variant="secondary" onClick={reset}>
          Back
        </Button>
      </Card>
    );
  }

  if (membership) {
    const view = live.view;
    const me = view?.players.find((p) => p.id === membership.player.id);
    const roomId = membership.room.id;
    return (
      <Card className="flex flex-col gap-4">
        <CardTitle>Room {membership.room.code}</CardTitle>
        <p>
          You are{" "}
          <strong data-testid="me">
            {me?.display_name ?? membership.player.display_name}
          </strong>
          {me?.is_admin && " (admin)"}
        </p>
        <p data-testid="room-status">
          Status: {view?.room.status ?? "connecting…"}
          {view?.room.locked && " · locked"}
        </p>
        <ul aria-label="Players" className="flex flex-col gap-2">
          {view?.players.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <span aria-hidden>{p.avatar}</span>
              <span>{p.display_name}</span>
              {p.is_admin && <Badge variant="primary">admin</Badge>}
              <Badge variant={view.online.has(p.id) ? "success" : "neutral"}>
                {view.online.has(p.id) ? "online" : "offline"}
              </Badge>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          {me?.is_admin && (
            <>
              <Button
                size="sm"
                onClick={() => act(() => advanceRoom(client, roomId, "start"))}
              >
                Start game
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  act(() => setRoomLocked(client, roomId, !view?.room.locked))
                }
              >
                {view?.room.locked ? "Unlock room" : "Lock room"}
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="danger"
            onClick={() =>
              act(async () => {
                await live.leave();
                reset();
              })
            }
          >
            Leave room
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <Input
        label="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Button
        disabled={busy}
        onClick={() =>
          enter(
            () =>
              createRoom(client, {
                language: "javascript",
                level: "easy",
                totalRounds: 3,
                displayName: name,
                avatar: AVATAR,
              }),
            name,
          )
        }
      >
        Create room
      </Button>
      <Input
        label="Room code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() =>
          enter(
            () => joinRoom(client, { code, displayName: name, avatar: AVATAR }),
            name,
          )
        }
      >
        Join room
      </Button>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </Card>
  );
}
