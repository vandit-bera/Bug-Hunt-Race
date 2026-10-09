import { defineConfig, devices } from "@playwright/test";
import { SMOKE_STATE } from "./e2e/smoke/global-setup";

// Smoke test of a deployed site: `pnpm test:smoke --base-url <url>`
// (scripts/smoke.ts). No local server, no retries.
const BASE_URL = process.env.E2E_BASE_URL;
if (!BASE_URL) throw new Error("Set the site to test: --base-url <url>");
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e/smoke",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: 0,
  reporter: isCI ? [["github"], ["list"]] : "list",
  globalSetup: "./e2e/smoke/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    // The Vercel protection bypass cookie, when the deployment is protected.
    storageState: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? SMOKE_STATE
      : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
