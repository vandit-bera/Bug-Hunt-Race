import { afterEach, describe, expect, it, vi } from "vitest";
import { isDbConfigured } from "./browser-client";

const KEY = "sb_publishable_test-key";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function setEnv(url: string, key: string) {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", key);
}

describe("isDbConfigured", () => {
  it("accepts the URL with /rest/v1/ that broke the live site (TB-62)", () => {
    setEnv("https://x.supabase.co/rest/v1/", KEY);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(isDbConfigured()).toBe(true);
    expect(log).not.toHaveBeenCalled();
  });

  it("is quietly off when nothing is set", () => {
    setEnv("", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(isDbConfigured()).toBe(false);
    expect(log).not.toHaveBeenCalled();
  });

  it("logs an invalid URL without the key", () => {
    setEnv("x.supabase.co", KEY);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(isDbConfigured()).toBe(false);
    expect(log).toHaveBeenCalledOnce();
    const message = String(log.mock.calls[0][0]);
    expect(message).toContain("NEXT_PUBLIC_SUPABASE_URL is not a valid URL");
    expect(message).not.toContain(KEY);
  });

  it("logs a missing key", () => {
    setEnv("https://x.supabase.co", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(isDbConfigured()).toBe(false);
    expect(String(log.mock.calls[0][0])).toContain(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set",
    );
  });
});
