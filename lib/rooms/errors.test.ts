import { describe, expect, it } from "vitest";
import { DbError } from "@/lib/db";
import { roomErrorMessage } from "./errors";

describe("roomErrorMessage", () => {
  it.each([
    ["room_not_found", "Room not found"],
    ["room_locked", "Room is locked"],
    ["room_full", "Room is full"],
    ["not_room_admin", "Only the room admin can do that"],
    ["invalid_display_name", "Names can't contain < or >"],
    ["rate_limited", "You're creating rooms too fast. Try again in a minute."],
    ["joined_late", "You joined mid-round. You'll play from the next round."],
    ["already_submitted", "Your result is already in"],
    ["round_not_over", "The fix is shown when the round ends"],
  ] as const)("%s → %s", (code, message) => {
    expect(roomErrorMessage(new DbError(code))).toBe(message);
  });

  it("tells the player when the server cannot be reached", () => {
    expect(
      roomErrorMessage(
        new DbError("unavailable", "TypeError: Failed to fetch"),
      ),
    ).toBe("Can't reach the game server. Check your connection and try again.");
  });

  it("falls back to a generic message", () => {
    expect(roomErrorMessage(new DbError("unknown", "socket hang up"))).toBe(
      "Something went wrong. Please try again.",
    );
    expect(roomErrorMessage(new Error("boom"))).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
