import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DbClient, Player, Room } from "@/lib/db";
import {
  HEARTBEAT_INTERVAL_MS,
  connectToRoom,
  type RoomConnectionOptions,
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

  const channel = {
    on: vi.fn((type: string, filter: Record<string, string>, fn: Handler) => {
      handlers.push({ type, filter, fn });
      return channel;
    }),
    subscribe: vi.fn((callback: typeof subscribeCallback) => {
      subscribeCallback = callback;
      return channel;
    }),
    track: vi.fn(async () => "ok"),
    presenceState: () => presence,
  };

  let roomRow: Room = room;
  let playerRows: Player[] = [player("p1", "Ana")];
  let heartbeatResult: { data: unknown; error: { message: string } | null } = {
    data: "lobby",
    error: null,
  };

  const rpc = vi.fn(async () => heartbeatResult);
  const from = vi.fn((table: string) => {
    const result = () =>
      table === "rooms"
        ? { data: roomRow, error: null }
        : { data: playerRows, error: null };
    const builder: Record<string, unknown> = {
      then: (resolve: (value: unknown) => unknown) => resolve(result()),
    };
    for (const method of ["select", "eq", "is", "order", "single"]) {
      builder[method] = () => builder;
    }
    return builder;
  });
  const removeChannel = vi.fn(async () => "ok");
  const channelFactory = vi.fn(() => channel);

  // The fake implements only what connectToRoom uses.
  const client = {
    rpc,
    from,
    channel: channelFactory,
    removeChannel,
  } as unknown as DbClient;

  return {
    client,
    channel,
    channelFactory,
    rpc,
    removeChannel,
    handlers,
    setRoom: (next: Room) => (roomRow = next),
    setPlayers: (next: Player[]) => (playerRows = next),
    setPresence: (next: Record<string, unknown[]>) => (presence = next),
    setHeartbeat: (next: typeof heartbeatResult) => (heartbeatResult = next),
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
  const options: RoomConnectionOptions = {
    roomId: "room-1",
    playerId: "p1",
    onChange: (view) => views.push(view),
    onClosed: vi.fn(),
    onError: vi.fn(),
  };
  const connection = connectToRoom(fake.client, options);
  return { connection, views, options };
}

const heartbeatCalls = (rpc: ReturnType<typeof vi.fn>) =>
  rpc.mock.calls.filter(([name]) => name === "room_heartbeat").length;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("connectToRoom", () => {
  it("listens to its own room only, with the player as presence key, and waits for the changes stream", () => {
    const fake = createFakeRealtime();
    connect(fake);

    expect(fake.channelFactory).toHaveBeenCalledWith("room:room-1", {
      config: {
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
      ["presence", { event: "sync" }],
    ]);
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
