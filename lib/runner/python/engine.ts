import type { PyodideInterface } from "pyodide";
import type { HarnessOutcome } from "@/lib/runner/js/harness";

export interface PythonInput {
  code: string;
  tests: string;
  maxOutputChars: number;
}

/**
 * Runs one puzzle through the harness installed by `PYTHON_HARNESS`. Never
 * throws: a crash inside Pyodide becomes an `error` outcome.
 *
 * Must stay self-contained (see `runHarness`): the Node entry point ships it
 * to a worker thread as source text, so both environments run the same code.
 */
export function runPuzzle(
  pyodide: PyodideInterface,
  input: PythonInput,
): HarnessOutcome {
  const run = pyodide.globals.get("run_puzzle");
  try {
    return JSON.parse(
      run(input.code, input.tests, input.maxOutputChars),
    ) as HarnessOutcome;
  } catch (error) {
    return {
      status: "error",
      tests: [],
      output: "",
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    run.destroy();
  }
}
