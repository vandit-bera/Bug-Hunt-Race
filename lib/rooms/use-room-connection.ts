"use client";

import { useEffect, useRef, useState } from "react";
import type { DbClient } from "@/lib/db";
import {
  connectToRoom,
  type RoomConnection,
  type RoomConnectionStatus,
  type RoomView,
} from "./connection";

export interface RoomConnectionState {
  view: RoomView | null;
  /** The room closed or the player is no longer in it. */
  closed: boolean;
  error: unknown;
  /** Show `ReconnectingBanner` (components/room) while `reconnecting`. */
  status: RoomConnectionStatus;
  /** Leaves the room for good. */
  leave: () => Promise<void>;
}

/**
 * React wrapper around `connectToRoom`: connects while mounted (and while
 * `roomId`/`playerId` are set) and disconnects on unmount, keeping the seat.
 */
export function useRoomConnection(
  client: DbClient,
  roomId: string | null,
  playerId: string | null,
): RoomConnectionState {
  const [view, setView] = useState<RoomView | null>(null);
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [status, setStatus] = useState<RoomConnectionStatus>("connecting");
  const connection = useRef<RoomConnection | null>(null);

  useEffect(() => {
    if (!roomId || !playerId) return;
    const current = connectToRoom(client, {
      roomId,
      playerId,
      onChange: (next) => {
        setView(next);
        setError(null);
      },
      onClosed: () => setClosed(true),
      onError: setError,
      onStatus: setStatus,
    });
    connection.current = current;
    return () => {
      current.disconnect();
      connection.current = null;
      setView(null);
      setClosed(false);
      setError(null);
      setStatus("connecting");
    };
  }, [client, roomId, playerId]);

  return {
    view,
    closed,
    error,
    status,
    leave: async () => {
      await connection.current?.leave();
    },
  };
}
