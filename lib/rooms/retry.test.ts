import { AuthRetryableFetchError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { DbError } from "@/lib/db";
import {
  backoffDelayMs,
  isUnavailableError,
  retryWhileUnavailable,
} from "./retry";

const offline = () => new DbError("unavailable", "TypeError: Failed to fetch");

describe("isUnavailableError", () => {
  it("is true when the database or auth server could not be reached", () => {
    expect(isUnavailableError(offline())).toBe(true);
    expect(
      isUnavailableError(new AuthRetryableFetchError("Failed to fetch", 0)),
    ).toBe(true);
  });

  it("is false for answers from the database and other errors", () => {
    expect(isUnavailableError(new DbError("room_full"))).toBe(false);
    expect(isUnavailableError(new DbError("unknown", "boom"))).toBe(false);
    expect(isUnavailableError(new Error("boom"))).toBe(false);
  });
});

describe("backoffDelayMs", () => {
  it("doubles from 1 s up to 10 s", () => {
    expect([0, 1, 2, 3, 4, 5, 10].map(backoffDelayMs)).toEqual([
      1_000, 2_000, 4_000, 8_000, 10_000, 10_000, 10_000,
    ]);
  });
});

describe("retryWhileUnavailable", () => {
  it("retries with backoff until the call goes through", async () => {
    const sleep = vi.fn(async () => {});
    const call = vi
      .fn<(attempt: number) => Promise<string>>()
      .mockRejectedValueOnce(offline())
      .mockRejectedValueOnce(offline())
      .mockResolvedValueOnce("ok");

    await expect(retryWhileUnavailable(call, { sleep })).resolves.toBe("ok");
    expect(call.mock.calls.map(([attempt]) => attempt)).toEqual([0, 1, 2]);
    expect(sleep.mock.calls).toEqual([[1_000], [2_000]]);
  });

  it("throws other errors at once", async () => {
    const sleep = vi.fn(async () => {});
    const call = vi.fn(async () => {
      throw new DbError("round_not_live");
    });

    await expect(retryWhileUnavailable(call, { sleep })).rejects.toMatchObject({
      code: "round_not_live",
    });
    expect(call).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("gives up after the last attempt with the last error", async () => {
    const sleep = vi.fn(async () => {});
    const call = vi.fn(async () => {
      throw offline();
    });

    await expect(
      retryWhileUnavailable(call, { attempts: 3, sleep }),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(call).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("stops when the signal aborts", async () => {
    const controller = new AbortController();
    const call = vi.fn(async () => {
      controller.abort();
      throw offline();
    });

    await expect(
      retryWhileUnavailable(call, { signal: controller.signal }),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(call).toHaveBeenCalledTimes(1);
  });
});
