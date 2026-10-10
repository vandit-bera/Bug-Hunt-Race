import { expect, type Page } from "@playwright/test";

/** The phone widths every screen is checked at (TB-74). */
export const PHONE_WIDTHS = [320, 375] as const;

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/**
 * Every visible link, button and form control must be at least 44px in both
 * directions. A checkbox or radio inside its label counts as the label's size.
 */
export async function expectTapTargets(page: Page) {
  const small = await page
    .locator(
      "a:visible, button:visible, input:visible, select:visible, input[type=radio]",
    )
    .evaluateAll((nodes) =>
      nodes
        // Skip the Next.js dev overlay, which lives in a shadow root.
        .filter((node) => node.getRootNode() === document)
        .map((node) => {
          const target = node.matches("input[type=checkbox]")
            ? (node.closest("label") ?? node)
            : node;
          const box = target.getBoundingClientRect();
          return {
            name:
              node.getAttribute("aria-label") ?? node.textContent?.trim() ?? "",
            h: Math.round(box.height),
            w: Math.round(box.width),
          };
        })
        .filter(({ h, w }) => w > 0 && (h < 44 || w < 44)),
    );
  expect(small).toEqual([]);
}

/** At each phone width: no sideways scroll, big tap targets, `visible` shown. */
export async function expectFitsPhones(
  page: Page,
  visible: string[] = [],
  widths: readonly number[] = PHONE_WIDTHS,
) {
  const viewport = page.viewportSize();
  for (const width of widths) {
    await page.setViewportSize({ width, height: 740 });
    for (const name of visible) {
      await expect(
        page
          .getByRole("button", { name, exact: true })
          .or(page.getByRole("link", { name, exact: true }))
          .first(),
        `${name} at ${width}px`,
      ).toBeVisible();
    }
    await expectNoHorizontalScroll(page);
    await expectTapTargets(page);
  }
  if (viewport) await page.setViewportSize(viewport);
}

/** Monaco wraps long lines on phones, so no code hides past the right edge. */
export async function expectEditorWraps(page: Page) {
  const lines = page.locator(".monaco-editor .view-lines").first();
  await expect(lines).toBeVisible();
  const hidden = await page
    .locator(".monaco-editor .monaco-scrollable-element")
    .first()
    .evaluate((editor) => {
      const lines = editor.querySelector(".view-lines");
      return lines ? lines.scrollWidth - editor.clientWidth : 0;
    });
  expect(hidden).toBeLessThanOrEqual(0);
}
