import { describe, expect, it } from "vitest";
import {
  DbError,
  advanceRoom,
  createRoom,
  findMyMembership,
  findRoomByCode,
  getRoom,
  joinRoom,
  leaveRoom,
  listPlayers,
  sendHeartbeat,
  setRoomLocked,
} from "@/lib/db";
import type { Player, Room } from "@/lib/db";
import { createFakeClient } from "./test-utils";

const room: Room = {
  id: "room-1",
  code: "BUG7KX",
  admin_player_id: "player-1",
  status: "lobby",
  language: "typescript",
  level: "mixed",
  total_rounds: null,
  locked: false,
  current_round: 0,
  created_at: "2026-10-08T00:00:00Z",
  updated_at: "2026-10-08T00:00:00Z",
  closed_at: null,
};

const player: Player = {
  id: "player-1",
  room_id: "room-1",
  user_id: "user-1",
  display_name: "Riya",
  avatar: "🦊",
  is_admin: true,
  connected: true,
  joined_at: "2026-10-08T00:00:00Z",
  left_at: null,
};

describe("createRoom", () => {
  it("calls create_room and returns the room with the admin player", async () => {
    const fake = createFakeClient({
      rpc: [{ data: player, error: null }],
      from: [{ data: room, error: null }],
    });

    const result = await createRoom(fake.client, {
      language: "typescript",
      level: "mixed",
      totalRounds: null,
      displayName: "Riya",
      avatar: "🦊",
    });

    expect(result).toEqual({ room, player });
    expect(fake.rpc).toHaveBeenCalledWith("create_room", {
      room_language: "typescript",
      room_level: "mixed",
      display_name: "Riya",
      avatar: "🦊",
      room_total_rounds: undefined,
    });
    expect(fake.queries[0]).toEqual({
      table: "rooms",
      calls: [
        ["select", []],
        ["eq", ["id", "room-1"]],
        ["single", []],
      ],
    });
  });

  it("passes a fixed number of rounds", async () => {
    const fake = createFakeClient({
      rpc: [{ data: player, error: null }],
      from: [{ data: room, error: null }],
    });

    await createRoom(fake.client, {
      language: "python",
      level: "easy",
      totalRounds: 5,
      displayName: "Riya",
      avatar: "🦊",
    });

    expect(fake.rpc).toHaveBeenCalledWith(
      "create_room",
      expect.objectContaining({ room_total_rounds: 5 }),
    );
  });

  it("turns database error codes into typed errors", async () => {
    const fake = createFakeClient({
      rpc: [{ data: null, error: { message: "invalid_display_name" } }],
    });

    const promise = createRoom(fake.client, {
      language: "javascript",
      level: "easy",
      totalRounds: 3,
      displayName: " ",
      avatar: "🦊",
    });

    await expect(promise).rejects.toBeInstanceOf(DbError);
    await expect(promise).rejects.toMatchObject({
      code: "invalid_display_name",
    });
  });
});

describe("findRoomByCode", () => {
  const preview = {
    code: "BUG7KX",
    status: "lobby" as const,
    locked: false,
    is_full: false,
    language: "javascript" as const,
    level: "easy" as const,
    player_count: 3,
  };

  it("normalizes the code and returns the preview", async () => {
    const fake = createFakeClient({ rpc: [{ data: [preview], error: null }] });

    await expect(findRoomByCode(fake.client, " bug-7kx ")).resolves.toEqual(
      preview,
    );
    expect(fake.rpc).toHaveBeenCalledWith("find_open_room", {
      room_code: "BUG7KX",
    });
  });

  it("returns null when no open room has the code", async () => {
    const fake = createFakeClient({ rpc: [{ data: [], error: null }] });

    await expect(findRoomByCode(fake.client, "BUG7KX")).resolves.toBeNull();
  });

  it("returns null for malformed codes without calling the database", async () => {
    const fake = createFakeClient({});

    await expect(findRoomByCode(fake.client, "BUG0KX")).resolves.toBeNull();
    await expect(findRoomByCode(fake.client, "BUG7")).resolves.toBeNull();
    expect(fake.rpc).not.toHaveBeenCalled();
  });
});

describe("joinRoom", () => {
  it("joins with the normalized code and returns the room and player", async () => {
    const joined = {
      ...player,
      id: "player-2",
      display_name: "Riya (2)",
      is_admin: false,
    };
    const fake = createFakeClient({
      rpc: [{ data: joined, error: null }],
      from: [{ data: room, error: null }],
    });

    const result = await joinRoom(fake.client, {
      code: "bug7kx",
      displayName: "Riya",
      avatar: "🐼",
    });

    expect(result).toEqual({ room, player: joined });
    expect(fake.rpc).toHaveBeenCalledWith("join_room", {
      room_code: "BUG7KX",
      display_name: "Riya",
      avatar: "🐼",
    });
  });

  it.each(["room_not_found", "room_locked", "room_full"] as const)(
    "maps %s to a typed error",
    async (code) => {
      const fake = createFakeClient({
        rpc: [{ data: null, error: { message: code } }],
      });

      await expect(
        joinRoom(fake.client, {
          code: "BUG7KX",
          displayName: "Riya",
          avatar: "🐼",
        }),
      ).rejects.toMatchObject({ name: "DbError", code });
    },
  );

  it("rejects malformed codes as room_not_found without calling the database", async () => {
    const fake = createFakeClient({});

    await expect(
      joinRoom(fake.client, {
        code: "OOPS",
        displayName: "Riya",
        avatar: "🐼",
      }),
    ).rejects.toMatchObject({ code: "room_not_found" });
    expect(fake.rpc).not.toHaveBeenCalled();
  });
});

describe("findMyMembership", () => {
  it("finds the caller's seat in the open room with that code", async () => {
    const fake = createFakeClient({
      from: [
        { data: room, error: null },
        { data: player, error: null },
      ],
    });

    await expect(
      findMyMembership(fake.client, " bug7kx ", "user-1"),
    ).resolves.toEqual({ room, player });
    expect(fake.queries).toEqual([
      {
        table: "rooms",
        calls: [
          ["select", []],
          ["eq", ["code", "BUG7KX"]],
          ["neq", ["status", "closed"]],
          ["maybeSingle", []],
        ],
      },
      {
        table: "players",
        calls: [
          ["select", []],
          ["eq", ["room_id", "room-1"]],
          ["eq", ["user_id", "user-1"]],
          ["is", ["left_at", null]],
          ["maybeSingle", []],
        ],
      },
    ]);
  });

  it("returns null when the room is not open or visible", async () => {
    const fake = createFakeClient({ from: [{ data: null, error: null }] });
    await expect(
      findMyMembership(fake.client, "BUG7KX", "user-1"),
    ).resolves.toBeNull();
    expect(fake.queries).toHaveLength(1);
  });

  it("returns null when the caller has no seat in the room", async () => {
    const fake = createFakeClient({
      from: [
        { data: room, error: null },
        { data: null, error: null },
      ],
    });
    await expect(
      findMyMembership(fake.client, "BUG7KX", "user-1"),
    ).resolves.toBeNull();
  });

  it("returns null for malformed codes without calling the database", async () => {
    const fake = createFakeClient({});
    await expect(
      findMyMembership(fake.client, "nope", "user-1"),
    ).resolves.toBeNull();
    expect(fake.from).not.toHaveBeenCalled();
  });

  it("throws typed errors on query failures", async () => {
    const fake = createFakeClient({
      from: [{ data: null, error: { message: "socket hang up" } }],
    });
    await expect(
      findMyMembership(fake.client, "BUG7KX", "user-1"),
    ).rejects.toMatchObject({ name: "DbError", code: "unknown" });
  });
});

describe("listPlayers", () => {
  it("lists the players still in a room, in join order", async () => {
    const fake = createFakeClient({ from: [{ data: [player], error: null }] });

    await expect(listPlayers(fake.client, "room-1")).resolves.toEqual([player]);
    expect(fake.queries[0]).toEqual({
      table: "players",
      calls: [
        ["select", []],
        ["eq", ["room_id", "room-1"]],
        ["is", ["left_at", null]],
        ["order", ["joined_at"]],
        ["order", ["id"]],
      ],
    });
  });

  it("throws on query errors", async () => {
    const fake = createFakeClient({
      from: [
        {
          data: null,
          error: { message: "permission denied for table players" },
        },
      ],
    });

    await expect(listPlayers(fake.client, "room-1")).rejects.toMatchObject({
      code: "unknown",
      message: "permission denied for table players",
    });
  });
});

describe("getRoom", () => {
  it("reads one room", async () => {
    const fake = createFakeClient({ from: [{ data: room, error: null }] });

    await expect(getRoom(fake.client, "room-1")).resolves.toEqual(room);
    expect(fake.queries[0]).toEqual({
      table: "rooms",
      calls: [
        ["select", []],
        ["eq", ["id", "room-1"]],
        ["single", []],
      ],
    });
  });
});

describe("room actions", () => {
  it("sendHeartbeat returns the room status", async () => {
    const fake = createFakeClient({ rpc: [{ data: "closed", error: null }] });

    await expect(sendHeartbeat(fake.client, "room-1")).resolves.toBe("closed");
    expect(fake.rpc).toHaveBeenCalledWith("room_heartbeat", {
      target_room_id: "room-1",
    });
  });

  it("leaveRoom calls leave_room", async () => {
    const fake = createFakeClient({ rpc: [{ data: null, error: null }] });

    await leaveRoom(fake.client, "room-1");
    expect(fake.rpc).toHaveBeenCalledWith("leave_room", {
      target_room_id: "room-1",
    });
  });

  it("advanceRoom sends the event and returns the updated room", async () => {
    const started = { ...room, status: "countdown" as const, current_round: 1 };
    const fake = createFakeClient({ rpc: [{ data: started, error: null }] });

    await expect(advanceRoom(fake.client, "room-1", "start")).resolves.toEqual(
      started,
    );
    expect(fake.rpc).toHaveBeenCalledWith("advance_room", {
      target_room_id: "room-1",
      room_event: "start",
    });
  });

  it("setRoomLocked sends the lock flag", async () => {
    const locked = { ...room, locked: true };
    const fake = createFakeClient({ rpc: [{ data: locked, error: null }] });

    await expect(setRoomLocked(fake.client, "room-1", true)).resolves.toEqual(
      locked,
    );
    expect(fake.rpc).toHaveBeenCalledWith("set_room_locked", {
      target_room_id: "room-1",
      room_locked: true,
    });
  });

  it.each([
    ["advanceRoom", "not_room_admin"],
    ["advanceRoom", "invalid_transition"],
    ["setRoomLocked", "not_room_admin"],
    ["sendHeartbeat", "room_not_found"],
    ["leaveRoom", "room_not_found"],
  ] as const)("%s maps %s to a typed error", async (action, code) => {
    const fake = createFakeClient({
      rpc: [{ data: null, error: { message: code } }],
    });
    const calls = {
      advanceRoom: () => advanceRoom(fake.client, "room-1", "start"),
      setRoomLocked: () => setRoomLocked(fake.client, "room-1", true),
      sendHeartbeat: () => sendHeartbeat(fake.client, "room-1"),
      leaveRoom: () => leaveRoom(fake.client, "room-1"),
    };

    await expect(calls[action]()).rejects.toMatchObject({
      name: "DbError",
      code,
    });
  });
});
