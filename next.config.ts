import type { NextConfig } from "next";
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

/** Pyodide lives under a versioned path, so it can be cached forever. */
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      {
        // Pages and other responses. Built JS is left out: scripts take the
        // page's policy, and the runner workers below need their own.
        source: "/((?!_next/static/).*)",
        headers: securityHeaders({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          isDev: process.env.NODE_ENV === "development",
        }),
      },
      {
        source: "/_next/static/:path*",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
      {
        source: "/_next/static/chunks/:file(turbopack-worker-.*)",
        headers: [{ key: "Content-Security-Policy", value: RUNNER_WORKER_CSP }],
      },
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
