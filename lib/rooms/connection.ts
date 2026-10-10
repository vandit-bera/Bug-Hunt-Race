import type { RealtimeChannel } from "@supabase/supabase-js";
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
import type { ReactionMessage } from "@/lib/game/reactions";
import { backoffDelayMs, isUnavailableError } from "./retry";

/**
 * How often a connected client tells the database it is still here. The
 * database marks a player disconnected after 15 s without one, so a single
 * lost heartbeat does not count as a drop.
 */
export const HEARTBEAT_INTERVAL_MS = 5_000;

/** The broadcast event reactions travel on, in the room's channel. */
export const REACTION_EVENT = "reaction";

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
  /**
   * How many times the room and players were reloaded after the channel
   * (re)subscribed: 1 after connecting, +1 after every reconnect. Reload
   * anything else you show about the room (e.g. the current round) when it
   * changes: what happened while this client was offline is not replayed.
   */
  syncCount: number;
}

/**
 * `connecting` until the room is first loaded; `live` while Realtime is
 * subscribed and the database answers; `reconnecting` after either dropped,
 * until both are back. Supabase reconnects the socket with backoff (1 s, 2 s,
 * 5 s, then every 10 s); a channel the server closed is reopened here.
 */
export type RoomConnectionStatus = "connecting" | "live" | "reconnecting";

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
  onStatus?: (status: RoomConnectionStatus) => void;
  /**
   * A reaction broadcast from another client, as received: anyone who knows
   * the room id can send one, so validate it (`parseReactionMessage`).
   */
  onReaction?: (payload: unknown) => void;
}

export interface RoomConnection {
  /** Stops listening and sending heartbeats. The player keeps their seat. */
  disconnect(): void;
  /** Leaves the room for good: frees the seat and hands over the admin role. */
  leave(): Promise<void>;
  /**
   * Broadcasts a reaction to the other clients in the room (not echoed back).
   * False, and nothing sent, while the channel is not live: reactions are
   * not worth queueing for later.
   */
  sendReaction(message: ReactionMessage): boolean;
}

/**
 * Keeps a live view of one room: room row and player list from Supabase
 * Realtime (`postgres_changes`, filtered by RLS to rooms the caller is in),
 * who is online from Realtime presence, reactions over Realtime broadcast
 * (never stored), and a heartbeat to the database every
 * `HEARTBEAT_INTERVAL_MS`. Reloads everything each time the channel
 * (re)subscribes, so changes missed while offline are picked up. The seat
 * is the database's: a player who drops keeps it (and their scores) until
 * they leave, so reconnecting needs no new join.
 */
export function connectToRoom(
  client: DbClient,
  options: RoomConnectionOptions,
): RoomConnection {
  const { roomId, playerId } = options;
  let room: Room | null = null;
  let players: Player[] = [];
  let online: ReadonlySet<string> = new Set();
  let syncCount = 0;
  let stopped = false;
  // What the status is made of: the channel is subscribed and the room
  // reloaded since, and the last database call got an answer.
  let channelLive = false;
  let reachable = true;
  let status: RoomConnectionStatus = "connecting";
  // Backoff for retries this module makes itself (reload, channel reopen).
  let reloadAttempts = 0;
  let reopenAttempts = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  // One player-list query at a time. A change that arrives while one runs
  // asks for one more query after it, so every change is followed by a read
  // that started after it and answers apply in order. A burst of changes
  // (30 players joining at once) costs two queries, not one per change.
  let playersLoading = false;
  let playersStale = false;

  function emit() {
    if (!stopped && room) {
      options.onChange({ room, players, online, syncCount });
    }
  }

  function updateStatus() {
    if (stopped) return;
    const next: RoomConnectionStatus =
      channelLive && reachable
        ? "live"
        : status === "connecting"
          ? "connecting"
          : "reconnecting";
    if (next === status) return;
    status = next;
    options.onStatus?.(status);
  }

  function setReachable(next: boolean) {
    reachable = next;
    updateStatus();
  }

  function retryLater(action: () => void, attempt: number) {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(action, backoffDelayMs(attempt));
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    clearTimeout(retryTimer);
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
    else {
      if (isUnavailableError(error)) setReachable(false);
      options.onError?.(error);
    }
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

  /** Reloads everything after the channel (re)subscribed. */
  async function reload(from: RealtimeChannel) {
    try {
      const [nextRoom] = await Promise.all([
        getRoom(client, roomId),
        refreshPlayers(),
      ]);
      if (stopped || from !== channel) return;
      reloadAttempts = 0;
      syncCount++;
      channelLive = true;
      setReachable(true);
      setRoom(nextRoom);
    } catch (error) {
      fail(error);
      // The channel is up but the database is not (yet): try again, or the
      // view would stay stale until the next reconnect.
      if (isUnavailableError(error) && from === channel) {
        retryLater(() => {
          if (!stopped && from === channel) void reload(from);
        }, reloadAttempts++);
      }
    }
  }

  async function heartbeat() {
    try {
      const roomStatus = await sendHeartbeat(client, roomId);
      setReachable(true);
      if (roomStatus === "closed") close();
    } catch (error) {
      fail(error);
    }
  }

  /**
   * A channel the server closed (or that Supabase unsubscribed after an
   * error) is never rejoined by supabase-js: open a new one, with backoff.
   */
  function reopen() {
    retryLater(() => {
      if (stopped) return;
      void client.removeChannel(channel);
      channel = openChannel();
    }, reopenAttempts++);
  }

  function openChannel(): RealtimeChannel {
    const opened: RealtimeChannel = client
      .channel(`room:${roomId}`, {
        config: {
          // Only players still in the room may join (Realtime policies in
          // 20261009000008_db_hardening.sql), so nobody outside the room can
          // show a player as online.
          private: true,
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
      .on("broadcast", { event: REACTION_EVENT }, ({ payload }) => {
        if (!stopped) options.onReaction?.(payload);
      })
      .on("presence", { event: "sync" }, () => {
        online = new Set(Object.keys(opened.presenceState()));
        emit();
      });
    const subscribe = () =>
      opened.subscribe((state, error) => {
        if (stopped || opened !== channel) return;
        if (state === "SUBSCRIBED") {
          reopenAttempts = 0;
          void opened.track({ player_id: playerId });
          void reload(opened);
          return;
        }
        channelLive = false;
        updateStatus();
        if (state === "CLOSED") reopen();
        else options.onError?.(error ?? new Error(`Realtime: ${state}`));
      });
    // The private channel join is authorized with the player's token. On a
    // fresh page supabase-js hands it to Realtime asynchronously, and a join
    // sent before that carries only the anon key and is refused.
    if (client.realtime.accessTokenValue) {
      subscribe();
    } else {
      void client.realtime.setAuth().then(() => {
        if (!stopped && opened === channel) subscribe();
      });
    }
    return opened;
  }

  let channel = openChannel();
  const timer = setInterval(() => void heartbeat(), HEARTBEAT_INTERVAL_MS);
  void heartbeat();

  return {
    disconnect: stop,
    async leave() {
      stop();
      await leaveRoom(client, roomId);
    },
    sendReaction(message) {
      if (stopped || !channelLive) return false;
      void channel.send({
        type: "broadcast",
        event: REACTION_EVENT,
        payload: message,
      });
      return true;
    },
  };
}
