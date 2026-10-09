import { spawnSync } from "node:child_process";

/**
 * `pnpm test:smoke --base-url <url> [playwright options]`: runs the smoke
 * test (e2e/smoke/) against a deployed site. `E2E_BASE_URL` works too.
 * Other options go to Playwright, e.g. `--headed` or `-g Python`.
 */

const args = process.argv.slice(2);
let baseUrl = process.env.E2E_BASE_URL;
const rest: string[] = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--base-url") baseUrl = args[++i];
  else if (arg.startsWith("--base-url=")) baseUrl = arg.slice(11);
  else rest.push(arg);
}

if (!baseUrl || !URL.canParse(baseUrl)) {
  console.error("Usage: pnpm test:smoke --base-url https://<site>");
  process.exit(1);
}

const { status } = spawnSync(
  "pnpm",
  [
    "exec",
    "playwright",
    "test",
    "--config",
    "playwright.smoke.config.ts",
    ...rest,
  ],
  { stdio: "inherit", env: { ...process.env, E2E_BASE_URL: baseUrl } },
);
process.exit(status ?? 1);
