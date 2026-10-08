import { describe, expect, it } from "vitest";
import {
  DbError,
  createRoom,
  findRoomByCode,
  joinRoom,
  listPlayers,
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

describe("listPlayers", () => {
  it("lists a room's players in join order", async () => {
    const fake = createFakeClient({ from: [{ data: [player], error: null }] });

    await expect(listPlayers(fake.client, "room-1")).resolves.toEqual([player]);
    expect(fake.queries[0]).toEqual({
      table: "players",
      calls: [
        ["select", []],
        ["eq", ["room_id", "room-1"]],
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
