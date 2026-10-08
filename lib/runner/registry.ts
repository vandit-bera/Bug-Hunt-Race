import { openWorkerSession } from "./js/browser-session";
import { PythonRunner } from "./python/runner";
import { SandboxRunner } from "./sandbox-runner";
import type { CodeRunner, LanguageId } from "./types";

/** Browser runners per language. */
const factories: Partial<Record<LanguageId, () => CodeRunner>> = {
  javascript: () => new SandboxRunner("javascript", openWorkerSession),
  typescript: () => new SandboxRunner("typescript", openWorkerSession),
  python: () => new PythonRunner(),
};

const runners = new Map<LanguageId, CodeRunner>();

/** Shared browser runner for `language`. Throws if none is registered yet. */
export function getRunner(language: LanguageId): CodeRunner {
  const existing = runners.get(language);
  if (existing) return existing;
  const create = factories[language];
  if (!create) throw new Error(`No code runner for ${language} yet`);
  const runner = create();
  runners.set(language, runner);
  return runner;
}
