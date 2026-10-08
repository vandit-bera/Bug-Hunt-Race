import { transform } from "sucrase";
import { MAX_OUTPUT_CHARS } from "@/lib/runner/config";
import type { RunRequest } from "@/lib/runner/types";
import type { HarnessInput } from "./harness";

export type JsLanguage = "javascript" | "typescript";

export type CompileResult =
  { ok: true; code: string } | { ok: false; error: string };

/**
 * TypeScript: strips types with sucrase (no type checking, so type errors do
 * not block a run). JavaScript: parsed by the same parser so syntax errors
 * get a line and column. Modern syntax is left as is.
 */
export function compileSource(
  language: JsLanguage,
  source: string,
  label: string,
): CompileResult {
  try {
    const { code } = transform(source, {
      transforms: language === "typescript" ? ["typescript"] : [],
      disableESTransforms: true,
    });
    return { ok: true, code };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `SyntaxError in ${label}: ${message}` };
  }
}

export function isJsLanguage(language: string): language is JsLanguage {
  return language === "javascript" || language === "typescript";
}

/** Compiles a request into harness input, or returns the syntax error. */
export function prepareHarnessInput(
  request: RunRequest,
): { ok: true; input: HarnessInput } | { ok: false; error: string } {
  if (!isJsLanguage(request.language)) {
    return {
      ok: false,
      error: `The JS/TS runner cannot run ${request.language}`,
    };
  }
  const code = compileSource(request.language, request.code, "your code");
  if (!code.ok) return code;
  const tests = compileSource(request.language, request.tests, "the tests");
  if (!tests.ok) return tests;
  return {
    ok: true,
    input: {
      code: code.code,
      tests: tests.code,
      maxOutputChars: MAX_OUTPUT_CHARS,
    },
  };
}
