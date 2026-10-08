import { describe, expect, it } from "vitest";
import { inviteLink, roomHref } from "./links";

describe("room links", () => {
  it("builds the room page path", () => {
    expect(roomHref("BUG7KX")).toBe("/room/BUG7KX");
  });

  it("builds the invite link on the current site", () => {
    expect(inviteLink("https://bughuntrace.example", "BUG7KX")).toBe(
      "https://bughuntrace.example/join/BUG7KX",
    );
  });
});
