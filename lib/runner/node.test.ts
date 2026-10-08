import { describe, expect, it } from "vitest";
import { MAX_OUTPUT_CHARS } from "./config";
import { createNodeRunner, runInNode } from "./node";
import { RUNNER_CASES } from "./test-cases";

describe("Node runner", () => {
  it.each(RUNNER_CASES)("$name", async ({ request, expected }) => {
    const result = await runInNode(request);
    expect(result).toMatchObject(expected);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("kills an infinite loop at the timeout", async () => {
    const result = await runInNode({
      language: "javascript",
      code: "while (true) {}",
      tests: 'test("never", () => {});',
      timeoutMs: 300,
    });
    expect(result.status).toBe("timeout");
    expect(result.error).toMatch(/Time limit exceeded/);
    expect(result.durationMs).toBeGreaterThanOrEqual(290);
    expect(result.durationMs).toBeLessThan(2_000);
  });

  it("kills a test that never settles", async () => {
    const result = await runInNode({
      language: "javascript",
      code: "",
      tests: 'test("hangs", () => new Promise(() => {}));',
      timeoutMs: 300,
    });
    expect(result.status).toBe("timeout");
  });

  it("truncates output over the cap", async () => {
    const result = await runInNode({
      language: "javascript",
      code: 'for (let i = 0; i < 100000; i++) console.log("line", i);',
      tests: 'test("noop", () => {});',
    });
    expect(result.output).toMatch(
      new RegExp(`… output truncated at ${MAX_OUTPUT_CHARS} characters$`),
    );
    expect(result.output.length).toBeLessThan(MAX_OUTPUT_CHARS + 100);
  });

  it("blocks process access", async () => {
    const result = await runInNode({
      language: "javascript",
      code: "process.exit(1);",
      tests: 'test("noop", () => {});',
    });
    expect(result).toMatchObject({
      status: "error",
      error: "Error: process is blocked in the sandbox",
    });
  });

  it("refuses a request for another language", async () => {
    const result = await createNodeRunner("javascript").run({
      language: "typescript",
      code: "",
      tests: "",
    });
    expect(result).toMatchObject({
      status: "error",
      error: "This runner runs javascript, not typescript",
    });
  });

  it("kills a Python infinite loop at the timeout", async () => {
    const result = await runInNode({
      language: "python",
      code: "while True:\n    pass",
      tests: "def test_never():\n    pass",
      timeoutMs: 500,
    });
    expect(result.status).toBe("timeout");
    expect(result.error).toMatch(/Time limit exceeded/);
    // Booting Pyodide is not part of the run.
    expect(result.durationMs).toBeGreaterThanOrEqual(490);
    expect(result.durationMs).toBeLessThan(1_500);
  });

  it("truncates Python output over the cap", async () => {
    const result = await runInNode({
      language: "python",
      code: 'for i in range(100000):\n    print("line", i)',
      tests: "def test_noop():\n    pass",
    });
    expect(result.output).toMatch(
      new RegExp(`… output truncated at ${MAX_OUTPUT_CHARS} characters$`),
    );
    expect(result.output.length).toBeLessThan(MAX_OUTPUT_CHARS + 100);
  });

  it("blocks Node access from Python", async () => {
    const result = await runInNode({
      language: "python",
      code: "",
      tests:
        "def test_process():\n    import js\n    js.process.exit(1)\ndef test_urllib():\n    import urllib.request\n    urllib.request.urlopen('http://localhost/runner-sentinel')",
    });
    expect(result.status).toBe("failed");
    expect(result.tests[0].message).toBe(
      "JsException: Error: process is blocked in the sandbox",
    );
    expect(result.tests[1].passed).toBe(false);
  });

  it("refuses a Python request on a JS runner", async () => {
    const result = await createNodeRunner("javascript").run({
      language: "python",
      code: "",
      tests: "",
    });
    expect(result).toMatchObject({
      status: "error",
      error: "This runner runs javascript, not python",
    });
  });
});
