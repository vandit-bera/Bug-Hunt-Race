import { describe, expect, it } from "vitest";
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  isValidRoomCode,
  normalizeRoomCode,
} from "@/lib/game/room-code";

describe("room codes", () => {
  it("uses 32 characters with no 0, O, 1 or I", () => {
    expect(ROOM_CODE_ALPHABET).toHaveLength(32);
    expect(new Set(ROOM_CODE_ALPHABET).size).toBe(32);
    for (const lookAlike of ["0", "O", "1", "I"]) {
      expect(ROOM_CODE_ALPHABET).not.toContain(lookAlike);
    }
  });

  it("accepts every alphabet character and nothing else", () => {
    for (const char of ROOM_CODE_ALPHABET) {
      expect(isValidRoomCode(char.repeat(ROOM_CODE_LENGTH))).toBe(true);
    }
    for (const char of "0O1Iabc!") {
      expect(isValidRoomCode(char.repeat(ROOM_CODE_LENGTH))).toBe(false);
    }
  });

  it("requires exactly 6 characters", () => {
    expect(isValidRoomCode("BUG7KX")).toBe(true);
    expect(isValidRoomCode("BUG7K")).toBe(false);
    expect(isValidRoomCode("BUG7KXA")).toBe(false);
    expect(isValidRoomCode("")).toBe(false);
  });

  it("normalizes typed or pasted codes", () => {
    expect(normalizeRoomCode(" bug7kx ")).toBe("BUG7KX");
    expect(normalizeRoomCode("BUG-7KX")).toBe("BUG7KX");
    expect(normalizeRoomCode("bug 7kx")).toBe("BUG7KX");
  });
});
