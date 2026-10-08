import { describe, expect, it } from "vitest";
import { DbError } from "@/lib/db";
import { roomErrorMessage } from "./errors";

describe("roomErrorMessage", () => {
  it.each([
    ["room_not_found", "Room not found"],
    ["room_locked", "Room is locked"],
    ["room_full", "Room is full"],
    ["not_room_admin", "Only the room admin can do that"],
  ] as const)("%s → %s", (code, message) => {
    expect(roomErrorMessage(new DbError(code))).toBe(message);
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
