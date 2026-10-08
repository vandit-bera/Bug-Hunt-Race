/**
 * Code-runner plug-in interface. Each language ships one `CodeRunner`;
 * adding a language means adding a config entry, a runner, and puzzles.
 * Implementations land in Phase 2 (JS/TS: Web Worker, Python: Pyodide).
 */

export type LanguageId = "javascript" | "typescript" | "python";

export interface LanguageConfig {
  id: LanguageId;
  /** Shown in the UI, e.g. "TypeScript". */
  label: string;
  /** Monaco editor language id. */
  monacoLanguage: string;
  /** File extension used by puzzle files, without the dot. */
  fileExtension: string;
}

export interface RunRequest {
  language: LanguageId;
  /** The player's (or reference) source code. */
  code: string;
  /** Test source in the same language, run against `code`. */
  tests: string;
  /** Hard wall-clock limit. Defaults to `DEFAULT_RUN_TIMEOUT_MS`. */
  timeoutMs?: number;
}

export interface TestCaseResult {
  name: string;
  passed: boolean;
  /** Assertion or error message when the test failed. */
  message?: string;
}

/**
 * - `passed`: every test passed.
 * - `failed`: code ran, at least one test failed.
 * - `error`: code could not run (syntax error, uncaught crash, runner failure).
 * - `timeout`: killed after `timeoutMs`.
 */
export type RunStatus = "passed" | "failed" | "error" | "timeout";

export interface RunResult {
  status: RunStatus;
  tests: TestCaseResult[];
  /** Captured console output, truncated to `MAX_OUTPUT_CHARS`. */
  output: string;
  /** Set when `status` is `error` or `timeout`. */
  error?: string;
  durationMs: number;
}

export interface CodeRunner {
  readonly language: LanguageId;
  /** Never rejects: failures are reported through `RunResult.status`. */
  run(request: RunRequest): Promise<RunResult>;
  /** Releases the worker or interpreter, if any. */
  dispose(): void;
}
