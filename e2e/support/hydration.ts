import { expect, type Locator } from "@playwright/test";

/**
 * Waits until React has hydrated `element`. Input before that stays on the
 * page but never reaches React state, so a form submits an empty name.
 * WebKit loads pages fast enough to hit this.
 */
export async function waitForHydration(element: Locator) {
  // React tags each DOM node it owns with a `__reactFiber$…` key on hydration.
  await expect
    .poll(() =>
      element.evaluate((node) =>
        Object.keys(node).some((key) => key.startsWith("__reactFiber$")),
      ),
    )
    .toBe(true);
}
