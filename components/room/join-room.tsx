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
  type DbErrorCode,
  type RoomPreview,
} from "@/lib/db";
import { normalizeRoomCode } from "@/lib/game/room-code";
import { getBrowserDbClient, roomErrorMessage, roomHref } from "@/lib/rooms";
import { NameAvatarForm } from "./name-avatar-form";
import type { PlayerProfile } from "./name-avatar";
import { RoomErrorCard, type RoomErrorKind } from "./room-error-card";
import { describeRoomSettings } from "./room-settings";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "blocked"; reason: RoomErrorKind }
  | { status: "ready"; preview: RoomPreview };

const BLOCKING_ERRORS: Partial<Record<DbErrorCode, RoomErrorKind>> = {
  room_not_found: "not-found",
  room_closed: "closed",
  room_locked: "locked",
  room_full: "full",
};

const RATE_LIMITED = "Too many tries right now. Please try again shortly.";

function previewBlock(preview: RoomPreview | null): RoomErrorKind | null {
  if (!preview) return "not-found";
  if (preview.status === "closed") return "closed";
  if (preview.locked) return "locked";
  if (preview.is_full) return "full";
  return null;
}

/**
 * `/join/<code>`, where typed codes, invite links and QR scans all land:
 * checks the room, asks for a name and avatar, joins, and opens the lobby.
 * A player who already has a seat goes straight back to the lobby.
 */
export function JoinRoom() {
  const code = normalizeRoomCode(useParams<{ code: string }>().code);
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [joining, setJoining] = useState(false);
  const [nameError, setNameError] = useState<string>();
  const [joinError, setJoinError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const client = getBrowserDbClient();
        const userId = await getSignedInUserId(client);
        if (userId && (await findMyMembership(client, code, userId))) {
          if (!cancelled) router.replace(roomHref(code));
          return;
        }
        const preview = await findRoomByCode(client, code);
        if (cancelled) return;
        const reason = previewBlock(preview);
        setState(
          preview && !reason
            ? { status: "ready", preview }
            : { status: "blocked", reason: reason ?? "not-found" },
        );
      } catch (caught) {
        if (!cancelled) {
          setState({ status: "error", message: roomErrorMessage(caught) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, router, attempt]);

  async function join(profile: PlayerProfile) {
    setJoining(true);
    setNameError(undefined);
    setJoinError(undefined);
    try {
      const client = getBrowserDbClient();
      await ensureSignedIn(client);
      await joinRoom(client, {
        code,
        displayName: profile.name,
        avatar: profile.avatar,
      });
      // Stays busy until the lobby replaces this screen.
      router.replace(roomHref(code));
    } catch (caught) {
      setJoining(false);
      const errorCode = caught instanceof DbError ? caught.code : "unknown";
      const reason = BLOCKING_ERRORS[errorCode];
      if (reason) {
        setState({ status: "blocked", reason });
      } else if (errorCode === "invalid_display_name") {
        setNameError(roomErrorMessage(caught));
      } else if (errorCode === "rate_limited") {
        setJoinError(RATE_LIMITED);
      } else {
        setJoinError(roomErrorMessage(caught));
      }
    }
  }

  switch (state.status) {
    case "loading":
      return (
        <Spinner
          size="lg"
          label={`Finding room ${code}`}
          className="self-center"
        />
      );
    case "error":
      return (
        <RoomErrorCard
          kind="disconnected"
          action={
            <Button
              onClick={() => {
                setState({ status: "loading" });
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </Button>
          }
        />
      );
    case "blocked":
      return (
        <RoomErrorCard
          kind={state.reason}
          action={
            <Link href="/join" className={buttonClass()}>
              Try again
            </Link>
          }
        />
      );
  }

  const { preview } = state;
  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="font-display text-2xl font-bold tracking-widest">
          {preview.code}
        </p>
        <p data-testid="room-settings" className="text-muted">
          {describeRoomSettings(preview)} ·{" "}
          {preview.player_count === 1
            ? "1 player"
            : `${preview.player_count} players`}
        </p>
        {preview.status !== "lobby" && (
          <p role="status" className="font-bold text-warning">
            A round is in progress: you&apos;ll play from the next one.
          </p>
        )}
      </div>
      <Card>
        <CardTitle as="h2">Who are you?</CardTitle>
        <NameAvatarForm
          submitLabel="Join room"
          loading={joining}
          onSubmit={(profile) => void join(profile)}
          nameError={nameError}
          onNameChange={() => setNameError(undefined)}
        />
        {joinError && (
          <p role="alert" className="mt-4 font-bold text-danger">
            {joinError}
          </p>
        )}
      </Card>
    </>
  );
}
