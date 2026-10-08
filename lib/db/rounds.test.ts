import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DbError,
  getCurrentRound,
  pauseRound,
  resumeRound,
  roundClock,
  skipRound,
  startRound,
  stopGame,
  type CurrentRound,
} from "@/lib/db";
import { createFakeClient } from "./test-utils";

const round: CurrentRound = {
  round_id: "round-1",
  game_number: 1,
  round_number: 2,
  started_at: "2026-10-08T12:00:00.000Z",
  paused_at: null,
  paused_ms: 5_000,
  ended_at: null,
  server_now: "2026-10-08T12:01:00.000Z",
  puzzle_id: "clamp-score",
  language: "javascript",
  level: "easy",
  title: "Clamp a score",
  description: "Keeps a score inside a range.",
  buggy_code: "function clampScore() {}",
  tests: "test('x', () => {});",
  hint: "Look at the limits.",
  time_limit_seconds: 180,
  base_points: 100,
  joined_late: false,
  submitted: false,
};

afterEach(() => {
  vi.useRealTimers();
});

describe("getCurrentRound", () => {
  it("returns the round and this device's offset from the server clock", async () => {
    vi.useFakeTimers();
    // This device is 3 s behind the server.
    vi.setSystemTime(Date.parse(round.server_now) - 3_000);
    const fake = createFakeClient({ rpc: [{ data: [round], error: null }] });

    await expect(getCurrentRound(fake.client, "room-1")).resolves.toEqual({
      round,
      clockOffsetMs: 3_000,
    });
    expect(fake.rpc).toHaveBeenCalledWith("get_current_round", {
      target_room_id: "room-1",
    });
  });

  it("returns null when no round is on (lobby, countdown)", async () => {
    const fake = createFakeClient({ rpc: [{ data: [], error: null }] });
    await expect(getCurrentRound(fake.client, "room-1")).resolves.toBeNull();
  });

  it("maps errors to a typed DbError", async () => {
    const fake = createFakeClient({
      rpc: [{ data: null, error: { message: "room_not_found" } }],
    });
    await expect(getCurrentRound(fake.client, "room-1")).rejects.toEqual(
      new DbError("room_not_found"),
    );
  });
});

describe("roundClock", () => {
  it("maps the round to the clock fields", () => {
    expect(
      roundClock({ ...round, paused_at: "2026-10-08T12:00:40.000Z" }),
    ).toEqual({
      startedAt: "2026-10-08T12:00:00.000Z",
      pausedAt: "2026-10-08T12:00:40.000Z",
      pausedMs: 5_000,
      endedAt: null,
      timeLimitSeconds: 180,
    });
  });
});

describe("admin round actions", () => {
  it.each([
    [startRound, "begin_round"],
    [pauseRound, "pause"],
    [resumeRound, "resume"],
    [skipRound, "end_round"],
    [stopGame, "stop"],
  ] as const)("%o sends %s", async (action, event) => {
    const fake = createFakeClient({ rpc: [{ data: {}, error: null }] });
    await action(fake.client, "room-1");
    expect(fake.rpc).toHaveBeenCalledWith("advance_room", {
      target_room_id: "room-1",
      room_event: event,
    });
  });

  it("surfaces no_puzzles when the round cannot start", async () => {
    const fake = createFakeClient({
      rpc: [{ data: null, error: { message: "no_puzzles" } }],
    });
    await expect(startRound(fake.client, "room-1")).rejects.toEqual(
      new DbError("no_puzzles"),
    );
  });
});
