import { describe, expect, it } from "vitest";
import {
  AVATAR_EMOJIS,
  loadProfile,
  saveProfile,
  validateName,
} from "./name-avatar";

function memoryStorage(initial?: string) {
  let stored = initial ?? null;
  return {
    getItem: () => stored,
    setItem: (_key: string, value: string) => {
      stored = value;
    },
  };
}

describe("validateName", () => {
  it("accepts 1 to 20 characters after trimming", () => {
    expect(validateName("A")).toBeNull();
    expect(validateName("  Mika  ")).toBeNull();
    expect(validateName("x".repeat(20))).toBeNull();
  });

  it("rejects empty, blank and too long names", () => {
    expect(validateName("")).not.toBeNull();
    expect(validateName("   ")).not.toBeNull();
    expect(validateName("x".repeat(21))).not.toBeNull();
  });

  it("rejects < and >, like the database", () => {
    expect(validateName("<b>Riya</b>")).toBe("Names can't contain < or >.");
    expect(validateName("a > b")).toBe("Names can't contain < or >.");
  });
});

describe("profile storage", () => {
  it("remembers the last choice", () => {
    const storage = memoryStorage();
    saveProfile({ name: "Mika", avatar: AVATAR_EMOJIS[2] }, storage);
    expect(loadProfile(storage)).toEqual({
      name: "Mika",
      avatar: AVATAR_EMOJIS[2],
    });
  });

  it("ignores corrupt or invalid data", () => {
    expect(loadProfile(memoryStorage("{nope"))).toBeNull();
    expect(
      loadProfile(memoryStorage(JSON.stringify({ name: "", avatar: "🦊" }))),
    ).toBeNull();
    expect(
      loadProfile(memoryStorage(JSON.stringify({ name: "A", avatar: "💩" }))),
    ).toBeNull();
  });

  it("works when storage is blocked", () => {
    expect(loadProfile(null)).toBeNull();
    expect(() =>
      saveProfile({ name: "A", avatar: AVATAR_EMOJIS[0] }, null),
    ).not.toThrow();
  });
});
