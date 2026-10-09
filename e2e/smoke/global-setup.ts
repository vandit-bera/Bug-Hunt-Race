import { request, type FullConfig } from "@playwright/test";

/** Browser state holding the Vercel protection bypass cookie. */
export const SMOKE_STATE = "playwright/.smoke/state.json";

/**
 * Checks that the site answers before any test runs. Vercel preview
 * deployments sit behind Vercel Authentication; with
 * `VERCEL_AUTOMATION_BYPASS_SECRET` set (Vercel → Project → Settings →
 * Deployment Protection → Protection Bypass for Automation) this saves the
 * bypass cookie for every test's browser.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const context = await request.newContext({
    baseURL,
    extraHTTPHeaders: secret
      ? {
          "x-vercel-protection-bypass": secret,
          "x-vercel-set-bypass-cookie": "true",
        }
      : {},
  });
  try {
    const response = await context.get("/");
    if (new URL(response.url()).hostname === "vercel.com") {
      throw new Error(
        `${baseURL} is behind Vercel Deployment Protection. ${
          secret
            ? "VERCEL_AUTOMATION_BYPASS_SECRET was refused: check its value."
            : "Set VERCEL_AUTOMATION_BYPASS_SECRET to test it."
        }`,
      );
    }
    if (!response.ok()) {
      throw new Error(`${baseURL} answered ${response.status()}.`);
    }
    if (secret) await context.storageState({ path: SMOKE_STATE });
  } finally {
    await context.dispose();
  }
}
