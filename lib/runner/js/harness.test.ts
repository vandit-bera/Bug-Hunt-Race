import { afterEach, describe, expect, it } from "vitest";
import { runHarness } from "./harness";

const originalConsole = globalThis.console;
afterEach(() => {
  globalThis.console = originalConsole;
});

const noCrashes = () => {};

function run(code: string, tests: string, maxOutputChars = 1_000) {
  return runHarness({ code, tests, maxOutputChars }, noCrashes);
}

async function messageOf(assertion: string) {
  const outcome = await run("", `test("t", () => { ${assertion} });`);
  return outcome.tests[0]?.message;
}

describe("runHarness", () => {
  it("runs tests in order and reports each one", async () => {
    const outcome = await run(
      "const double = (n) => n * 2;",
      'test("a", () => expect(double(2)).toBe(4));\ntest("b", () => expect(double(2)).toBe(5));',
    );
    expect(outcome).toEqual({
      status: "failed",
      tests: [
        { name: "a", passed: true },
        { name: "b", passed: false, message: "Expected 5, received 4" },
      ],
      output: "",
    });
  });

  it("toBe uses Object.is", async () => {
    expect(await messageOf("expect(NaN).toBe(NaN)")).toBeUndefined();
    expect(await messageOf("expect(0).toBe(-0)")).toBe(
      "Expected -0, received 0",
    );
    expect(await messageOf("expect([1]).toBe([1])")).toBe(
      "Expected [1], received [1]",
    );
    expect(await messageOf('expect("1").toBe(1)')).toBe(
      'Expected 1, received "1"',
    );
  });

  it("toBe prints booleans as true / false", async () => {
    expect(await messageOf("expect(false).toBe(true)")).toBe(
      "Expected true, received false",
    );
    expect(await messageOf("expect(true).toBe(false)")).toBe(
      "Expected false, received true",
    );
  });

  it.each([
    ["nested objects", "{ a: [1, { b: 2 }] }", "{ a: [1, { b: 2 }] }"],
    ["NaN", "[NaN]", "[NaN]"],
    ["dates", "new Date(5)", "new Date(5)"],
    ["maps", "new Map([[1, [2]]])", "new Map([[1, [2]]])"],
    ["sets", "new Set([1, 2])", "new Set([2, 1])"],
    ["regexps", "/a/g", "/a/g"],
    [
      "circular",
      "(() => { const o = {}; o.o = o; return o; })()",
      "(() => { const o = {}; o.o = o; return o; })()",
    ],
  ])("toEqual matches %s", async (_, actual, expected) => {
    expect(
      await messageOf(`expect(${actual}).toEqual(${expected})`),
    ).toBeUndefined();
  });

  it.each([
    ["a missing key", "{ a: 1 }", "{ a: 1, b: undefined }"],
    ["an extra key", "{ a: 1, b: 2 }", "{ a: 1 }"],
    ["array length", "[1, 2]", "[1]"],
    ["array vs object", "[1]", "{ 0: 1 }"],
    ["different dates", "new Date(1)", "new Date(2)"],
    ["different sets", "new Set([1])", "new Set([2])"],
    ["different maps", "new Map([[1, 1]])", "new Map([[1, 2]])"],
    [
      "class vs plain object",
      "new (class P { constructor() { this.x = 1; } })()",
      "{ x: 1 }",
    ],
  ])("toEqual rejects %s", async (_, actual, expected) => {
    expect(await messageOf(`expect(${actual}).toEqual(${expected})`)).toMatch(
      /^Expected /,
    );
  });

  it("toThrow checks that a function throws, optionally matching", async () => {
    const boom = 'const boom = () => { throw new Error("bad input"); };';
    expect(await messageOf(`${boom} expect(boom).toThrow()`)).toBeUndefined();
    expect(
      await messageOf(`${boom} expect(boom).toThrow("input")`),
    ).toBeUndefined();
    expect(
      await messageOf(`${boom} expect(boom).toThrow(/^bad/)`),
    ).toBeUndefined();
    expect(await messageOf(`${boom} expect(boom).toThrow("other")`)).toBe(
      'Expected an error matching "other", received "bad input"',
    );
    expect(await messageOf("expect(() => 1).toThrow()")).toBe(
      "Expected the function to throw",
    );
    expect(await messageOf("expect(1).toThrow()")).toBe(
      "TypeError: expect(...).toThrow() needs a function",
    );
  });

  it("reports thrown non-errors readably", async () => {
    expect(await messageOf('throw "plain"')).toBe('Thrown: "plain"');
  });

  it("supports top-level await and async tests", async () => {
    const outcome = await run(
      "const value = await Promise.resolve(3);",
      'test("async", async () => expect(await Promise.resolve(value)).toBe(3));',
    );
    expect(outcome.status).toBe("passed");
  });

  it("captures console calls, including via globalThis", async () => {
    const outcome = await run(
      'console.log("a", 1n, -0, Symbol("s"), () => {}, [new Error("e")]);\nglobalThis.console.warn(new Map([[1, new Set([2])]]));',
      'test("noop", () => {});',
    );
    expect(outcome.output).toBe(
      "a 1n -0 Symbol(s) [Function anonymous] [Error: e]\nMap(1) {1 => Set(1) {2}}\n",
    );
  });

  it("caps output and says so", async () => {
    const outcome = await run(
      'for (let i = 0; i < 1000; i++) console.log("0123456789");',
      'test("noop", () => {});',
      50,
    );
    expect(outcome.output).toBe(
      `${"0123456789\n".repeat(5).slice(0, 50)}\n… output truncated at 50 characters`,
    );
  });

  it("returns an error for a syntax error the parser let through", async () => {
    const outcome = await run("const a = 1;", "const a = 2;");
    expect(outcome.status).toBe("error");
    expect(outcome.error).toMatch(/^SyntaxError: /);
  });

  it("returns an error when no tests are registered", async () => {
    expect(await run("", "")).toMatchObject({
      status: "error",
      error: "No tests were found",
    });
  });

  it("rejects bad test registrations", async () => {
    expect(await run("", 'test("no fn");')).toMatchObject({
      status: "error",
      error: 'TypeError: test("no fn") needs a function',
    });
    const nested = await run(
      "",
      'test("outer", () => test("inner", () => {}));',
    );
    expect(nested.tests[0]).toEqual({
      name: "outer",
      passed: false,
      message: "Error: test() can only be called at the top level",
    });
  });

  it("works when shipped as source text", async () => {
    const shipped = new Function(
      `return ${runHarness.toString()}`,
    )() as typeof runHarness;
    const outcome = await shipped(
      {
        code: "const x = 1;",
        tests: 'test("x", () => expect(x).toBe(1));',
        maxOutputChars: 100,
      },
      noCrashes,
    );
    expect(outcome.status).toBe("passed");
  });

  it("ends the run as an error on an uncaught error, keeping output", async () => {
    let report: (error: unknown) => void = () => {};
    const outcome = await runHarness(
      {
        code: 'console.log("before");',
        tests: 'test("waits", () => new Promise(() => {}));',
        maxOutputChars: 100,
      },
      (handler) => {
        report = handler;
        setTimeout(() => report(new RangeError("late")), 0);
      },
    );
    expect(outcome).toEqual({
      status: "error",
      tests: [],
      output: "before\n",
      error: "RangeError: late",
    });
  });

  // Firefox throws InternalError("too much recursion") where Node, Chromium
  // and WebKit throw RangeError("Maximum call stack size exceeded").
  const firefoxOverflow =
    'Object.assign(new Error("too much recursion"), { name: "InternalError" })';

  it("reports Firefox's stack overflow the same way as Node", async () => {
    expect(await run(`throw ${firefoxOverflow};`, "")).toEqual({
      status: "error",
      tests: [],
      output: "",
      error: "RangeError: Maximum call stack size exceeded",
    });
    expect(await messageOf(`throw ${firefoxOverflow}`)).toBe(
      "RangeError: Maximum call stack size exceeded",
    );
  });

  it("keeps other InternalError messages as they are", async () => {
    expect(
      await messageOf(
        'throw Object.assign(new Error("boom"), { name: "InternalError" })',
      ),
    ).toBe("InternalError: boom");
  });
});
