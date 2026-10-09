import { describe, expect, it } from "vitest";
import {
  msUntilAllowed,
  parseReactionMessage,
  REACTION_RATE,
  roomMessageAllowance,
  roomSendDelayMs,
  takeWithinRate,
} from "./reactions";

describe("parseReactionMessage", () => {
  it("accepts a sender with 1 to 5 allowed emoji", () => {
    expect(parseReactionMessage({ sender: "p1", emojis: ["🔥"] })).toEqual({
      sender: "p1",
      emojis: ["🔥"],
    });
    const five = ["😂", "🔥", "👏", "😱", "🐛"];
    expect(
      parseReactionMessage({ sender: "p1", emojis: five })?.emojis,
    ).toEqual(five);
  });

  it.each([
    ["null", null],
    ["a string", "🔥"],
    ["an array", [{ sender: "p1", emojis: ["🔥"] }]],
    ["no sender", { emojis: ["🔥"] }],
    ["no emojis", { sender: "p1" }],
    ["an empty sender", { sender: "", emojis: ["🔥"] }],
    ["a non-string sender", { sender: 7, emojis: ["🔥"] }],
    ["an over-long sender", { sender: "p".repeat(65), emojis: ["🔥"] }],
    ["emojis not a list", { sender: "p1", emojis: "🔥" }],
    ["no emoji at all", { sender: "p1", emojis: [] }],
    [
      "more emoji than the rate allows",
      { sender: "p1", emojis: Array(6).fill("🔥") },
    ],
    ["a custom emoji", { sender: "p1", emojis: ["💩"] }],
    ["text instead of an emoji", { sender: "p1", emojis: ["<img src=x>"] }],
    ["one bad emoji among good ones", { sender: "p1", emojis: ["🔥", 1] }],
    ["an extra field", { sender: "p1", emojis: ["🔥"], name: "Admin" }],
  ])("ignores %s", (_label, payload) => {
    expect(parseReactionMessage(payload)).toBeNull();
  });

  it("copies the emoji list, so later changes to the payload do not leak in", () => {
    const emojis = ["🔥"];
    const message = parseReactionMessage({ sender: "p1", emojis });
    emojis.push("😂");
    expect(message?.emojis).toEqual(["🔥"]);
  });
});

describe("takeWithinRate", () => {
  it("allows up to the max within the window", () => {
    let history: number[] = [];
    const allowed: number[] = [];
    for (let i = 0; i < 7; i++) {
      const result = takeWithinRate(history, 1000 + i * 100, 1);
      history = result.history;
      allowed.push(result.allowed);
    }
    expect(allowed).toEqual([1, 1, 1, 1, 1, 0, 0]);
  });

  it("allows part of a batch", () => {
    const { allowed, history } = takeWithinRate([0, 10, 20], 30, 5);
    expect(allowed).toBe(2);
    expect(history).toEqual([0, 10, 20, 30, 30]);
  });

  it("frees up as old reactions leave the window", () => {
    const full = [0, 0, 0, 0, 0];
    expect(takeWithinRate(full, REACTION_RATE.windowMs - 1, 1).allowed).toBe(0);
    const later = takeWithinRate(full, REACTION_RATE.windowMs, 1);
    expect(later.allowed).toBe(1);
    expect(later.history).toEqual([REACTION_RATE.windowMs]);
  });
});

describe("roomMessageAllowance", () => {
  it("shares the budget out by how many players each message reaches", () => {
    // 50 deliveries/s.
    expect(roomMessageAllowance(30)).toBe(1);
    expect(roomMessageAllowance(10)).toBe(5);
    expect(roomMessageAllowance(3)).toBe(16);
  });

  it("always lets at least one message through", () => {
    expect(roomMessageAllowance(1000)).toBe(1);
    expect(roomMessageAllowance(0)).toBe(50);
  });
});

describe("msUntilAllowed", () => {
  it("is 0 while under the max", () => {
    expect(msUntilAllowed([0, 100], 200, 3, 1000)).toBe(0);
  });

  it("waits for the oldest event to leave the window", () => {
    expect(msUntilAllowed([300, 100, 200], 400, 3, 1000)).toBe(700);
  });

  it("ignores events already outside the window", () => {
    expect(msUntilAllowed([0, 0, 0, 500], 1200, 2, 1000)).toBe(0);
  });
});

describe("roomSendDelayMs", () => {
  it("lets a small room send freely", () => {
    const seen = Array.from({ length: 15 }, (_, i) => 1000 + i * 50);
    expect(roomSendDelayMs(seen, 1800, 3)).toBe(0);
  });

  it("holds a full room to one message a second", () => {
    expect(roomSendDelayMs([400], 500, 30)).toBe(900);
    expect(roomSendDelayMs([400], 1400, 30)).toBe(0);
  });
});
