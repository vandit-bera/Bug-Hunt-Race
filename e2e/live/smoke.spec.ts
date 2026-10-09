import { expect, test } from "@playwright/test";

/**
 * Launch smoke test (docs/LAUNCH.md). Run against the deployed site:
 *
 *   E2E_BASE_URL=https://<site> pnpm smoke:live
 *
 * Read-only, except the room check, which creates one room (counts toward
 * that browser's 10 rooms an hour) and leaves it. Also runs in CI against
 * the local build, where the room check is skipped without a Supabase.
 */

const LIVE_SITE = Boolean(process.env.E2E_BASE_URL);
const HAS_SUPABASE = LIVE_SITE || Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

test("home page loads with security headers", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  const headers = response?.headers() ?? {};
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  await expect(
    page.getByRole("heading", { level: 1, name: "Bug Hunt Race 🐛" }),
  ).toBeVisible();
});

test("Solo: a puzzle loads and the code runner works", async ({ page }) => {
  await page.goto("/solo");
  await page.getByLabel("JavaScript", { exact: true }).check();
  await page.getByLabel("Easy", { exact: false }).check();
  await page.getByRole("link", { name: "Start" }).click();
  await expect(page.getByRole("timer")).toBeVisible({ timeout: 15_000 });
  // The buggy code fails its tests: the runner worker loaded and ran it.
  await page.getByRole("button", { name: "Run Tests" }).click();
  await expect(page.getByText("Failed: ").first()).toBeAttached({
    timeout: 15_000,
  });
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

test("rooms: create, join by link, both see each other, leave", async ({
  browser,
}) => {
  test.skip(!HAS_SUPABASE, "Needs a Supabase (the live site has one).");
  const host = await browser.newContext();
  const guest = await browser.newContext();
  try {
    const ana = await host.newPage();
    await ana.goto("/room/new");
    await ana.getByLabel("Your name").fill("Smoke host");
    await ana.getByRole("button", { name: "Create room" }).click();
    await ana.waitForURL(/\/room\/[A-Z2-9]{6}$/);
    const code = new URL(ana.url()).pathname.split("/").pop() ?? "";

    const ben = await guest.newPage();
    await ben.goto(`/join/${code}`);
    await ben.getByLabel("Your name").fill("Smoke guest");
    await ben.getByRole("button", { name: "Join room" }).click();
    await expect(ben).toHaveURL(`/room/${code}`);

    for (const [page, other] of [
      [ana, "Smoke guest"],
      [ben, "Smoke host"],
    ] as const) {
      await expect(page.getByText(other, { exact: true })).toBeVisible({
        timeout: 5_000,
      });
    }

    for (const page of [ben, ana]) {
      await page.getByRole("button", { name: "Leave room" }).click();
      await expect(page).toHaveURL("/");
    }
  } finally {
    await Promise.all([host.close(), guest.close()]);
  }
});
