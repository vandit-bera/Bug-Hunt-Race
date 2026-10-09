import { expect, test, type Page } from "@playwright/test";
import {
  currentPuzzle,
  setCode,
  startSolo,
  type SoloLanguage,
} from "../support/solo";

/**
 * Smoke test of a deployed site (docs/LAUNCH.md §6). Read-only: it writes
 * nothing to Supabase. The room flow, which does, is in `rooms.spec.ts`.
 *
 *   pnpm test:smoke --base-url https://<site>
 *
 * Also runs in CI with the normal E2E suite against the local build, so the
 * selectors stay in step with the app; checks that need a Supabase are
 * skipped there.
 */

const LIVE_SITE = Boolean(process.env.E2E_BASE_URL);
const HAS_SUPABASE = LIVE_SITE || Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

/** Collects console errors and uncaught exceptions on `page`. */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

test("home loads with the security headers and no console errors", async ({
  page,
}) => {
  const errors = trackErrors(page);
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  const headers = response?.headers() ?? {};
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  await expect(
    page.getByRole("heading", { level: 1, name: "Bug Hunt Race 🐛" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("/solo loads with no console errors", async ({ page }) => {
  const errors = trackErrors(page);
  const response = await page.goto("/solo");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: "Solo Practice" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("the theme toggle switches between light and dark", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("radio", { name: /Dark/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("radio", { name: /Light/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

const SOLO: { language: SoloLanguage; wait: number }[] = [
  { language: "javascript", wait: 15_000 },
  // Pyodide downloads and starts on the first run.
  { language: "python", wait: 60_000 },
];

for (const { language, wait } of SOLO) {
  test(`Solo ${language} Easy: the buggy code fails, the fix passes`, async ({
    page,
  }) => {
    test.setTimeout(wait + 60_000);
    const errors = trackErrors(page);
    await startSolo(page, language, "Easy");
    const puzzle = await currentPuzzle(page);

    await page.getByRole("button", { name: "Run Tests" }).click();
    await expect(page.getByText("Failed: ").first()).toBeAttached({
      timeout: wait,
    });

    await setCode(page, puzzle.fix);
    await page.getByRole("button", { name: "Run Tests" }).click();
    await expect(
      page.getByRole("heading", { name: "Bug squashed!" }),
    ).toBeVisible({ timeout: wait });
    expect(errors).toEqual([]);
  });
}

test("an invite link with a made-up code shows Room not found", async ({
  page,
}) => {
  test.skip(!HAS_SUPABASE, "Needs a Supabase (the live site has one).");
  await page.goto("/join/ZZZZZZ");
  await expect(
    page.getByRole("heading", { name: "Room not found" }),
  ).toBeVisible({ timeout: 15_000 });
});

test("an unknown page shows the 404 screen", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { level: 1, name: "Page not found" }),
  ).toBeVisible();
});

test("the fix route refuses a request without a player", async ({
  request,
}) => {
  const response = await request.get(
    "/api/rounds/00000000-0000-0000-0000-000000000000/fix",
  );
  expect(response.status()).toBe(401);
});
