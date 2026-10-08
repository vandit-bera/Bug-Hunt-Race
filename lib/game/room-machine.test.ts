import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ROOM_TRANSITIONS,
  availableEvents,
  transition,
  type RoomEvent,
  type RoomSnapshot,
} from "./room-machine";
import type { RoomState } from "./types";

const STATES: RoomState[] = [
  "lobby",
  "countdown",
  "round_live",
  "paused",
  "round_results",
  "final_leaderboard",
  "closed",
];

const EVENTS: RoomEvent[] = [
  "start",
  "begin_round",
  "pause",
  "resume",
  "end_round",
  "next_round",
  "finish",
  "stop",
  "play_again",
  "close",
  "abandon",
];

function room(state: RoomState, overrides: Partial<RoomSnapshot> = {}) {
  return { state, currentRound: 1, totalRounds: null, ...overrides };
}

// TB-19 §12, written out independently of ROOM_TRANSITIONS.
const ALLOWED: [RoomState, RoomEvent, RoomState][] = [
  ["lobby", "start", "countdown"],
  ["countdown", "begin_round", "round_live"],
  ["round_live", "pause", "paused"],
  ["paused", "resume", "round_live"],
  ["round_live", "end_round", "round_results"],
  ["round_results", "next_round", "countdown"],
  ["round_results", "finish", "final_leaderboard"],
  ["round_live", "stop", "final_leaderboard"],
  ["paused", "stop", "final_leaderboard"],
  ["final_leaderboard", "play_again", "lobby"],
  ["final_leaderboard", "close", "closed"],
];

describe("transition", () => {
  it.each(ALLOWED)("admin: %s --%s--> %s", (from, event, to) => {
    expect(transition(room(from), event, "admin")).toMatchObject({
      ok: true,
      room: { state: to },
    });
  });

  const rejected = STATES.flatMap((from) =>
    EVENTS.filter(
      (event) => !ALLOWED.some(([f, e]) => f === from && e === event),
    ).map((event) => [from, event] as const),
  );

  it.each(rejected)("admin: %s --%s--> rejected", (from, event) => {
    expect(transition(room(from), event, "admin")).toEqual({
      ok: false,
      error: "invalid_transition",
    });
  });

  it("covers every state and event pair", () => {
    expect(ALLOWED.length + rejected.length).toBe(
      STATES.length * EVENTS.length,
    );
  });

  it.each(STATES.filter((s) => s !== "closed"))(
    "system: %s --abandon--> closed (no connected players for 10 min)",
    (from) => {
      expect(transition(room(from), "abandon", "system")).toMatchObject({
        ok: true,
        room: { state: "closed" },
      });
    },
  );

  it("the system cannot trigger admin events", () => {
    expect(transition(room("lobby"), "start", "system")).toEqual({
      ok: false,
      error: "not_room_admin",
    });
  });

  it("a closed room stays closed", () => {
    expect(transition(room("closed"), "abandon", "system")).toEqual({
      ok: false,
      error: "invalid_transition",
    });
  });

  it("start begins round 1 and next_round counts up", () => {
    const started = transition(
      room("lobby", { currentRound: 0 }),
      "start",
      "admin",
    );
    expect(started).toMatchObject({ ok: true, room: { currentRound: 1 } });

    const next = transition(room("round_results"), "next_round", "admin");
    expect(next).toMatchObject({ ok: true, room: { currentRound: 2 } });
  });

  it("other events keep the round number", () => {
    expect(
      transition(room("round_live", { currentRound: 3 }), "pause", "admin"),
    ).toMatchObject({ ok: true, room: { currentRound: 3 } });
  });

  it("play_again resets the round number", () => {
    expect(
      transition(
        room("final_leaderboard", { currentRound: 5, totalRounds: 5 }),
        "play_again",
        "admin",
      ),
    ).toEqual({
      ok: true,
      room: { state: "lobby", currentRound: 0, totalRounds: 5 },
    });
  });

  describe("with a fixed number of rounds", () => {
    const middle = room("round_results", { currentRound: 2, totalRounds: 3 });
    const last = room("round_results", { currentRound: 3, totalRounds: 3 });

    it("next_round needs a round left", () => {
      expect(transition(middle, "next_round", "admin").ok).toBe(true);
      expect(transition(last, "next_round", "admin")).toEqual({
        ok: false,
        error: "invalid_transition",
      });
    });

    it("finish needs the last round played", () => {
      expect(transition(middle, "finish", "admin")).toEqual({
        ok: false,
        error: "invalid_transition",
      });
      expect(transition(last, "finish", "admin")).toMatchObject({
        ok: true,
        room: { state: "final_leaderboard" },
      });
    });
  });

  it("'until stopped' allows both next_round and finish", () => {
    const results = room("round_results", { currentRound: 9 });
    expect(transition(results, "next_round", "admin").ok).toBe(true);
    expect(transition(results, "finish", "admin").ok).toBe(true);
  });
});

describe("availableEvents", () => {
  it("lists what the admin can do now", () => {
    expect(availableEvents(room("round_live"), "admin")).toEqual([
      "pause",
      "end_round",
      "stop",
    ]);
  });

  it("applies the round guards", () => {
    expect(
      availableEvents(
        room("round_results", { currentRound: 3, totalRounds: 3 }),
        "admin",
      ),
    ).toEqual(["finish"]);
  });

  it("offers nothing in a closed room", () => {
    expect(availableEvents(room("closed"), "admin")).toEqual([]);
  });
});

describe("database copy", () => {
  // private.room_transitions is the copy the database enforces.
  const migration = readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20261008000004_room_engine.sql",
    ),
    "utf8",
  );
  const insert = migration.match(/insert into private\.room_transitions[^;]+;/);

  it("matches ROOM_TRANSITIONS", () => {
    expect(insert).not.toBeNull();
    const rows = [
      ...(insert?.[0] ?? "").matchAll(
        /\('(\w+)', '(\w+)', '(\w+)', '(\w+)'\)/g,
      ),
    ].map(([, from, event, to, by]) => ({ from, event, to, by }));
    expect(rows).toEqual(ROOM_TRANSITIONS);
  });
});
