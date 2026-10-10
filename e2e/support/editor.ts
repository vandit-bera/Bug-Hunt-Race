import { expect, type Page } from "@playwright/test";

/**
 * Replaces the editor content. Select-all does not work in headless
 * Chromium's Monaco, so select from the top to the bottom with the arrow and
 * page keys, then paste (typing would auto-indent Python). Monaco's Firefox
 * input ignores a synthetic paste, but inserts text there without auto-indent.
 */
export async function setCode(page: Page, code: string) {
  await page.locator(".monaco-editor .view-lines").click();
  for (let i = 0; i < 4; i++) await page.keyboard.press("PageUp");
  await page.keyboard.press("Home");
  for (let i = 0; i < 4; i++) await page.keyboard.press("Shift+PageDown");
  await page.keyboard.press("Shift+End");
  await page.keyboard.press("Backspace");
  await expect(page.locator(".monaco-editor .view-line")).toHaveCount(1);
  await expect(page.locator(".monaco-editor .view-lines")).toHaveText(/^\s*$/);
  if (page.context().browser()?.browserType().name() === "firefox") {
    await page.keyboard.insertText(code);
  } else {
    await page.evaluate((text) => {
      const data = new DataTransfer();
      data.setData("text/plain", text);
      document.activeElement?.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: data,
          bubbles: true,
          cancelable: true,
        }),
      );
    }, code);
  }
  await expect(page.locator(".monaco-editor .view-lines")).not.toHaveText(
    /^\s*$/,
  );
}
