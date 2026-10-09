import type { NextConfig } from "next";
import { normalizeSupabaseUrl } from "./lib/db/config";
import { securityHeaders } from "./lib/security/headers";

/**
 * CSP for the code-runner Web Workers (see lib/runner/js/worker.ts and
 * lib/runner/python/worker.ts). A worker gets its policy from its own script
 * response, so this blocks every cross-origin request from player code,
 * including dynamic `import()`, which the in-worker lockdown cannot
 * intercept. `'self'` lets Turbopack load the worker's chunks and lets the
 * Python worker download Pyodide from this origin; `'unsafe-eval'` lets the
 * harness compile player code with `new Function` and Pyodide compile its
 * WebAssembly. Same-origin requests are stopped by the lockdown instead.
 */
const RUNNER_WORKER_CSP =
  "default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'self'";

/**
 * Where built JS is served. On Vercel (and here, see `supportsImmutableAssets`
 * below) content-hashed chunks live under `/_next/static/immutable/`; files
 * that are not content-hashed stay under `/_next/static/`. Header rules for
 * built JS must cover both.
 */
const STATIC_CHUNK_DIRS = [
  "/_next/static/chunks",
  "/_next/static/immutable/chunks",
];

/** Pyodide lives under a versioned path, so it can be cached forever. */
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Vercel's adapter turns this on anyway. Setting it here makes `next build`
  // serve built JS from the same paths locally and in CI as in production.
  supportsImmutableAssets: true,
  partialPrefetching: true,
  // No `X-Powered-By: Next.js`: it only tells a scanner what to try.
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Pages and other responses. Built JS is left out: scripts take the
        // page's policy, and the runner workers below need their own.
        source: "/((?!_next/static/).*)",
        headers: securityHeaders({
          supabaseUrl:
            normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) ??
            undefined,
          isDev: process.env.NODE_ENV === "development",
        }),
      },
      {
        source: "/_next/static/:path*",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
      ...STATIC_CHUNK_DIRS.map((dir) => ({
        source: `${dir}/:file(turbopack-worker-.*)`,
        headers: [{ key: "Content-Security-Policy", value: RUNNER_WORKER_CSP }],
      })),
      {
        source: "/pyodide/:path*",
        headers: [{ key: "Cache-Control", value: IMMUTABLE_CACHE }],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
