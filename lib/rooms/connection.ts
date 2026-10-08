import {
  DbError,
  getRoom,
  leaveRoom,
  listPlayers,
  sendHeartbeat,
  type DbClient,
  type Player,
  type Room,
} from "@/lib/db";

/**
 * How often a connected client tells the database it is still here. The
 * database marks a player disconnected after 15 s without one, so a single
 * lost heartbeat does not count as a drop.
 */
export const HEARTBEAT_INTERVAL_MS = 5_000;

export interface RoomView {
  room: Room;
  /** Players still in the room, in join order. */
  players: Player[];
  /**
   * Ids of players with an open Realtime connection right now (presence).
   * Updates within about a second; `Player.connected` is the database's
   * slower, authoritative view (15 s), which drives admin hand-over.
   */
  online: ReadonlySet<string>;
}

export interface RoomConnectionOptions {
  roomId: string;
  /** The caller's own player in the room. */
  playerId: string;
  onChange: (view: RoomView) => void;
  /**
   * The room closed, or the caller is no longer in it. The connection has
   * already stopped.
   */
  onClosed: () => void;
  onError?: (error: unknown) => void;
}

export interface RoomConnection {
  /** Stops listening and sending heartbeats. The player keeps their seat. */
  disconnect(): void;
  /** Leaves the room for good: frees the seat and hands over the admin role. */
  leave(): Promise<void>;
}

/**
 * Keeps a live view of one room: room row and player list from Supabase
 * Realtime (`postgres_changes`, filtered by RLS to rooms the caller is in),
 * who is online from Realtime presence, and a heartbeat to the database every
 * `HEARTBEAT_INTERVAL_MS`. Reloads everything each time the channel
 * (re)subscribes, so changes missed while offline are picked up.
 */
export function connectToRoom(
  client: DbClient,
  options: RoomConnectionOptions,
): RoomConnection {
  const { roomId, playerId } = options;
  let room: Room | null = null;
  let players: Player[] = [];
  let online: ReadonlySet<string> = new Set();
  let stopped = false;
  // One player-list query at a time. A change that arrives while one runs
  // asks for one more query after it, so every change is followed by a read
  // that started after it and answers apply in order. A burst of changes
  // (30 players joining at once) costs two queries, not one per change.
  let playersLoading = false;
  let playersStale = false;

  function emit() {
    if (!stopped && room) options.onChange({ room, players, online });
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    void client.removeChannel(channel);
  }

  function close() {
    if (stopped) return;
    stop();
    options.onClosed();
  }

  function fail(error: unknown) {
    if (stopped) return;
    if (error instanceof DbError && error.code === "room_not_found") close();
    else options.onError?.(error);
  }

  function setRoom(next: Room) {
    room = next;
    if (next.status === "closed") close();
    else emit();
  }

  async function refreshPlayers() {
    if (playersLoading) {
      playersStale = true;
      return;
    }
    playersLoading = true;
    try {
      do {
        playersStale = false;
        players = await listPlayers(client, roomId);
        emit();
      } while (playersStale && !stopped);
    } catch (error) {
      fail(error);
    } finally {
      playersLoading = false;
    }
  }

  async function reload() {
    try {
      const [nextRoom] = await Promise.all([
        getRoom(client, roomId),
        refreshPlayers(),
      ]);
      setRoom(nextRoom);
    } catch (error) {
      fail(error);
    }
  }

  async function heartbeat() {
    try {
      if ((await sendHeartbeat(client, roomId)) === "closed") close();
    } catch (error) {
      fail(error);
    }
  }

  const channel = client
    .channel(`room:${roomId}`, {
      config: {
        presence: { key: playerId },
        // Report SUBSCRIBED only once the database changes stream is live.
        // Without it, a change between the channel join and the stream
        // starting is in neither the reload below nor the stream, e.g. a
        // player who joins then never shows up for the others.
        postgres_changes_options: { wait: true },
      },
    })
    .on<Room>(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "rooms",
        filter: `id=eq.${roomId}`,
      },
      (payload) => setRoom(payload.new),
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "players",
        filter: `room_id=eq.${roomId}`,
      },
      () => void refreshPlayers(),
    )
    .on("presence", { event: "sync" }, () => {
      online = new Set(Object.keys(channel.presenceState()));
      emit();
    })
    .subscribe((status, error) => {
      if (stopped) return;
      if (status === "SUBSCRIBED") {
        void channel.track({ player_id: playerId });
        void reload();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        options.onError?.(error ?? new Error(`Realtime: ${status}`));
      }
    });

  const timer = setInterval(() => void heartbeat(), HEARTBEAT_INTERVAL_MS);
  void heartbeat();

  return {
    disconnect: stop,
    async leave() {
      stop();
      await leaveRoom(client, roomId);
    },
  };
}
