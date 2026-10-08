import { expect, test, type Page } from "@playwright/test";
import { MAX_OUTPUT_CHARS } from "@/lib/runner/config";
import { runInNode } from "@/lib/runner/node";
import { RUNNER_CASES } from "@/lib/runner/test-cases";
import type { RunRequest, RunResult } from "@/lib/runner/types";

type BrowserResult = Omit<RunResult, "durationMs">;

async function startRun(page: Page, request: RunRequest) {
  await page.getByLabel("Language").selectOption(request.language);
  await page.getByLabel("Timeout (ms)").fill(String(request.timeoutMs ?? 5000));
  await page.getByLabel("Code").fill(request.code);
  await page.getByLabel("Tests").fill(request.tests);
  await page.getByRole("button", { name: "Run tests" }).click();
}

async function readResult(page: Page): Promise<BrowserResult> {
  const json = page.getByTestId("run-result-json");
  await expect(json).toBeAttached({ timeout: 15_000 });
  return JSON.parse((await json.textContent()) ?? "") as BrowserResult;
}

async function runInBrowser(page: Page, request: RunRequest) {
  await startRun(page, request);
  return readResult(page);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/dev/runner");
  await expect(
    page.getByRole("heading", { level: 1, name: "Runner lab" }),
  ).toBeVisible();
});

test("an infinite loop times out at ~5s and the page stays responsive", async ({
  page,
}) => {
  await startRun(page, {
    language: "javascript",
    code: "while (true) {}",
    tests: 'test("never", () => {});',
  });
  await expect(page.getByRole("button", { name: "Run tests" })).toBeDisabled();

  // The main thread keeps handling input while the worker spins.
  const counter = page.getByRole("button", { name: /^Clicks:/ });
  for (let i = 1; i <= 3; i++) {
    await counter.click();
    await expect(counter).toHaveText(`Clicks: ${i}`, { timeout: 500 });
  }
  await expect(page.getByRole("button", { name: "Run tests" })).toBeDisabled();

  const result = await readResult(page);
  expect(result).toMatchObject({
    status: "timeout",
    error: "Time limit exceeded (5s). Look for an infinite loop.",
  });
  const duration = Number.parseInt(
    (await page.getByTestId("run-duration").textContent()) ?? "",
    10,
  );
  expect(duration).toBeGreaterThanOrEqual(5_000);
  expect(duration).toBeLessThan(6_500);

  // A fresh worker per run: the next run works normally.
  const next = await runInBrowser(page, {
    language: "javascript",
    code: "",
    tests: 'test("ok", () => {});',
  });
  expect(next.status).toBe("passed");
});

test("network APIs are blocked, including cross-origin import()", async ({
  context,
  page,
  baseURL,
}) => {
  // Same server, different origin. Any request that is not blocked in the
  // worker reaches this route, so `reached` proves nothing left the sandbox.
  const crossOrigin = new URL(baseURL ?? "").origin.replace(
    "localhost",
    "127.0.0.1",
  );
  const reached: string[] = [];
  await context.route("**/runner-sentinel*", async (route) => {
    reached.push(route.request().url());
    await route.fulfill({
      contentType: "text/javascript",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: "export {};",
    });
  });

  const result = await runInBrowser(page, {
    language: "javascript",
    code: "",
    tests: [
      'test("fetch", async () => { await fetch("/runner-sentinel"); });',
      'test("xhr", () => { new XMLHttpRequest(); });',
      'test("ws", () => { new WebSocket("ws://localhost/runner-sentinel"); });',
      'test("sse", () => { new EventSource("/runner-sentinel"); });',
      'test("importScripts", () => { importScripts("/runner-sentinel.js"); });',
      `test("import()", async () => { await import("${crossOrigin}/runner-sentinel.js"); });`,
      'test("storage", () => { indexedDB.open("x"); });',
      'test("dom", () => { document.title = "x"; });',
    ].join("\n"),
  });

  expect(result.status).toBe("failed");
  const messages = Object.fromEntries(
    result.tests.map((t) => [t.name, t.passed ? "passed" : t.message]),
  );
  expect(messages).toEqual({
    fetch: "Error: fetch is blocked in the sandbox",
    xhr: "Error: XMLHttpRequest is blocked in the sandbox",
    ws: "Error: WebSocket is blocked in the sandbox",
    sse: "Error: EventSource is blocked in the sandbox",
    importScripts: "Error: importScripts is blocked in the sandbox",
    "import()": expect.stringMatching(/^TypeError: /),
    storage: "Error: indexedDB is blocked in the sandbox",
    dom: "ReferenceError: document is not defined",
  });
  expect(reached).toEqual([]);
});

test("output over the cap is truncated", async ({ page }) => {
  const result = await runInBrowser(page, {
    language: "javascript",
    code: 'for (let i = 0; i < 100000; i++) console.log("line", i);',
    tests: 'test("noop", () => {});',
  });
  expect(result.output).toMatch(
    new RegExp(`… output truncated at ${MAX_OUTPUT_CHARS} characters$`),
  );
  expect(result.output.length).toBeLessThan(MAX_OUTPUT_CHARS + 100);
});

async function pickLanguage(page: Page, language: string) {
  await page.getByLabel("Language").selectOption(language);
  await expect(page.getByTestId("preload-status")).toHaveText(
    `${language} runner: ready`,
    { timeout: 30_000 },
  );
}

test("Python: an infinite loop times out at ~5s, the page stays responsive and the next run works", async ({
  page,
}) => {
  await pickLanguage(page, "python");
  await startRun(page, {
    language: "python",
    code: "while True:\n    pass",
    tests: "def test_never():\n    pass",
  });
  await expect(page.getByRole("button", { name: "Run tests" })).toBeDisabled();

  const counter = page.getByRole("button", { name: /^Clicks:/ });
  for (let i = 1; i <= 3; i++) {
    await counter.click();
    await expect(counter).toHaveText(`Clicks: ${i}`, { timeout: 500 });
  }

  const result = await readResult(page);
  expect(result).toMatchObject({
    status: "timeout",
    error: "Time limit exceeded (5s). Look for an infinite loop.",
  });
  const duration = Number.parseInt(
    (await page.getByTestId("run-duration").textContent()) ?? "",
    10,
  );
  expect(duration).toBeGreaterThanOrEqual(5_000);
  expect(duration).toBeLessThan(6_500);

  // The killed worker is replaced by the warm spare, so this is fast.
  const startedAt = Date.now();
  const next = await runInBrowser(page, {
    language: "python",
    code: "def one():\n    return 1",
    tests: "def test_one():\n    assert one() == 1",
  });
  expect(next.status).toBe("passed");
  expect(Date.now() - startedAt).toBeLessThan(3_000);
});

test("Python: network paths fail, including cross-origin import()", async ({
  context,
  page,
  baseURL,
}) => {
  // Same server, different origin: anything that is not blocked reaches this.
  const crossOrigin = new URL(baseURL ?? "").origin.replace(
    "localhost",
    "127.0.0.1",
  );
  const reached: string[] = [];
  await context.route("**/runner-sentinel*", async (route) => {
    reached.push(route.request().url());
    await route.fulfill({
      contentType: "text/javascript",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: "export {};",
    });
  });

  const result = await runInBrowser(page, {
    language: "python",
    code: "",
    tests: [
      "def test_urllib():",
      "    import urllib.request",
      `    urllib.request.urlopen("${crossOrigin}/runner-sentinel")`,
      "def test_socket():",
      "    import socket",
      "    socket.create_connection(('127.0.0.1', 80))",
      "def test_fetch():",
      "    import js",
      `    js.fetch("${crossOrigin}/runner-sentinel")`,
      "def test_import():",
      "    import js",
      `    js.eval('import("${crossOrigin}/runner-sentinel.js")')`,
    ].join("\n"),
  });

  const passed = result.tests.filter((t) => t.passed).map((t) => t.name);
  // import() returns a promise instead of throwing; the CSP rejects it.
  expect(passed).toEqual(["test_import"]);
  await page.waitForTimeout(500);
  expect(reached).toEqual([]);
});

test("Python: preload reports progress, then a second run is fast", async ({
  page,
}) => {
  const wasm = page.waitForResponse((r) => r.url().endsWith(".asm.wasm"));
  const values: number[] = [];
  await page.getByLabel("Language").selectOption("python");
  const bar = page.getByRole("progressbar", {
    name: "Loading the python runner",
  });
  // The bar can vanish between samples; a short timeout ends the loop instead of hanging.
  for (;;) {
    const value = await bar
      .getAttribute("value", { timeout: 500 })
      .catch(() => null);
    if (value === null) break;
    values.push(Number(value));
    await page.waitForTimeout(50);
  }
  await expect(page.getByTestId("preload-status")).toHaveText(
    "python runner: ready",
    { timeout: 30_000 },
  );
  expect(values.length).toBeGreaterThan(0);
  expect(values).toEqual([...values].sort((a, b) => a - b));

  // Versioned, immutable: the browser never downloads it twice.
  expect((await wasm).headers()["cache-control"]).toContain("immutable");

  const request = {
    language: "python",
    code: "def one():\n    return 1",
    tests: "def test_one():\n    assert one() == 1",
  } as const;
  const startedAt = Date.now();
  expect((await runInBrowser(page, request)).status).toBe("passed");
  expect(Date.now() - startedAt).toBeLessThan(2_000);
});

for (const runnerCase of RUNNER_CASES) {
  test(`browser matches Node: ${runnerCase.name}`, async ({ page }) => {
    const browser = await runInBrowser(page, runnerCase.request);
    const { durationMs, ...node } = await runInNode(runnerCase.request);
    expect(durationMs).toBeGreaterThanOrEqual(0);
    expect(browser).toEqual(node);
    expect(browser).toMatchObject(runnerCase.expected);
  });
}
