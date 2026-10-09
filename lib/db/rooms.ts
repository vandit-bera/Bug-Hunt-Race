import { isValidRoomCode, normalizeRoomCode } from "@/lib/game/room-code";
import type { DbClient } from "./client";
import { DbError, toDbError } from "./errors";
import type {
  DbLanguage,
  Player,
  Room,
  RoomEvent,
  RoomLevel,
  RoomMembership,
  RoomPreview,
  RoomStatus,
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
 * Returns null when the code is malformed or unknown. A code whose room has
 * closed returns that room with `status: "closed"` (and nothing else about
 * it), so the screen can say "Room closed". Works before sign-in.
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
 * connection keeps its name and score. Raises `room_closed` once the room
 * has closed, `room_not_found` for a code no room ever had.
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

/**
 * The caller's own seat in the open room with this code, or null when they
 * have none (never joined, left, or the room closed). Lets a room page pick
 * the seat back up after a redirect or reload without joining again.
 */
export async function findMyMembership(
  client: DbClient,
  code: string,
  userId: string,
): Promise<RoomMembership | null> {
  const normalized = normalizeRoomCode(code);
  if (!isValidRoomCode(normalized)) return null;

  const { data: room, error: roomError } = await client
    .from("rooms")
    .select()
    .eq("code", normalized)
    .neq("status", "closed")
    .maybeSingle();
  if (roomError) throw toDbError(roomError);
  if (!room) return null;

  const { data: player, error: playerError } = await client
    .from("players")
    .select()
    .eq("room_id", room.id)
    .eq("user_id", userId)
    .is("left_at", null)
    .maybeSingle();
  if (playerError) throw toDbError(playerError);
  return player ? { room, player } : null;
}

/** Players still in a room the caller belongs to, in join order. */
export async function listPlayers(
  client: DbClient,
  roomId: string,
): Promise<Player[]> {
  const { data, error } = await client
    .from("players")
    .select()
    .eq("room_id", roomId)
    .is("left_at", null)
    .order("joined_at")
    .order("id");
  if (error) throw toDbError(error);
  return data;
}

/** A room the caller belongs to. */
export async function getRoom(client: DbClient, roomId: string): Promise<Room> {
  const { data, error } = await client
    .from("rooms")
    .select()
    .eq("id", roomId)
    .single();
  if (error) throw toDbError(error);
  return data;
}

/**
 * Tells the room the caller is still here. Call every
 * `HEARTBEAT_INTERVAL_MS` (lib/rooms does). The database marks players not
 * seen for 15 s as disconnected, hands the admin role over, and closes a room
 * nobody has been seen in for 10 minutes. Returns the room status, which is
 * `closed` once the room has closed (the admin closed it, or it was
 * abandoned).
 */
export async function sendHeartbeat(
  client: DbClient,
  roomId: string,
): Promise<RoomStatus> {
  const { data, error } = await client.rpc("room_heartbeat", {
    target_room_id: roomId,
  });
  if (error) throw toDbError(error);
  return data;
}

/**
 * Leaves the room: frees the seat and the name. If the caller was the admin,
 * the earliest-joined connected player takes over. Joining again later gets
 * the same player back, with their scores.
 */
export async function leaveRoom(
  client: DbClient,
  roomId: string,
): Promise<void> {
  const { error } = await client.rpc("leave_room", { target_room_id: roomId });
  if (error) throw toDbError(error);
}

/**
 * Admin only: moves the room through the state machine
 * (lib/game/room-machine.ts). Raises `not_room_admin` for other players and
 * `invalid_transition` for an event the current state does not allow.
 */
export async function advanceRoom(
  client: DbClient,
  roomId: string,
  event: RoomEvent,
): Promise<Room> {
  const { data, error } = await client.rpc("advance_room", {
    target_room_id: roomId,
    room_event: event,
  });
  if (error) throw toDbError(error);
  return data;
}

/** Admin only: lock or unlock the room to new players. */
export async function setRoomLocked(
  client: DbClient,
  roomId: string,
  locked: boolean,
): Promise<Room> {
  const { data, error } = await client.rpc("set_room_locked", {
    target_room_id: roomId,
    room_locked: locked,
  });
  if (error) throw toDbError(error);
  return data;
}

/**
 * Admin only, from the final leaderboard: back to the lobby with the same
 * players for a new game. Everyone starts at 0 (the leaderboard counts only
 * the current game; older games' scores are kept), round numbers start
 * again at 1, and puzzles from earlier games can come back.
 */
export function playAgain(client: DbClient, roomId: string): Promise<Room> {
  return advanceRoom(client, roomId, "play_again");
}

/**
 * Admin only, from the final leaderboard: closes the room for good. Its code
 * and link stop working (`room_closed`), and every player's connection
 * reports the room closed.
 */
export function closeRoom(client: DbClient, roomId: string): Promise<Room> {
  return advanceRoom(client, roomId, "close");
}

async function withRoom(
  client: DbClient,
  player: Player,
): Promise<RoomMembership> {
  return { room: await getRoom(client, player.room_id), player };
}
