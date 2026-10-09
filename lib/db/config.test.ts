import { describe, expect, it } from "vitest";
import { normalizeSupabaseUrl, readSupabaseConfig } from "./config";

const KEY = "sb_publishable_secret-looking-value";

describe("normalizeSupabaseUrl", () => {
  it("strips the /rest/v1/ that broke the live site (TB-62)", () => {
    expect(normalizeSupabaseUrl("https://x.supabase.co/rest/v1/")).toBe(
      "https://x.supabase.co",
    );
    expect(normalizeSupabaseUrl("https://x.supabase.co/rest/v1")).toBe(
      "https://x.supabase.co",
    );
  });

  it("strips the other service paths, in any case", () => {
    expect(normalizeSupabaseUrl("https://x.supabase.co/auth/v1")).toBe(
      "https://x.supabase.co",
    );
    expect(normalizeSupabaseUrl("https://x.supabase.co/realtime/v1/")).toBe(
      "https://x.supabase.co",
    );
    expect(normalizeSupabaseUrl("https://x.supabase.co/REST/V1")).toBe(
      "https://x.supabase.co",
    );
  });

  it("trims spaces and trailing slashes", () => {
    expect(normalizeSupabaseUrl("https://x.supabase.co/")).toBe(
      "https://x.supabase.co",
    );
    expect(normalizeSupabaseUrl("  https://x.supabase.co//  \n")).toBe(
      "https://x.supabase.co",
    );
  });

  it("keeps a correct URL as it is", () => {
    expect(normalizeSupabaseUrl("https://x.supabase.co")).toBe(
      "https://x.supabase.co",
    );
  });

  it("keeps the local Supabase URL and its port", () => {
    expect(normalizeSupabaseUrl("http://127.0.0.1:54321")).toBe(
      "http://127.0.0.1:54321",
    );
    expect(normalizeSupabaseUrl("http://127.0.0.1:54321/rest/v1/")).toBe(
      "http://127.0.0.1:54321",
    );
  });

  it("keeps any other path (a self-hosted proxy prefix)", () => {
    expect(normalizeSupabaseUrl("https://example.com/supabase/")).toBe(
      "https://example.com/supabase",
    );
  });

  it("only strips a service path at the end", () => {
    expect(normalizeSupabaseUrl("https://x.supabase.co/rest/v1/rpc")).toBe(
      "https://x.supabase.co/rest/v1/rpc",
    );
  });

  it("rejects missing and garbage input", () => {
    for (const raw of [
      undefined,
      "",
      "   ",
      "/rest/v1",
      "x.supabase.co",
      "not a url",
      "javascript:alert(1)",
      "ftp://x.supabase.co",
      "https://user:pass@x.supabase.co",
      "https://x.supabase.co/?apikey=1",
      "https://x.supabase.co/#top",
    ]) {
      expect(normalizeSupabaseUrl(raw), String(raw)).toBeNull();
    }
  });
});

describe("readSupabaseConfig", () => {
  it("returns the normalized URL and trimmed key", () => {
    expect(
      readSupabaseConfig("https://x.supabase.co/rest/v1/", ` ${KEY}\n`),
    ).toEqual({ ok: true, url: "https://x.supabase.co", key: KEY });
  });

  it("reports nothing set as missing, not as an error", () => {
    const config = readSupabaseConfig(undefined, undefined);
    expect(config).toMatchObject({ ok: false, missing: true });
    expect(readSupabaseConfig(" ", "")).toMatchObject({ missing: true });
  });

  it("names the missing variable when only one is set", () => {
    expect(readSupabaseConfig("https://x.supabase.co", "")).toEqual({
      ok: false,
      missing: false,
      problem:
        "Supabase is misconfigured: NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.",
    });
    expect(readSupabaseConfig(undefined, KEY)).toEqual({
      ok: false,
      missing: false,
      problem:
        "Supabase is misconfigured: NEXT_PUBLIC_SUPABASE_URL is not set.",
    });
  });

  it("explains an invalid URL without printing the key or the value", () => {
    const config = readSupabaseConfig("x.supabase.co", KEY);
    expect(config.ok).toBe(false);
    if (config.ok) return;
    expect(config.missing).toBe(false);
    expect(config.problem).toContain(
      "NEXT_PUBLIC_SUPABASE_URL is not a valid URL",
    );
    expect(config.problem).not.toContain(KEY);
    expect(config.problem).not.toContain("x.supabase.co");
  });

  it("does not leak a key pasted into the URL variable", () => {
    const config = readSupabaseConfig(KEY, KEY);
    expect(config.ok).toBe(false);
    if (config.ok) return;
    expect(config.problem).not.toContain(KEY);
  });
});
