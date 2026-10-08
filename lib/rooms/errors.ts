import { DbError, type DbErrorCode } from "@/lib/db";

const MESSAGES: Partial<Record<DbErrorCode, string>> = {
  room_not_found: "Room not found",
  room_locked: "Room is locked",
  room_full: "Room is full",
  not_room_admin: "Only the room admin can do that",
  invalid_transition: "That's not possible right now",
  invalid_display_name: "Pick a name of 1–24 characters",
  invalid_avatar: "Pick an avatar",
};

/** A short message for the player, e.g. "Room is full". */
export function roomErrorMessage(error: unknown): string {
  return (
    (error instanceof DbError && MESSAGES[error.code]) ||
    "Something went wrong. Please try again."
  );
}
