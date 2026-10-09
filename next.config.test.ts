import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

const WORKER_CSP =
  "default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'self'";

/**
 * The headers Next sends for `pathname`: every rule whose source matches, in
 * order, a later rule overriding an earlier one's key. Matches sources the
 * way Next does (`buildCustomRoute` in next/dist/server/lib/router-utils).
 */
async function headersFor(pathname: string): Promise<Record<string, string>> {
  const rules = (await nextConfig.headers?.()) ?? [];
  const sent: Record<string, string> = {};
  for (const rule of rules) {
    const match = getPathMatch(rule.source, {
      strict: true,
      removeUnnamedParams: true,
    });
    if (!match(pathname)) continue;
    for (const { key, value } of rule.headers) sent[key.toLowerCase()] = value;
  }
  return sent;
}

describe("next.config headers", () => {
  // Vercel serves content-hashed chunks under /immutable/ (TB-61).
  it.each([
    "/_next/static/chunks/turbopack-worker-17xj571juv_5b.js",
    "/_next/static/immutable/chunks/turbopack-worker-17xj571juv_5b.js",
  ])("gives the runner worker %s only the worker CSP", async (path) => {
    const headers = await headersFor(path);
    expect(headers["content-security-policy"]).toBe(WORKER_CSP);
    expect(headers["x-content-type-options"]).toBe("nosniff");
  });

  it.each([
    "/_next/static/chunks/13sjszk3kvsv8.js",
    "/_next/static/immutable/chunks/13sjszk3kvsv8.js",
  ])("gives other built JS (%s) no CSP", async (path) => {
    const headers = await headersFor(path);
    expect(headers["content-security-policy"]).toBeUndefined();
    expect(headers["x-content-type-options"]).toBe("nosniff");
  });

  it.each(["/", "/solo/play", "/room/ABC234"])(
    "gives the page %s the page CSP",
    async (path) => {
      const csp = (await headersFor(path))["content-security-policy"];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
    },
  );

  it("serves built JS from the immutable path, as Vercel does", () => {
    expect(nextConfig.supportsImmutableAssets).toBe(true);
  });
});
