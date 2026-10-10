import { expect, test } from "@playwright/test";
import { waitForHydration } from "./support/hydration";

// TB-82: the room helpers rely on this to not fill forms before React runs.
test("waitForHydration holds until React has hydrated the field", async ({
  page,
}) => {
  let hydrate!: () => void;
  const held = new Promise<void>((resolve) => (hydrate = resolve));
  await page.route("**/_next/static/**/*.js", async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/join", { waitUntil: "domcontentloaded" });
  const input = page.getByLabel("Room code");

  let done = false;
  const waiting = waitForHydration(input).then(() => (done = true));
  await page.waitForTimeout(1_000);
  expect(done).toBe(false);

  hydrate();
  await waiting;
  await input.fill("k7m2qx");
  await expect(input).toHaveValue("K7M2QX");
});
