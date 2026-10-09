import { describe, expect, it, vi } from "vitest";
import { DbError, toDbError } from "@/lib/db";
import { handleFixRequest, type FixRevealDeps } from "./handler";

const ROUND_ID = "6b0c5c3e-2f43-4b55-9a3d-0d6c1e2a7f10";

function request(token?: string): Request {
  return new Request(`http://localhost/api/rounds/${ROUND_ID}/fix`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

function deps(overrides: Partial<FixRevealDeps> = {}) {
  return {
    revealPuzzle: vi.fn(async () => "clamp-score"),
    fixFor: vi.fn((id: string) =>
      id === "clamp-score" ? "function clampScore() {}" : undefined,
    ),
    ...overrides,
  };
}

describe("GET /api/rounds/<id>/fix", () => {
  it("returns the fix once the database says the round has ended", async () => {
    const d = deps();
    const response = await handleFixRequest(request("token-1"), ROUND_ID, d);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      puzzleId: "clamp-score",
      fix: "function clampScore() {}",
    });
    expect(d.revealPuzzle).toHaveBeenCalledWith("token-1", ROUND_ID);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("refuses before the round ends, without reading any fix", async () => {
    const d = deps({
      revealPuzzle: vi.fn(async () => {
        throw new DbError("round_not_over");
      }),
    });
    const response = await handleFixRequest(request("token-1"), ROUND_ID, d);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "round_not_over" });
    expect(d.fixFor).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("gives nothing to someone who was not in the round", async () => {
    const d = deps({
      revealPuzzle: vi.fn(async () => {
        throw new DbError("round_not_found");
      }),
    });
    const response = await handleFixRequest(request("token-1"), ROUND_ID, d);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "round_not_found" });
    expect(d.fixFor).not.toHaveBeenCalled();
  });

  it("needs a signed-in player", async () => {
    const d = deps();
    const response = await handleFixRequest(request(), ROUND_ID, d);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "not_authenticated" });
    expect(d.revealPuzzle).not.toHaveBeenCalled();
  });

  it.each([
    [
      "a malformed token",
      { code: "PGRST301", message: "Expected 3 parts in JWT; got 1" },
    ],
    [
      "a token with a bad signature",
      { code: "PGRST301", message: "No suitable key or wrong key type" },
    ],
    [
      "the anon key instead of a player token",
      {
        code: "42501",
        message: "permission denied for function reveal_round_puzzle",
      },
    ],
  ])("treats %s as not signed in", async (_, dbError) => {
    const d = deps({
      revealPuzzle: vi.fn(async () => {
        throw toDbError(dbError);
      }),
    });
    const response = await handleFixRequest(request("bad"), ROUND_ID, d);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "not_authenticated" });
    expect(d.fixFor).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("rejects a malformed round id before asking the database", async () => {
    const d = deps();
    const response = await handleFixRequest(request("t"), "../../etc", d);

    expect(response.status).toBe(404);
    expect(d.revealPuzzle).not.toHaveBeenCalled();
  });

  it("reports a puzzle with no fix on this server", async () => {
    const d = deps({ revealPuzzle: vi.fn(async () => "retired-puzzle") });
    const response = await handleFixRequest(request("t"), ROUND_ID, d);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "fix_not_found" });
  });

  it.each([
    ["a non-database error", new Error("connection refused")],
    [
      "an unknown database error",
      toDbError({ message: "boom", code: "XX000" }),
    ],
  ])("hides %s behind a 500", async (_, thrown) => {
    const d = deps({
      revealPuzzle: vi.fn(async () => {
        throw thrown;
      }),
    });
    const response = await handleFixRequest(request("t"), ROUND_ID, d);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "unknown" });
  });

  it("answers 503 when the database cannot be reached", async () => {
    const d = deps({
      revealPuzzle: vi.fn(async () => {
        throw toDbError({ message: "TypeError: fetch failed", code: "" });
      }),
    });
    const response = await handleFixRequest(request("t"), ROUND_ID, d);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable" });
  });
});
