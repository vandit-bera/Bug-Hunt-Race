import { describe, expect, it, vi } from "vitest";
import { ensureSignedIn, getSignedInUserId, type DbClient } from "@/lib/db";

function fakeAuth(sessionUserId: string | null, anonymousUserId = "anon-user") {
  const auth = {
    getSession: vi.fn(async () => ({
      data: { session: sessionUserId ? { user: { id: sessionUserId } } : null },
      error: null,
    })),
    signInAnonymously: vi.fn(
      async (): Promise<{
        data: { user: { id: string } | null };
        error: Error | null;
      }> => ({
        data: { user: { id: anonymousUserId } },
        error: null,
      }),
    ),
  };
  // Only the auth methods ensureSignedIn uses are faked.
  return { auth, client: { auth } as unknown as DbClient };
}

describe("ensureSignedIn", () => {
  it("reuses an existing session", async () => {
    const { auth, client } = fakeAuth("user-1");

    await expect(ensureSignedIn(client)).resolves.toBe("user-1");
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("signs in anonymously when there is no session", async () => {
    const { auth, client } = fakeAuth(null, "anon-1");

    await expect(ensureSignedIn(client)).resolves.toBe("anon-1");
    expect(auth.signInAnonymously).toHaveBeenCalledOnce();
  });

  it("surfaces sign-in errors", async () => {
    const { auth, client } = fakeAuth(null);
    const failure = new Error("Anonymous sign-ins are disabled");
    auth.signInAnonymously.mockResolvedValueOnce({
      data: { user: null },
      error: failure,
    } as never);

    await expect(ensureSignedIn(client)).rejects.toBe(failure);
  });
});

describe("getSignedInUserId", () => {
  it("returns the stored user", async () => {
    const { client } = fakeAuth("user-1");

    await expect(getSignedInUserId(client)).resolves.toBe("user-1");
  });

  it("returns null without signing in", async () => {
    const { auth, client } = fakeAuth(null);

    await expect(getSignedInUserId(client)).resolves.toBeNull();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });
});
