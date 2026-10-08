"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { setRoomLocked, type DbClient, type Room } from "@/lib/db";
import {
  MAX_PLAYERS_PER_ROOM,
  inviteLink,
  roomErrorMessage,
} from "@/lib/rooms";
import { InvitePanel } from "./invite-panel";

/**
 * The admin's invite panel for a live room: code, link, QR and the lock
 * switch. Render on the client only (the link uses the page's origin).
 */
export function RoomReadyPanel({
  client,
  room,
  playerCount,
}: {
  client: DbClient;
  room: Room;
  playerCount: number;
}) {
  const toast = useToast();
  // The switch moves at once; the room row confirms it over Realtime.
  const [pendingLock, setPendingLock] = useState<boolean | null>(null);
  if (pendingLock === room.locked) setPendingLock(null);
  const locked = pendingLock ?? room.locked;

  async function changeLock(next: boolean) {
    setPendingLock(next);
    try {
      await setRoomLocked(client, room.id, next);
    } catch (caught) {
      setPendingLock(null);
      toast({ title: roomErrorMessage(caught), variant: "danger" });
    }
  }

  return (
    <InvitePanel
      roomCode={room.code}
      link={inviteLink(window.location.origin, room.code)}
      playerCount={playerCount}
      maxPlayers={MAX_PLAYERS_PER_ROOM}
      locked={locked}
      onLockChange={(next) => void changeLock(next)}
    />
  );
}
