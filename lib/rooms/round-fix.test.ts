import { describe, expect, it, vi } from "vitest";
import { DbError, type DbClient } from "@/lib/db";
import { fetchRoundFix, roundFixPath } from "./round-fix";

function client(accessToken: string | null): DbClient {
  const auth = {
    getSession: async () => ({
      data: { session: accessToken ? { access_token: accessToken } : null },
      error: null,
    }),
  };
  // Only the auth method fetchRoundFix uses is faked.
  return { auth } as unknown as DbClient;
}

function respond(status: number, body: unknown) {
  return vi.fn(async () => Response.json(body, { status }));
}

describe("fetchRoundFix", () => {
  it("sends the player's token and returns the fix", async () => {
    const fetchImpl = respond(200, { puzzleId: "p", fix: "code" });

    await expect(
      fetchRoundFix(client("token-1"), "round-1", fetchImpl),
    ).resolves.toEqual({ puzzleId: "p", fix: "code" });
    expect(fetchImpl).toHaveBeenCalledWith("/api/rounds/round-1/fix", {
      headers: { Authorization: "Bearer token-1" },
      cache: "no-store",
    });
  });

  it("turns the route's error into a typed DbError", async () => {
    const fetchImpl = respond(403, { error: "round_not_over" });

    await expect(
      fetchRoundFix(client("token-1"), "round-1", fetchImpl),
    ).rejects.toEqual(new DbError("round_not_over"));
  });

  it("needs a session", async () => {
    const fetchImpl = respond(200, {});

    await expect(
      fetchRoundFix(client(null), "round-1", fetchImpl),
    ).rejects.toEqual(new DbError("not_authenticated"));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports a non-JSON failure as unknown", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("Bad gateway", { status: 502 }),
    );

    await expect(
      fetchRoundFix(client("token-1"), "round-1", fetchImpl),
    ).rejects.toMatchObject({ code: "unknown", message: "HTTP 502" });
  });
});

describe("roundFixPath", () => {
  it("encodes the round id", () => {
    expect(roundFixPath("a/b")).toBe("/api/rounds/a%2Fb/fix");
  });
});
