import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DbClient, Player, Room } from "@/lib/db";
import {
  HEARTBEAT_INTERVAL_MS,
  connectToRoom,
  type RoomConnectionOptions,
  type RoomConnectionStatus,
  type RoomView,
} from "./connection";

const room: Room = {
  id: "room-1",
  code: "BUG7KX",
  admin_player_id: "p1",
  status: "lobby",
  language: "javascript",
  level: "easy",
  total_rounds: 3,
  locked: false,
  current_round: 0,
  game_number: 1,
  created_at: "2026-10-08T00:00:00Z",
  updated_at: "2026-10-08T00:00:00Z",
  closed_at: null,
};

function player(id: string, name: string): Player {
  return {
    id,
    room_id: "room-1",
    user_id: `user-${id}`,
    display_name: name,
    avatar: "🦊",
    is_admin: id === "p1",
    connected: true,
    joined_at: "2026-10-08T00:00:00Z",
    left_at: null,
  };
}

type Handler = (payload: unknown) => void;

/** Records what connectToRoom registers and lets the test fire events. */
function createFakeRealtime() {
  const handlers: {
    type: string;
    filter: Record<string, string>;
    fn: Handler;
  }[] = [];
  let subscribeCallback: (status: string, error?: Error) => void = () => {};
  let presence: Record<string, unknown[]> = {};

  interface FakeChannel {
    on: (type: string, filter: Record<string, string>, fn: Handler) => unknown;
    subscribe: (callback: typeof subscribeCallback) => unknown;
    track: () => Promise<string>;
    send: (message: unknown) => Promise<string>;
    presenceState: () => Record<string, unknown[]>;
  }

  // Every `client.channel()` call opens a new channel; `channel` is the
  // first, `channels` all of them. `subscribe()` fires on the latest.
  function makeChannel(): FakeChannel {
    const opened: FakeChannel = {
      on: vi.fn((type: string, filter: Record<string, string>, fn: Handler) => {
        handlers.push({ type, filter, fn });
        return opened;
      }),
      subscribe: vi.fn((callback: typeof subscribeCallback) => {
        subscribeCallback = callback;
        return opened;
      }),
      track: vi.fn(async () => "ok"),
      send: vi.fn(async () => "ok"),
      presenceState: () => presence,
    };
    channels.push(opened);
    return opened;
  }
  const channels: FakeChannel[] = [];

  let roomRow: Room = room;
  let playerRows: Player[] = [player("p1", "Ana")];
  let heartbeatResult: { data: unknown; error: { message: string } | null } = {
    data: "lobby",
    error: null,
  };

  // While set, player-list queries wait here until the test releases them.
  let heldPlayerQueries: (() => void)[] | null = null;

  // Set to make room and player queries fail as if Supabase were down.
  let queryError: { message: string; code?: string } | null = null;

  const rpc = vi.fn(async () => heartbeatResult);
  const from = vi.fn((table: string) => {
    const result = () =>
      queryError
        ? { data: null, error: queryError }
        : table === "rooms"
          ? { data: roomRow, error: null }
          : { data: playerRows, error: null };
    const builder: Record<string, unknown> = {
      then: (resolve: (value: unknown) => unknown) => {
        if (table === "players" && heldPlayerQueries) {
          heldPlayerQueries.push(() => resolve(result()));
        } else {
          resolve(result());
        }
      },
    };
    for (const method of ["select", "eq", "is", "order", "single"]) {
      builder[method] = () => builder;
    }
    return builder;
  });
  const removeChannel = vi.fn(async () => "ok");
  const channelFactory = vi.fn(makeChannel);

  // Realtime already has the player's token unless a test clears it.
  const realtime = {
    accessTokenValue: "player-token" as string | null,
    setAuth: vi.fn(async () => {
      realtime.accessTokenValue = "player-token";
    }),
  };

  // The fake implements only what connectToRoom uses.
  const client = {
    rpc,
    from,
    channel: channelFactory,
    removeChannel,
    realtime,
  } as unknown as DbClient;

  return {
    client,
    get channel() {
      return channels[0]!;
    },
    channels,
    channelFactory,
    realtime,
    rpc,
    from,
    removeChannel,
    handlers,
    /** Holds player-list queries; `release()` answers the oldest one. */
    holdPlayerQueries: () => {
      heldPlayerQueries = [];
      return {
        release: () => heldPlayerQueries?.shift()?.(),
        pending: () => heldPlayerQueries?.length ?? 0,
      };
    },
    setRoom: (next: Room) => (roomRow = next),
    setPlayers: (next: Player[]) => (playerRows = next),
    setPresence: (next: Record<string, unknown[]>) => (presence = next),
    setHeartbeat: (next: typeof heartbeatResult) => (heartbeatResult = next),
    setQueryError: (next: typeof queryError) => (queryError = next),
    subscribe: (status: string, error?: Error) =>
      subscribeCallback(status, error),
    fire: (type: string, table: string | null, payload: unknown = {}) => {
      for (const h of handlers) {
        if (h.type === type && (table === null || h.filter.table === table)) {
          h.fn(payload);
        }
      }
    },
  };
}

function connect(fake: ReturnType<typeof createFakeRealtime>) {
  const views: RoomView[] = [];
  const statuses: RoomConnectionStatus[] = [];
  const options: RoomConnectionOptions = {
    roomId: "room-1",
    playerId: "p1",
    onChange: (view) => views.push(view),
    onClosed: vi.fn(),
    onError: vi.fn(),
    onStatus: (status) => statuses.push(status),
  };
  const connection = connectToRoom(fake.client, options);
  return { connection, views, options, statuses };
}

const offline = { message: "TypeError: Failed to fetch", code: "" };

const heartbeatCalls = (rpc: ReturnType<typeof vi.fn>) =>
  rpc.mock.calls.filter(([name]) => name === "room_heartbeat").length;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("connectToRoom", () => {
  it("listens to its own room only, on a private channel, with the player as presence key, and waits for the changes stream", () => {
    const fake = createFakeRealtime();
    connect(fake);

    expect(fake.channelFactory).toHaveBeenCalledWith("room:room-1", {
      config: {
        private: true,
        presence: { key: "p1" },
        postgres_changes_options: { wait: true },
      },
    });
    expect(fake.handlers.map((h) => [h.type, h.filter])).toEqual([
      [
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: "id=eq.room-1",
        },
      ],
      [
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: "room_id=eq.room-1",
        },
      ],
      ["broadcast", { event: "reaction" }],
      ["presence", { event: "sync" }],
    ]);
  });

  it("waits for the player's token before joining the private channel", async () => {
    const fake = createFakeRealtime();
    fake.realtime.accessTokenValue = null;
    const { views } = connect(fake);

    expect(fake.realtime.setAuth).toHaveBeenCalledOnce();
    expect(fake.channel.subscribe).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(fake.channel.subscribe).toHaveBeenCalledOnce(),
    );

    fake.subscribe("SUBSCRIBED");
    await vi.waitFor(() => expect(views).toHaveLength(1));
  });

  it("reports a failed token refresh instead of joining", async () => {
    const fake = createFakeRealtime();
    fake.realtime.accessTokenValue = null;
    const failure = new Error("session lookup failed");
    fake.realtime.setAuth.mockRejectedValueOnce(failure);
    const { options } = connect(fake);

    await vi.waitFor(() =>
      expect(options.onError).toHaveBeenCalledWith(failure),
    );
    expect(fake.channel.subscribe).not.toHaveBeenCalled();
  });

  it("does not join after disconnect while waiting for the token", async () => {
    const fake = createFakeRealtime();
    fake.realtime.accessTokenValue = null;
    const { connection } = connect(fake);

    connection.disconnect();
    await vi.advanceTimersByTimeAsync(0);

    expect(fake.channel.subscribe).not.toHaveBeenCalled();
  });

  it("loads the room and players once subscribed, and tracks presence", async () => {
    const fake = createFakeRealtime();
    const { views } = connect(fake);

    expect(views).toEqual([]);
    fake.subscribe("SUBSCRIBED");
    await vi.waitFor(() => expect(views).toHaveLength(1));

    expect(fake.channel.track).toHaveBeenCalledWith({ player_id: "p1" });
    expect(views[0]).toMatchObject({
      room,
      players: [{ display_name: "Ana" }],
    });
  });

  it("sends a heartbeat now and every interval", async () => {
    const fake = createFakeRealtime();
    connect(fake);

    expect(heartbeatCalls(fake.rpc)).toBe(1);
    expect(fake.rpc).toHaveBeenCalledWith("room_heartbeat", {
      target_room_id: "room-1",
    });
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 3);
    expect(heartbeatCalls(fake.rpc)).toBe(4);
  });

  it("reloads the player list when players change", async () => {
    const fake = createFakeRealtime();
    const { views } = connect(fake);
    fake.subscribe("SUBSCRIBED");
    await vi.waitFor(() => expect(views).toHaveLength(1));

    fake.setPlayers([player("p1", "Ana"), player("p2", "Ben")]);
    fake.fire("postgres_changes", "players");
    await vi.waitFor(() => expect(views).toHaveLength(2));

    expect(views[1]!.players.map((p) => p.display_name)).toEqual([
      "Ana",
      "Ben",
    ]);
  });

  it("keeps the player list moving during a burst of changes, one query at a time", async () => {
    const fake = createFakeRealtime();
    const { views } = connect(fake);
    fake.subscribe("SUBSCRIBED");
    await vi.waitFor(() => expect(views).toHaveLength(1));
    const queries = fake.holdPlayerQueries();
    const playerQueries = () =>
      fake.from.mock.calls.filter(([table]) => table === "players").length;
    const before = playerQueries();

    // Three joins land while the first reload is still running.
    fake.setPlayers([player("p1", "Ana"), player("p2", "Ben")]);
    fake.fire("postgres_changes", "players");
    fake.setPlayers([
      player("p1", "Ana"),
      player("p2", "Ben"),
      player("p3", "Cleo"),
    ]);
    fake.fire("postgres_changes", "players");
    fake.fire("postgres_changes", "players");
    expect(playerQueries() - before).toBe(1);

    // The first answer is shown, not dropped as stale (TB-52: with 30
    // players joining at once, every answer was dropped until the burst
    // ended), and one more query covers the changes since it started.
    await vi.waitFor(() => expect(queries.pending()).toBe(1));
    queries.release();
    await vi.waitFor(() => expect(views).toHaveLength(2));
    expect(playerQueries() - before).toBe(2);

    await vi.waitFor(() => expect(queries.pending()).toBe(1));
    queries.release();
    await vi.waitFor(() => expect(views).toHaveLength(3));
    expect(views[2]!.players.map((p) => p.display_name)).toEqual([
      "Ana",
      "Ben",
      "Cleo",
    ]);
    expect(playerQueries() - before).toBe(2);
    expect(queries.pending()).toBe(0);
  });

  it("applies room updates from the change payload", async () => {
    const fake = createFakeRealtime();
    const { views } = connect(fake);
    fake.subscribe("SUBSCRIBED");
    await vi.waitFor(() => expect(views).toHaveLength(1));

    fake.fire("postgres_changes", "rooms", {
      new: { ...room, status: "countdown", current_round: 1 },
    });

    expect(views[1]!.room).toMatchObject({
      status: "countdown",
      current_round: 1,
    });
  });

  it("reports who is online from presence", async () => {
    const fake = createFakeRealtime();
    const { views } = connect(fake);
    fake.subscribe("SUBSCRIBED");
    await vi.waitFor(() => expect(views).toHaveLength(1));

    fake.setPresence({ p1: [{}], p2: [{}] });
    fake.fire("presence", null);

    expect([...views[1]!.online]).toEqual(["p1", "p2"]);
  });

  it("stops and reports when the room closes", async () => {
    const fake = createFakeRealtime();
    const { views, options } = connect(fake);
    fake.subscribe("SUBSCRIBED");
    await vi.waitFor(() => expect(views).toHaveLength(1));

    fake.fire("postgres_changes", "rooms", {
      new: { ...room, status: "closed" },
    });

    expect(options.onClosed).toHaveBeenCalledOnce();
    expect(fake.removeChannel).toHaveBeenCalledWith(fake.channel);
    expect(views).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 2);
    expect(heartbeatCalls(fake.rpc)).toBe(1);
  });

  it("stops when a heartbeat finds the room closed (auto-close)", async () => {
    const fake = createFakeRealtime();
    fake.setHeartbeat({ data: "closed", error: null });
    const { options } = connect(fake);

    await vi.waitFor(() => expect(options.onClosed).toHaveBeenCalledOnce());
    expect(fake.removeChannel).toHaveBeenCalled();
  });

  it("stops when the player is no longer in the room", async () => {
    const fake = createFakeRealtime();
    fake.setHeartbeat({ data: null, error: { message: "room_not_found" } });
    const { options } = connect(fake);

    await vi.waitFor(() => expect(options.onClosed).toHaveBeenCalledOnce());
    expect(options.onError).not.toHaveBeenCalled();
  });

  it("reports other errors and keeps going", async () => {
    const fake = createFakeRealtime();
    fake.setHeartbeat({ data: null, error: { message: "network down" } });
    const { options } = connect(fake);

    await vi.waitFor(() => expect(options.onError).toHaveBeenCalledOnce());
    fake.setHeartbeat({ data: "lobby", error: null });
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    expect(heartbeatCalls(fake.rpc)).toBe(2);
    expect(options.onClosed).not.toHaveBeenCalled();
  });

  it("reports Realtime channel errors", () => {
    const fake = createFakeRealtime();
    const { options } = connect(fake);

    fake.subscribe("CHANNEL_ERROR", new Error("denied"));
    expect(options.onError).toHaveBeenCalledWith(new Error("denied"));
  });

  it("disconnect stops everything but keeps the seat", async () => {
    const fake = createFakeRealtime();
    const { connection } = connect(fake);

    connection.disconnect();
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 2);

    expect(heartbeatCalls(fake.rpc)).toBe(1);
    expect(fake.removeChannel).toHaveBeenCalledOnce();
    expect(fake.rpc).not.toHaveBeenCalledWith("leave_room", expect.anything());
  });

  it("passes reaction broadcasts on as received", async () => {
    const fake = createFakeRealtime();
    const onReaction = vi.fn();
    connectToRoom(fake.client, {
      roomId: "room-1",
      playerId: "p1",
      onChange: () => {},
      onClosed: () => {},
      onReaction,
    });

    fake.fire("broadcast", null, {
      type: "broadcast",
      event: "reaction",
      payload: { sender: "p2", emojis: ["🔥"] },
    });

    expect(onReaction).toHaveBeenCalledWith({ sender: "p2", emojis: ["🔥"] });
  });

  it("broadcasts reactions only while live", async () => {
    const fake = createFakeRealtime();
    const { connection, views } = connect(fake);
    const message = { sender: "p1", emojis: ["🔥" as const] };

    expect(connection.sendReaction(message)).toBe(false);
    fake.subscribe("SUBSCRIBED");
    await vi.waitFor(() => expect(views).toHaveLength(1));

    expect(connection.sendReaction(message)).toBe(true);
    expect(fake.channel.send).toHaveBeenCalledWith({
      type: "broadcast",
      event: "reaction",
      payload: message,
    });

    connection.disconnect();
    expect(connection.sendReaction(message)).toBe(false);
    expect(fake.channel.send).toHaveBeenCalledOnce();
  });

  it("leave stops and leaves the room", async () => {
    const fake = createFakeRealtime();
    const { connection } = connect(fake);

    await connection.leave();

    expect(fake.removeChannel).toHaveBeenCalledOnce();
    expect(fake.rpc).toHaveBeenCalledWith("leave_room", {
      target_room_id: "room-1",
    });
  });
});

describe("connectToRoom reconnects", () => {
  it("goes live once loaded, reconnecting on a drop, and reloads on return", async () => {
    const fake = createFakeRealtime();
    const { views, statuses } = connect(fake);
    fake.subscribe("SUBSCRIBED");
    await vi.waitFor(() => expect(statuses).toEqual(["live"]));
    expect(views.at(-1)!.syncCount).toBe(1);

    // The socket drops; Supabase rejoins the channel by itself.
    fake.subscribe("CHANNEL_ERROR", new Error("socket closed"));
    expect(statuses).toEqual(["live", "reconnecting"]);

    // Missed while offline: the round started.
    fake.setRoom({ ...room, status: "round_live", current_round: 1 });
    fake.subscribe("SUBSCRIBED");
    await vi.waitFor(() =>
      expect(statuses).toEqual(["live", "reconnecting", "live"]),
    );
    expect(views.at(-1)).toMatchObject({
      room: { status: "round_live" },
      syncCount: 2,
    });
  });

  it("is reconnecting while the database cannot be reached", async () => {
    const fake = createFakeRealtime();
    const { statuses } = connect(fake);
    fake.subscribe("SUBSCRIBED");
    await vi.waitFor(() => expect(statuses).toEqual(["live"]));

    fake.setHeartbeat({ data: null, error: offline });
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    expect(statuses).toEqual(["live", "reconnecting"]);

    fake.setHeartbeat({ data: "lobby", error: null });
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    expect(statuses).toEqual(["live", "reconnecting", "live"]);
  });

  it("stays connecting until the first load, whatever fails", async () => {
    const fake = createFakeRealtime();
    fake.setHeartbeat({ data: null, error: offline });
    const { statuses, options } = connect(fake);

    await vi.waitFor(() => expect(options.onError).toHaveBeenCalled());
    fake.subscribe("CHANNEL_ERROR", new Error("socket closed"));
    expect(statuses).toEqual([]);
  });

  it("retries the reload with backoff while the database is down", async () => {
    const fake = createFakeRealtime();
    fake.setQueryError(offline);
    const { views, statuses } = connect(fake);
    fake.subscribe("SUBSCRIBED");
    await vi.advanceTimersByTimeAsync(0);
    expect(views).toEqual([]);

    fake.setQueryError(null);
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(views).not.toEqual([]));
    expect(views.at(-1)!.syncCount).toBe(1);
    expect(statuses).toEqual(["live"]);
  });

  it("opens a new channel, with backoff, when the server closes it", async () => {
    const fake = createFakeRealtime();
    const { views, statuses } = connect(fake);
    fake.subscribe("SUBSCRIBED");
    await vi.waitFor(() => expect(statuses).toEqual(["live"]));

    fake.subscribe("CLOSED");
    expect(statuses).toEqual(["live", "reconnecting"]);
    expect(fake.channels).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(fake.channels).toHaveLength(2);
    expect(fake.removeChannel).toHaveBeenCalledWith(fake.channels[0]);

    fake.subscribe("SUBSCRIBED");
    await vi.waitFor(() =>
      expect(statuses).toEqual(["live", "reconnecting", "live"]),
    );
    expect(fake.channels[1]!.track).toHaveBeenCalledWith({ player_id: "p1" });
    expect(views.at(-1)!.syncCount).toBe(2);
  });

  it("does not reopen after disconnect", async () => {
    const fake = createFakeRealtime();
    const { connection } = connect(fake);
    fake.subscribe("SUBSCRIBED");

    connection.disconnect();
    fake.subscribe("CLOSED");
    await vi.advanceTimersByTimeAsync(30_000);

    expect(fake.channels).toHaveLength(1);
  });
});
