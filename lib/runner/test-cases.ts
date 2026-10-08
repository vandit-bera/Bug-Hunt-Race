import type { RunRequest, RunResult } from "./types";

/**
 * Requests that must give the same result in the browser (E2E) and in Node
 * (unit tests). Each lists the parts of the result it pins down.
 */
export interface RunnerCase {
  name: string;
  request: RunRequest;
  expected: Partial<Omit<RunResult, "durationMs">>;
}

const ADD_TESTS = `test("adds", () => {
  expect(add(2, 3)).toBe(5);
});
test("adds negatives", () => {
  expect(add(-2, -3)).toBe(-5);
});`;

export const RUNNER_CASES: RunnerCase[] = [
  {
    name: "JS: correct code passes",
    request: {
      language: "javascript",
      code: "function add(a, b) {\n  return a + b;\n}",
      tests: ADD_TESTS,
    },
    expected: {
      status: "passed",
      tests: [
        { name: "adds", passed: true },
        { name: "adds negatives", passed: true },
      ],
      output: "",
    },
  },
  {
    name: "JS: wrong code fails with per-test messages",
    request: {
      language: "javascript",
      code: "function add(a, b) {\n  return a - b;\n}",
      tests: ADD_TESTS,
    },
    expected: {
      status: "failed",
      tests: [
        { name: "adds", passed: false, message: "Expected 5, received -1" },
        {
          name: "adds negatives",
          passed: false,
          message: "Expected -5, received 1",
        },
      ],
    },
  },
  {
    name: "TS: types are stripped and correct code passes",
    request: {
      language: "typescript",
      code: "interface Pair { a: number; b: number }\nfunction add(a: number, b: number): number {\n  return a + b;\n}\nconst pair: Pair = { a: 1, b: 2 };",
      tests: ADD_TESTS,
    },
    expected: { status: "passed" },
  },
  {
    name: "TS: type errors do not block the run",
    request: {
      language: "typescript",
      code: 'function add(a: number, b: number): string {\n  return a + b;\n}\nconst unused: number = "nope";',
      tests: ADD_TESTS,
    },
    expected: { status: "passed" },
  },
  {
    name: "TS: wrong code fails",
    request: {
      language: "typescript",
      code: "function add(a: number, b: number): number {\n  return a * b;\n}",
      tests: ADD_TESTS,
    },
    expected: { status: "failed" },
  },
  {
    name: "toEqual and toThrow",
    request: {
      language: "javascript",
      code: 'function parse(s) {\n  if (!s) throw new Error("empty input");\n  return s.split(",").map(Number);\n}',
      tests:
        'test("parses", () => {\n  expect(parse("1,2")).toEqual([1, 2]);\n});\ntest("throws", () => {\n  expect(() => parse("")).toThrow("empty");\n});\ntest("deep mismatch", () => {\n  expect({ list: parse("1") }).toEqual({ list: [2] });\n});',
    },
    expected: {
      status: "failed",
      tests: [
        { name: "parses", passed: true },
        { name: "throws", passed: true },
        {
          name: "deep mismatch",
          passed: false,
          message: "Expected {list: [2]}, received {list: [1]}",
        },
      ],
    },
  },
  {
    name: "Async tests are awaited",
    request: {
      language: "javascript",
      code: "async function double(n) {\n  await null;\n  return n * 2;\n}",
      tests:
        'test("doubles", async () => {\n  expect(await double(4)).toBe(8);\n});',
    },
    expected: { status: "passed" },
  },
  {
    name: "console.log is captured",
    request: {
      language: "javascript",
      code: 'console.log("hello", 42, { a: [1, "x"] });\nconsole.error(null, undefined);',
      tests: 'test("noop", () => {});',
    },
    expected: {
      status: "passed",
      output: 'hello 42 {a: [1, "x"]}\nnull undefined\n',
    },
  },
  {
    name: "Syntax error in the code",
    request: {
      language: "javascript",
      code: "function add(a, b) {\n  return a +;\n}",
      tests: ADD_TESTS,
    },
    expected: {
      status: "error",
      tests: [],
      error: "SyntaxError in your code: Unexpected token (2:13)",
    },
  },
  {
    name: "TS syntax error in the tests",
    request: {
      language: "typescript",
      code: "const x: number = 1;",
      tests: 'test("broken", () => {',
    },
    expected: {
      status: "error",
      error: 'SyntaxError in the tests: Unexpected token, expected "," (1:19)',
    },
  },
  {
    name: "Thrown error at the top level",
    request: {
      language: "javascript",
      code: 'throw new TypeError("boom");',
      tests: ADD_TESTS,
    },
    expected: { status: "error", tests: [], error: "TypeError: boom" },
  },
  {
    name: "Thrown error inside a test fails only that test",
    request: {
      language: "javascript",
      code: "function add(a, b) {\n  return a.b.c + b;\n}",
      tests: ADD_TESTS,
    },
    expected: { status: "failed" },
  },
  {
    name: "No tests",
    request: { language: "javascript", code: "const x = 1;", tests: "" },
    expected: { status: "error", error: "No tests were found" },
  },
  {
    name: "fetch is blocked",
    request: {
      language: "javascript",
      code: "",
      tests:
        'test("fetch", async () => {\n  await fetch("/runner-sentinel");\n});',
    },
    expected: {
      status: "failed",
      tests: [
        {
          name: "fetch",
          passed: false,
          message: "Error: fetch is blocked in the sandbox",
        },
      ],
    },
  },
  {
    name: "XMLHttpRequest and WebSocket are blocked",
    request: {
      language: "javascript",
      code: "",
      tests:
        'test("xhr", () => {\n  new XMLHttpRequest();\n});\ntest("ws", () => {\n  new WebSocket("ws://localhost/runner-sentinel");\n});',
    },
    expected: {
      status: "failed",
      tests: [
        {
          name: "xhr",
          passed: false,
          message: "Error: XMLHttpRequest is blocked in the sandbox",
        },
        {
          name: "ws",
          passed: false,
          message: "Error: WebSocket is blocked in the sandbox",
        },
      ],
    },
  },
  {
    name: "Output over the cap is truncated",
    request: {
      language: "javascript",
      code: 'for (let i = 0; i < 100000; i++) console.log("line", i);',
      tests: 'test("noop", () => {});',
    },
    expected: { status: "passed" },
  },
  {
    name: "Unhandled rejections are ignored",
    request: {
      language: "javascript",
      code: 'Promise.reject(new Error("boom"));',
      tests:
        'test("ok", async () => {\n  await new Promise((r) => setTimeout(r, 50));\n});',
    },
    expected: { status: "passed" },
  },
  {
    name: "Uncaught error in a timer ends the run",
    request: {
      language: "javascript",
      code: 'setTimeout(() => {\n  throw new Error("late");\n}, 0);',
      tests:
        'test("ok", async () => {\n  await new Promise((r) => setTimeout(r, 50));\n});',
    },
    expected: { status: "error", tests: [], error: "Error: late" },
  },
  {
    name: "self is the global scope and close is blocked",
    request: {
      language: "javascript",
      code: "",
      tests:
        'test("self", () => {\n  expect(self).toBe(globalThis);\n});\ntest("close", () => {\n  self.close();\n});',
    },
    expected: {
      status: "failed",
      tests: [
        { name: "self", passed: true },
        {
          name: "close",
          passed: false,
          message: "Error: close is blocked in the sandbox",
        },
      ],
    },
  },
  {
    name: "Node-only globals are blocked",
    request: {
      language: "javascript",
      code: "",
      tests:
        'test("buffer", () => {\n  Buffer.from("x");\n});\ntest("global", () => {\n  global.x = 1;\n});',
    },
    expected: {
      status: "failed",
      tests: [
        {
          name: "buffer",
          passed: false,
          message: "Error: Buffer is blocked in the sandbox",
        },
        {
          name: "global",
          passed: false,
          message: "Error: global is blocked in the sandbox",
        },
      ],
    },
  },
  {
    name: "Stack overflow is an error",
    request: {
      language: "javascript",
      code: "function f() {\n  return f();\n}\nf();",
      tests: 'test("noop", () => {});',
    },
    expected: {
      status: "error",
      error: "RangeError: Maximum call stack size exceeded",
    },
  },
];
