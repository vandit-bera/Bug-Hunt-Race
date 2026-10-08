import type { NextConfig } from "next";

/**
 * CSP for the code-runner Web Worker (see lib/runner/js/worker.ts). A worker
 * gets its policy from its own script response, so this blocks every network
 * request from player code, including dynamic `import()`, which the in-worker
 * lockdown cannot intercept. `'self'` lets Turbopack load the worker's chunks;
 * `'unsafe-eval'` lets the harness compile player code with `new Function`.
 */
const RUNNER_WORKER_CSP = "default-src 'none'; script-src 'self' 'unsafe-eval'";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      {
        source: "/_next/static/chunks/:file(turbopack-worker-.*)",
        headers: [{ key: "Content-Security-Policy", value: RUNNER_WORKER_CSP }],
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
