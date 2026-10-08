import { describe, expect, it } from "vitest";
import {
  addCapped,
  capNewest,
  isCoolingDown,
  MAX_FLOATING_REACTIONS,
  overflow,
  rankRows,
  REACTION_COOLDOWN_MS,
  REACTION_EMOJIS,
} from "./room-fun";

const row = (id: string, score: number) => ({
  id,
  name: id,
  emoji: "🦊",
  score,
});

describe("isCoolingDown", () => {
  it("allows the first reaction", () => {
    expect(isCoolingDown(null, 5000)).toBe(false);
  });

  it("blocks a second reaction within one second", () => {
    expect(isCoolingDown(1000, 1000 + REACTION_COOLDOWN_MS - 1)).toBe(true);
  });

  it("allows a reaction once the cooldown has passed", () => {
    expect(isCoolingDown(1000, 1000 + REACTION_COOLDOWN_MS)).toBe(false);
  });
});

describe("capNewest", () => {
  it("keeps everything under the cap", () => {
    expect(capNewest([1, 2, 3], 5)).toEqual([1, 2, 3]);
  });

  it("drops the oldest items over the cap", () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    const capped = capNewest(items, MAX_FLOATING_REACTIONS);
    expect(capped).toHaveLength(20);
    expect(capped[0]).toBe(5);
    expect(capped.at(-1)).toBe(24);
  });
});

describe("addCapped", () => {
  it("never grows past the cap, dropping the oldest", () => {
    let items: number[] = [];
    for (let i = 0; i < 25; i++) items = addCapped(items, i);
    expect(items).toHaveLength(MAX_FLOATING_REACTIONS);
    expect(items[0]).toBe(5);
  });
});

describe("overflow", () => {
  it("returns the oldest items over the cap", () => {
    expect(overflow([1, 2, 3, 4], 3)).toEqual([1]);
  });

  it("is empty under the cap", () => {
    expect(overflow([1, 2], 3)).toEqual([]);
  });
});

it("offers the six reactions", () => {
  expect(REACTION_EMOJIS).toHaveLength(6);
});

describe("rankRows", () => {
  it("sorts by score and numbers ranks from 1", () => {
    const ranked = rankRows([row("a", 10), row("b", 30), row("c", 20)]);
    expect(ranked.map((r) => [r.id, r.rank])).toEqual([
      ["b", 1],
      ["c", 2],
      ["a", 3],
    ]);
  });

  it("reorders and reports rank changes when scores change", () => {
    const first = rankRows([row("a", 30), row("b", 20), row("c", 10)]);
    const next = rankRows([row("a", 30), row("b", 20), row("c", 50)], first);
    expect(next.map((r) => r.id)).toEqual(["c", "a", "b"]);
    expect(next.map((r) => r.change)).toEqual([2, -1, -1]);
  });

  it("keeps the previous order for ties", () => {
    const first = rankRows([row("a", 10), row("b", 5)]);
    const next = rankRows([row("a", 10), row("b", 10)], first);
    expect(next.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("keeps an earlier marker when a row did not move", () => {
    const first = rankRows([row("a", 10), row("b", 20)]);
    const second = rankRows([row("a", 30), row("b", 20)], first);
    const third = rankRows([row("a", 31), row("b", 20)], second);
    expect(third[0]).toMatchObject({ id: "a", change: 1 });
  });
});
