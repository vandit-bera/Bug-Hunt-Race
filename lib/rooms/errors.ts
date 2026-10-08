import { DbError, type DbErrorCode } from "@/lib/db";

const MESSAGES: Partial<Record<DbErrorCode, string>> = {
  room_not_found: "Room not found",
  room_locked: "Room is locked",
  room_full: "Room is full",
  not_room_admin: "Only the room admin can do that",
  invalid_transition: "That's not possible right now",
  invalid_display_name: "Names can't contain < or >",
  invalid_avatar: "Pick an avatar",
  rate_limited: "You're creating rooms too fast. Try again in a minute.",
  no_puzzles: "No puzzles for this language and level yet",
  joined_late: "You joined mid-round. You'll play from the next round.",
  already_submitted: "Your result is already in",
  round_not_live: "This round is over",
  round_not_over: "The fix is shown when the round ends",
};

/** A short message for the player, e.g. "Room is full". */
export function roomErrorMessage(error: unknown): string {
  return (
    (error instanceof DbError && MESSAGES[error.code]) ||
    "Something went wrong. Please try again."
  );
}
