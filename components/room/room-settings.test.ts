import { describe, expect, it } from "vitest";
import { describeRoomSettings } from "./room-settings";

describe("describeRoomSettings", () => {
  it("lists language, level and rounds", () => {
    expect(
      describeRoomSettings({
        language: "python",
        level: "hard",
        totalRounds: 5,
      }),
    ).toBe("Python · Hard · 5 rounds");
  });

  it("says when the game runs until the admin stops", () => {
    expect(
      describeRoomSettings({
        language: "javascript",
        level: "mixed",
        totalRounds: null,
      }),
    ).toBe("JavaScript · Mixed · Play until the admin stops");
  });

  it("leaves rounds out when unknown", () => {
    expect(
      describeRoomSettings({ language: "typescript", level: "easy" }),
    ).toBe("TypeScript · Easy");
  });
});
