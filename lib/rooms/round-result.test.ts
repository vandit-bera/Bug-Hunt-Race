import { describe, expect, it, vi } from "vitest";
import type { Score } from "@/lib/db";
import { createFakeClient } from "@/lib/db/test-utils";
import { submitRoundResult } from "./round-result";

const saved: Score = {
  id: "score-1",
  round_id: "round-1",
  player_id: "player-1",
  passed: true,
  solve_time_ms: 42_000,
  hint_used: false,
  points: 138,
  submitted_at: "2026-10-08T00:00:42Z",
};

const input = {
  roundId: "round-1",
  playerId: "player-1",
  passed: true,
  hintUsed: false,
};

// What supabase-js returns when the request never gets an answer.
const lost = {
  data: null,
  error: { message: "TypeError: Failed to fetch", code: "" },
};
const sleep = vi.fn(async () => {});

describe("submitRoundResult", () => {
  it("sends the result once when the network is fine", async () => {
    const fake = createFakeClient({ rpc: [{ data: saved, error: null }] });

    await expect(
      submitRoundResult(fake.client, input, { sleep }),
    ).resolves.toEqual(saved);
    expect(fake.rpc).toHaveBeenCalledTimes(1);
  });

  it("retries while Supabase is unreachable", async () => {
    const fake = createFakeClient({
      rpc: [lost, lost, { data: saved, error: null }],
    });

    await expect(
      submitRoundResult(fake.client, input, { sleep }),
    ).resolves.toEqual(saved);
    expect(fake.rpc).toHaveBeenCalledTimes(3);
  });

  it("never counts a result twice when the first answer was lost", async () => {
    // Attempt 1 reached the database (the score is stored) but the answer
    // never came back; attempt 2 is refused as a second result, and the
    // stored result is read back instead.
    const fake = createFakeClient({
      rpc: [
        lost,
        {
          data: null,
          error: { message: "already_submitted", code: "P0001" },
        },
      ],
      from: [{ data: saved, error: null }],
    });

    await expect(
      submitRoundResult(fake.client, input, { sleep }),
    ).resolves.toEqual(saved);
    expect(fake.rpc).toHaveBeenCalledTimes(2);
    expect(fake.queries.map((query) => query.table)).toEqual(["scores"]);
  });

  it("does not retry an answer from the database", async () => {
    const fake = createFakeClient({
      rpc: [
        { data: null, error: { message: "round_not_live", code: "P0001" } },
      ],
    });

    await expect(
      submitRoundResult(fake.client, input, { sleep }),
    ).rejects.toMatchObject({ code: "round_not_live" });
    expect(fake.rpc).toHaveBeenCalledTimes(1);
  });
});
