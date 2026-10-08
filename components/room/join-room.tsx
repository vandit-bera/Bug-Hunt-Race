"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  DbError,
  ensureSignedIn,
  findMyMembership,
  findRoomByCode,
  getSignedInUserId,
  joinRoom,
  type RoomPreview,
} from "@/lib/db";
import { normalizeRoomCode } from "@/lib/game/room-code";
import { getBrowserDbClient, roomErrorMessage } from "@/lib/rooms";
import { NameAvatarForm } from "./name-avatar-form";
import type { PlayerProfile } from "./name-avatar";
import { RoomErrorCard, type RoomErrorKind } from "./room-error-card";
import { RoomSettingsSummary } from "./room-settings-summary";

type State =
  | { kind: "loading" }
  | { kind: "unconfigured" }
  | { kind: "failed"; message: string }
  | { kind: "blocked"; reason: RoomErrorKind }
  | { kind: "ready"; preview: RoomPreview };

const BLOCKING_ERRORS: Partial<Record<DbError["code"], RoomErrorKind>> = {
  room_not_found: "not-found",
  room_locked: "locked",
  room_full: "full",
};

function previewBlock(preview: RoomPreview | null): RoomErrorKind | null {
  if (!preview) return "not-found";
  if (preview.locked) return "locked";
  if (preview.is_full) return "full";
  return null;
}

/**
 * `/join/<code>`, where typed codes, invite links and QR scans all land:
 * checks the room, asks for a name and avatar, joins, and opens the lobby.
 * A player already in the room goes straight back to the lobby.
 */
export function JoinRoom() {
  const code = normalizeRoomCode(useParams<{ code: string }>().code);
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [joining, setJoining] = useState(false);
  const [nameError, setNameError] = useState<string>();
  const [joinError, setJoinError] = useState<string>();
  const lobbyHref = `/room/${code}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const client = getBrowserDbClient();
      if (!client) {
        if (!cancelled) setState({ kind: "unconfigured" });
        return;
      }
      try {
        const userId = await getSignedInUserId(client);
        if (userId && (await findMyMembership(client, code, userId))) {
          if (!cancelled) router.replace(lobbyHref);
          return;
        }
        const preview = await findRoomByCode(client, code);
        if (cancelled) return;
        const reason = previewBlock(preview);
        setState(
          preview && !reason
            ? { kind: "ready", preview }
            : { kind: "blocked", reason: reason ?? "not-found" },
        );
      } catch (error) {
        if (!cancelled) {
          setState({ kind: "failed", message: roomErrorMessage(error) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, lobbyHref, router, attempt]);

  async function join(profile: PlayerProfile) {
    const client = getBrowserDbClient();
    if (!client) return;
    setJoining(true);
    setNameError(undefined);
    setJoinError(undefined);
    try {
      await ensureSignedIn(client);
      await joinRoom(client, {
        code,
        displayName: profile.name,
        avatar: profile.avatar,
      });
      router.replace(lobbyHref);
    } catch (error) {
      setJoining(false);
      const errorCode = error instanceof DbError ? error.code : "unknown";
      const reason = BLOCKING_ERRORS[errorCode];
      if (reason) {
        setState({ kind: "blocked", reason });
      } else if (errorCode === "invalid_display_name") {
        setNameError(roomErrorMessage(error));
      } else {
        setJoinError(roomErrorMessage(error));
      }
    }
  }

  if (state.kind === "loading") {
    return (
      <div className="flex items-center gap-2 text-muted">
        <Spinner size="sm" label={`Finding room ${code}…`} />
        <span aria-hidden="true">Finding room {code}…</span>
      </div>
    );
  }

  if (state.kind === "unconfigured") {
    return (
      <p role="alert">
        Rooms are not set up yet: Supabase is not configured. See .env.example.
      </p>
    );
  }

  if (state.kind === "failed") {
    return (
      <Card role="alert" className="flex flex-col items-center gap-3">
        <p>{state.message}</p>
        <Button
          variant="secondary"
          onClick={() => {
            setState({ kind: "loading" });
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </Button>
      </Card>
    );
  }

  if (state.kind === "blocked") {
    return (
      <RoomErrorCard
        kind={state.reason}
        action={
          <Link href="/join" className={buttonClass({ variant: "secondary" })}>
            Try again
          </Link>
        }
      />
    );
  }

  const { preview } = state;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold">
          Join room <span className="tracking-widest">{preview.code}</span>
        </h1>
        <p className="text-muted">
          {preview.player_count === 1
            ? "1 player is in the room."
            : `${preview.player_count} players are in the room.`}
          {preview.status !== "lobby" &&
            " A round is in progress: you'll join from the next one."}
        </p>
      </header>
      <RoomSettingsSummary language={preview.language} level={preview.level} />
      <Card>
        <CardTitle as="h2">Who are you?</CardTitle>
        <NameAvatarForm
          submitLabel="Join room"
          loading={joining}
          nameError={nameError}
          onSubmit={(profile) => void join(profile)}
        />
        {joinError && (
          <p role="alert" className="mt-3 text-danger">
            {joinError}
          </p>
        )}
      </Card>
    </div>
  );
}
