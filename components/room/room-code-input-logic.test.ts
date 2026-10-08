import { describe, expect, it } from "vitest";
import { lookAlikeHint, sanitizeRoomCodeInput } from "./room-code-input-logic";

describe("sanitizeRoomCodeInput", () => {
  it("uppercases and strips spaces and dashes", () => {
    expect(sanitizeRoomCodeInput(" k7m-2qx ")).toEqual({
      value: "K7M2QX",
      rejected: [],
    });
  });

  it("limits to 6 characters, so a pasted link tail is cut", () => {
    expect(sanitizeRoomCodeInput("K7M2QXZZZ").value).toBe("K7M2QX");
  });

  it("rejects 0, O, 1 and I and reports them", () => {
    expect(sanitizeRoomCodeInput("0o1iK7")).toEqual({
      value: "K7",
      rejected: ["0", "O", "1", "I"],
    });
  });

  it("silently drops other symbols", () => {
    expect(sanitizeRoomCodeInput("K7!M2?")).toEqual({
      value: "K7M2",
      rejected: [],
    });
  });

  it("handles empty input", () => {
    expect(sanitizeRoomCodeInput("")).toEqual({ value: "", rejected: [] });
  });
});

describe("lookAlikeHint", () => {
  it("is undefined when nothing was rejected", () => {
    expect(lookAlikeHint([])).toBeUndefined();
  });

  it("names each rejected character once", () => {
    expect(lookAlikeHint(["0", "0", "O"])).toContain("0, O");
  });
});
