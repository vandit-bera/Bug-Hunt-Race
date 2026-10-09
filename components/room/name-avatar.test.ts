import { describe, expect, it } from "vitest";
import {
  AVATAR_EMOJIS,
  loadProfile,
  saveProfile,
  splitDuplicateSuffix,
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

  it("rejects < and >, which the database refuses", () => {
    expect(validateName("<b>Mika</b>")).toBe("Names can't contain < or >.");
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

describe("splitDuplicateSuffix", () => {
  it("splits the duplicate suffix from the base name", () => {
    expect(splitDuplicateSuffix("Riya (2)")).toEqual({
      base: "Riya",
      suffix: "(2)",
    });
    expect(splitDuplicateSuffix("ABCDEFGHIJKLMNOPQRST (12)")).toEqual({
      base: "ABCDEFGHIJKLMNOPQRST",
      suffix: "(12)",
    });
  });

  it("leaves names without a suffix alone", () => {
    expect(splitDuplicateSuffix("Ana")).toEqual({ base: "Ana", suffix: "" });
    expect(splitDuplicateSuffix("Riya(2)")).toEqual({
      base: "Riya(2)",
      suffix: "",
    });
    expect(splitDuplicateSuffix(" (2)")).toEqual({ base: " (2)", suffix: "" });
  });
});
