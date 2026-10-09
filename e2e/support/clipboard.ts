import type { BrowserContext, Page } from "@playwright/test";

declare global {
  interface Window {
    __copiedText?: string;
  }
}

/**
 * Lets pages in `context` copy, and `readClipboard` check what they copied.
 * Only Chromium can grant clipboard permissions. WebKit copies from a click
 * without one but never lets a test read the clipboard back, so there the
 * real `writeText` is wrapped to remember its text.
 */
export async function allowClipboard(
  context: BrowserContext,
  browserName: string,
) {
  if (browserName === "chromium") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    return;
  }
  await context.addInitScript(() => {
    const writeText = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = async (text) => {
      await writeText(text);
      window.__copiedText = text;
    };
  });
}

/** The text last copied by the page. Call `allowClipboard` first. */
export async function readClipboard(page: Page, browserName: string) {
  return browserName === "chromium"
    ? page.evaluate(() => navigator.clipboard.readText())
    : page.evaluate(() => window.__copiedText);
}
