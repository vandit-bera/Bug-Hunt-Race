import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const played: string[] = [];
    Object.assign(window, { played });
    window.Audio = class {
      src: string;
      volume = 1;
      constructor(src: string) {
        this.src = src;
      }
      play() {
        played.push(this.src);
        return Promise.resolve();
      }
    } as unknown as typeof Audio;
  });
});

const playedSounds = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as unknown as { played: string[] }).played);

test("the mute toggle saves its state across reloads", async ({ page }) => {
  await page.goto("/styleguide");
  const toggle = page.getByRole("button", { name: "Mute sound" }).first();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Mute sound" }).first(),
  ).toHaveAttribute("aria-pressed", "true");
});

test("no sound plays before the first interaction; none when muted", async ({
  page,
}) => {
  await page.goto("/styleguide");
  await page.waitForTimeout(1_500);
  expect(await playedSounds(page)).toEqual([]);

  const toggle = page.getByRole("button", { name: "Mute sound" }).first();
  await toggle.click();
  await page
    .getByRole("button", { name: "Replay count-up and popup" })
    .first()
    .click();
  await page.waitForTimeout(1_000);
  expect(await playedSounds(page)).toEqual([]);
});

test("styleguide shows the FX components", async ({ page }) => {
  await page.goto("/styleguide");
  await page.getByRole("button", { name: "Confetti" }).first().click();
  await expect(page.getByTestId("confetti")).toBeVisible();
  await expect(page.getByTestId("score-popup").first()).toBeVisible();
});

test("styleguide: reduced motion removes confetti and popup", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/styleguide");
  await page.getByRole("button", { name: "Confetti" }).first().click();
  await expect(page.getByTestId("confetti")).toHaveCount(0);
  await expect(page.getByTestId("score-popup")).toHaveCount(0);
});
