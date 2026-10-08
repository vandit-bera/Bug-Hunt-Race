import type { Database, Enums, Tables } from "./types";

export type Room = Tables<"rooms">;
export type Player = Tables<"players">;
export type Puzzle = Tables<"puzzles">;
export type Round = Tables<"rounds">;
export type Score = Tables<"scores">;

export type RoomStatus = Enums<"room_status">;
export type RoomLevel = Enums<"room_level">;
export type PuzzleLevel = Enums<"puzzle_level">;
export type DbLanguage = Enums<"language_id">;
export type RoomEvent = Enums<"room_event">;

/** What the join screen learns about a room before the player joins it. */
export type RoomPreview =
  Database["public"]["Functions"]["find_open_room"]["Returns"][number];

type LeaderboardRow = Tables<"room_leaderboard">;

/**
 * Postgres reports every view column as nullable, but `room_leaderboard`
 * only selects non-null player columns and coalesced totals.
 */
export type LeaderboardEntry = {
  [K in keyof LeaderboardRow]: NonNullable<LeaderboardRow[K]>;
};

/** A player's seat in a room, returned by create and join. */
export interface RoomMembership {
  room: Room;
  player: Player;
}
