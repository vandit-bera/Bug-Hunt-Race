"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DbClient } from "@/lib/db";
import type { ReactionMessage } from "@/lib/game/reactions";
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
  /** See `RoomConnection.sendReaction`. */
  sendReaction: (message: ReactionMessage) => boolean;
  /**
   * Listens to raw reaction payloads from other clients; returns the
   * unsubscribe function. Stable for the life of the component.
   */
  subscribeReactions: (listener: ReactionListener) => () => void;
}

export type ReactionListener = (payload: unknown) => void;

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
  const reactionListeners = useRef(new Set<ReactionListener>());

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
      onReaction: (payload) => {
        for (const listener of reactionListeners.current) listener(payload);
      },
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

  const sendReaction = useCallback(
    (message: ReactionMessage) =>
      connection.current?.sendReaction(message) ?? false,
    [],
  );
  const subscribeReactions = useCallback((listener: ReactionListener) => {
    const listeners = reactionListeners.current;
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    view,
    closed,
    error,
    status,
    leave: async () => {
      await connection.current?.leave();
    },
    sendReaction,
    subscribeReactions,
  };
}
