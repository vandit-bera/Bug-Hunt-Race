import type { RunStatus, TestCaseResult } from "@/lib/runner/types";

/** Already-compiled JavaScript, ready for the harness. */
export interface HarnessInput {
  code: string;
  tests: string;
  maxOutputChars: number;
}

/** A `RunResult` without timing; the caller measures wall-clock time. */
export interface HarnessOutcome {
  status: Exclude<RunStatus, "timeout">;
  tests: TestCaseResult[];
  output: string;
  error?: string;
}

/**
 * Runs compiled code plus its tests and reports the outcome. Never rejects.
 *
 * Tests use a tiny Jest-like API: `test(name, fn)` and
 * `expect(x).toBe(y) / .toEqual(y) / .toThrow(match?)`. The code and the tests
 * share one scope, so tests can call anything the code declares.
 *
 * This function must stay self-contained (no references to anything outside
 * its body): the Node entry point ships it to a worker thread as source text
 * via `runHarness.toString()`, so the browser and CI run the exact same code.
 */
export async function runHarness(input: HarnessInput): Promise<HarnessOutcome> {
  type TestFn = () => unknown;

  const describe = (value: unknown, seen: unknown[] = []): string => {
    if (typeof value === "string") return JSON.stringify(value);
    if (typeof value === "bigint") return `${value}n`;
    if (typeof value === "number") {
      return Object.is(value, -0) ? "-0" : String(value);
    }
    if (typeof value === "function") {
      return `[Function ${value.name || "anonymous"}]`;
    }
    if (typeof value === "symbol" || value === null || value === undefined) {
      return String(value);
    }
    if (seen.includes(value)) return "[Circular]";
    const nested = [...seen, value];
    if (value instanceof Error) return `${value.name}: ${value.message}`;
    if (value instanceof Date) return `Date(${value.toISOString()})`;
    if (value instanceof RegExp) return String(value);
    if (Array.isArray(value)) {
      return `[${value.map((item) => describe(item, nested)).join(", ")}]`;
    }
    if (value instanceof Map) {
      const entries = [...value].map(
        ([k, v]) => `${describe(k, nested)} => ${describe(v, nested)}`,
      );
      return `Map(${value.size}) {${entries.join(", ")}}`;
    }
    if (value instanceof Set) {
      const items = [...value].map((item) => describe(item, nested));
      return `Set(${value.size}) {${items.join(", ")}}`;
    }
    const entries = Object.entries(value).map(
      ([key, item]) => `${key}: ${describe(item, nested)}`,
    );
    return `{${entries.join(", ")}}`;
  };

  // Failed `expect` calls read better without an "Error:" prefix.
  const assertionErrors = new WeakSet<Error>();
  const fail = (message: string): never => {
    const error = new Error(message);
    assertionErrors.add(error);
    throw error;
  };
  const errorMessage = (error: unknown): string => {
    if (!(error instanceof Error)) return `Thrown: ${describe(error)}`;
    return assertionErrors.has(error)
      ? error.message
      : `${error.name}: ${error.message}`;
  };

  const deepEqual = (a: unknown, b: unknown, seen: unknown[] = []): boolean => {
    if (Object.is(a, b)) return true;
    if (
      typeof a !== "object" ||
      typeof b !== "object" ||
      a === null ||
      b === null
    ) {
      return false;
    }
    if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
    if (seen.includes(a)) return true;
    const nested = [...seen, a];
    if (a instanceof Date && b instanceof Date) {
      return Object.is(a.getTime(), b.getTime());
    }
    if (a instanceof RegExp && b instanceof RegExp) {
      return String(a) === String(b);
    }
    if (a instanceof Map && b instanceof Map) {
      if (a.size !== b.size) return false;
      for (const [key, item] of a) {
        if (!b.has(key) || !deepEqual(item, b.get(key), nested)) return false;
      }
      return true;
    }
    if (a instanceof Set && b instanceof Set) {
      if (a.size !== b.size) return false;
      for (const item of a) if (!b.has(item)) return false;
      return true;
    }
    if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) {
      return false;
    }
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    const keys = Object.keys(aRecord);
    if (keys.length !== Object.keys(bRecord).length) return false;
    return keys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(bRecord, key) &&
        deepEqual(aRecord[key], bRecord[key], nested),
    );
  };

  let output = "";
  let truncated = false;
  const write = (args: unknown[]) => {
    if (truncated) return;
    const line = args
      .map((arg) => (typeof arg === "string" ? arg : describe(arg)))
      .join(" ");
    output += `${line}\n`;
    if (output.length > input.maxOutputChars) truncated = true;
  };
  const capturedConsole = {
    log: (...args: unknown[]) => write(args),
    info: (...args: unknown[]) => write(args),
    debug: (...args: unknown[]) => write(args),
    warn: (...args: unknown[]) => write(args),
    error: (...args: unknown[]) => write(args),
  };
  Object.defineProperty(globalThis, "console", {
    value: capturedConsole,
    writable: true,
    configurable: true,
  });

  const registered: { name: string; fn: TestFn }[] = [];
  let collecting = true;
  const test = (name: unknown, fn: unknown) => {
    if (!collecting) {
      throw new Error("test() can only be called at the top level");
    }
    if (typeof fn !== "function") {
      throw new TypeError(`test(${describe(name)}) needs a function`);
    }
    registered.push({ name: String(name), fn: fn as TestFn });
  };

  const expect = (actual: unknown) => ({
    toBe(expected: unknown) {
      if (!Object.is(actual, expected)) {
        fail(`Expected ${describe(expected)}, received ${describe(actual)}`);
      }
    },
    toEqual(expected: unknown) {
      if (!deepEqual(actual, expected)) {
        fail(`Expected ${describe(expected)}, received ${describe(actual)}`);
      }
    },
    toThrow(match?: string | RegExp) {
      if (typeof actual !== "function") {
        throw new TypeError("expect(...).toThrow() needs a function");
      }
      let thrown: unknown;
      let didThrow = false;
      try {
        actual();
      } catch (error) {
        didThrow = true;
        thrown = error;
      }
      if (!didThrow) fail("Expected the function to throw");
      if (match === undefined) return;
      const message = thrown instanceof Error ? thrown.message : String(thrown);
      const matches =
        typeof match === "string"
          ? message.includes(match)
          : match.test(message);
      if (!matches) {
        fail(
          `Expected an error matching ${describe(match)}, received ${describe(message)}`,
        );
      }
    },
  });

  const finish = (outcome: Omit<HarnessOutcome, "output">): HarnessOutcome => ({
    ...outcome,
    output: truncated
      ? `${output.slice(0, input.maxOutputChars)}\n… output truncated at ${input.maxOutputChars} characters`
      : output,
  });

  // Same constructor as `async function` declarations; lets tests use await.
  const AsyncFunction = Object.getPrototypeOf(async () => {})
    .constructor as FunctionConstructor;

  let program: (...args: unknown[]) => Promise<unknown>;
  try {
    program = new AsyncFunction(
      "test",
      "expect",
      "console",
      `${input.code}\n;\n${input.tests}`,
    ) as typeof program;
  } catch (error) {
    return finish({ status: "error", tests: [], error: errorMessage(error) });
  }

  try {
    await program(test, expect, capturedConsole);
  } catch (error) {
    return finish({ status: "error", tests: [], error: errorMessage(error) });
  }
  collecting = false;

  if (registered.length === 0) {
    return finish({ status: "error", tests: [], error: "No tests were found" });
  }

  const results: TestCaseResult[] = [];
  for (const { name, fn } of registered) {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (error) {
      results.push({ name, passed: false, message: errorMessage(error) });
    }
  }
  return finish({
    status: results.every((result) => result.passed) ? "passed" : "failed",
    tests: results,
  });
}
