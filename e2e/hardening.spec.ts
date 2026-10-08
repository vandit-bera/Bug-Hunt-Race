import { expect, test, type Page } from "@playwright/test";

/** Monaco's root CSS class; it appears in every chunk that holds Monaco. */
const MONACO_MARKER = "monaco-editor";

/**
 * Records the scripts and styles a page downloads and whether any of them
 * holds Monaco, plus every request for Pyodide's files.
 */
function watchHeavyAssets(page: Page) {
  const seen = { monaco: [] as string[], pyodide: [] as string[] };
  const pending: Promise<void>[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/pyodide/"))
      seen.pyodide.push(request.url());
  });
  page.on("response", (response) => {
    const type = response.request().resourceType();
    if (type !== "script" && type !== "stylesheet") return;
    pending.push(
      response
        .text()
        .then((body) => {
          if (body.includes(MONACO_MARKER)) seen.monaco.push(response.url());
        })
        .catch(() => {}),
    );
  });
  return {
    async settle() {
      await page.waitForLoadState("networkidle");
      await Promise.all(pending);
      return seen;
    },
  };
}

/** Collects CSP violations reported in the page. */
async function watchCspViolations(page: Page) {
  await page.addInitScript(() => {
    const store = window as unknown as { cspViolations: string[] };
    store.cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      store.cspViolations.push(
        `${event.effectiveDirective} blocked ${event.blockedURI || "inline"}`,
      );
    });
  });
  return () =>
    page.evaluate(
      () => (window as unknown as { cspViolations: string[] }).cspViolations,
    );
}

test("Home loads neither Monaco nor Pyodide", async ({ page }) => {
  const assets = watchHeavyAssets(page);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Solo Practice" })).toBeVisible();
  expect(await assets.settle()).toEqual({ monaco: [], pyodide: [] });
});

test("Solo setup loads no Monaco, and Pyodide only once Python is picked", async ({
  page,
}) => {
  const assets = watchHeavyAssets(page);
  await page.goto("/solo");
  await expect(page.getByRole("link", { name: "Start" })).toBeVisible();
  expect(await assets.settle()).toEqual({ monaco: [], pyodide: [] });

  await page.getByLabel("Python", { exact: true }).check();
  await expect
    .poll(async () => (await assets.settle()).pyodide.length)
    .toBeGreaterThan(0);
  expect((await assets.settle()).monaco).toEqual([]);
});

test("the Solo game loads Monaco (the check above can see it)", async ({
  page,
}) => {
  const assets = watchHeavyAssets(page);
  await page.goto("/solo/play?language=javascript&level=easy&round=0");
  await expect(page.locator(".monaco-editor")).toBeVisible();
  expect((await assets.settle()).monaco.length).toBeGreaterThan(0);
});

test("pages send the security headers", async ({ request }) => {
  for (const path of ["/", "/solo", "/solo/play"]) {
    const headers = (await request.get(path)).headers();
    const csp = headers["content-security-policy"];
    expect(csp, path).toContain("frame-ancestors 'none'");
    expect(csp, path).toContain("object-src 'none'");
    expect(csp, path).toMatch(/connect-src 'self'/);
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["referrer-policy"], path).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headers["permissions-policy"], path).toContain("camera=()");
    expect(headers["x-frame-options"], path).toBe("DENY");
  }
});

for (const language of ["javascript", "typescript", "python"] as const) {
  test(`${language}: the game runs under the CSP with no violations`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const violations = await watchCspViolations(page);
    await page.goto(`/solo/play?language=${language}&level=easy&round=0`);
    // The editor appears after the 3-2-1-Go countdown.
    await expect(page.locator(".monaco-editor .view-lines")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Run Tests" }).click();
    // Every puzzle's buggy code fails its tests.
    await expect(page.getByText("Failed: ").first()).toBeAttached({
      timeout: 60_000,
    });
    expect(await violations()).toEqual([]);
  });
}

test("Home headings never skip a level", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const levels = await page
    .locator("h1, h2, h3, h4, h5, h6")
    .evaluateAll((headings) => headings.map((h) => Number(h.tagName[1])));
  for (const [i, level] of levels.entries()) {
    expect(
      level,
      `heading ${i + 1} of ${levels.join(", ")}`,
    ).toBeLessThanOrEqual((levels[i - 1] ?? 0) + 1);
  }
});
