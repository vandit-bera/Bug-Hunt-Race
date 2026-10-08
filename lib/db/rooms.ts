import { isValidRoomCode, normalizeRoomCode } from "@/lib/game/room-code";
import type { DbClient } from "./client";
import { DbError, toDbError } from "./errors";
import type {
  DbLanguage,
  Player,
  RoomLevel,
  RoomMembership,
  RoomPreview,
} from "./models";

export interface CreateRoomInput {
  language: DbLanguage;
  level: RoomLevel;
  /** null = play until the admin stops. */
  totalRounds: number | null;
  displayName: string;
  avatar: string;
}

export interface JoinRoomInput {
  code: string;
  displayName: string;
  avatar: string;
}

/** Creates a room in the lobby with the signed-in user as its admin. */
export async function createRoom(
  client: DbClient,
  input: CreateRoomInput,
): Promise<RoomMembership> {
  const { data: player, error } = await client.rpc("create_room", {
    room_language: input.language,
    room_level: input.level,
    display_name: input.displayName,
    avatar: input.avatar,
    room_total_rounds: input.totalRounds ?? undefined,
  });
  if (error) throw toDbError(error);
  return withRoom(client, player);
}

/**
 * Looks up an open room by the code a player typed, scanned or opened.
 * Returns null when the code is malformed, unknown or the room is closed.
 * Works before sign-in.
 */
export async function findRoomByCode(
  client: DbClient,
  code: string,
): Promise<RoomPreview | null> {
  const normalized = normalizeRoomCode(code);
  if (!isValidRoomCode(normalized)) return null;

  const { data, error } = await client.rpc("find_open_room", {
    room_code: normalized,
  });
  if (error) throw toDbError(error);
  return data[0] ?? null;
}

/**
 * Joins the signed-in user to an open room. Duplicate names get a suffix
 * ("Riya" → "Riya (2)"). Rejoining returns the existing player, so a dropped
 * connection keeps its name and score.
 */
export async function joinRoom(
  client: DbClient,
  input: JoinRoomInput,
): Promise<RoomMembership> {
  const code = normalizeRoomCode(input.code);
  if (!isValidRoomCode(code)) throw new DbError("room_not_found");

  const { data: player, error } = await client.rpc("join_room", {
    room_code: code,
    display_name: input.displayName,
    avatar: input.avatar,
  });
  if (error) throw toDbError(error);
  return withRoom(client, player);
}

/** Players in a room the caller belongs to, in join order. */
export async function listPlayers(
  client: DbClient,
  roomId: string,
): Promise<Player[]> {
  const { data, error } = await client
    .from("players")
    .select()
    .eq("room_id", roomId)
    .order("joined_at")
    .order("id");
  if (error) throw toDbError(error);
  return data;
}

async function withRoom(
  client: DbClient,
  player: Player,
): Promise<RoomMembership> {
  const { data: room, error } = await client
    .from("rooms")
    .select()
    .eq("id", player.room_id)
    .single();
  if (error) throw toDbError(error);
  return { room, player };
}
