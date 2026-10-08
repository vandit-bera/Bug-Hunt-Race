"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { getRunner } from "@/lib/runner/registry";
import type { LanguageId, RunResult } from "@/lib/runner/types";

const LAB_LANGUAGES = ["javascript", "typescript"] as const;

const SAMPLE_CODE = `function add(a, b) {
  return a - b;
}`;

const SAMPLE_TESTS = `test("adds two numbers", () => {
  expect(add(2, 3)).toBe(5);
});`;

const textareaClass =
  "min-h-40 rounded-lg border-2 border-border bg-surface p-3 font-mono text-sm text-foreground focus:border-accent";

export function RunnerLab() {
  const [language, setLanguage] = useState<LanguageId>("javascript");
  const [code, setCode] = useState(SAMPLE_CODE);
  const [tests, setTests] = useState(SAMPLE_TESTS);
  const [timeoutMs, setTimeoutMs] = useState(5_000);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [clicks, setClicks] = useState(0);

  async function run() {
    setRunning(true);
    setResult(null);
    const next = await getRunner(language).run({
      language,
      code,
      tests,
      timeoutMs,
    });
    setResult(next);
    setRunning(false);
  }

  const { durationMs, ...comparable } = result ?? { durationMs: 0 };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Language
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value as LanguageId)}
            className="h-11 rounded-lg border-2 border-border bg-surface px-3 font-normal"
          >
            {LAB_LANGUAGES.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Timeout (ms)
          <input
            type="number"
            min={100}
            step={100}
            value={timeoutMs}
            onChange={(event) => setTimeoutMs(Number(event.target.value))}
            className="h-11 w-32 rounded-lg border-2 border-border bg-surface px-3 font-normal"
          />
        </label>
        <Button onClick={run} loading={running}>
          Run tests
        </Button>
        <Button variant="secondary" onClick={() => setClicks((n) => n + 1)}>
          Clicks: {clicks}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Code
          <textarea
            value={code}
            onChange={(event) => setCode(event.target.value)}
            spellCheck={false}
            className={textareaClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Tests
          <textarea
            value={tests}
            onChange={(event) => setTests(event.target.value)}
            spellCheck={false}
            className={textareaClass}
          />
        </label>
      </div>

      {result && (
        <Card aria-label="Result" role="region">
          <CardTitle>
            Status: <span data-testid="run-status">{result.status}</span>
          </CardTitle>
          <p className="text-sm text-muted" data-testid="run-duration">
            {durationMs} ms
          </p>
          {result.error && (
            <p className="mt-2 font-mono text-sm text-danger">{result.error}</p>
          )}
          <ul className="mt-3 flex flex-col gap-2">
            {result.tests.map((testResult, index) => (
              <li key={index} className="flex flex-wrap items-center gap-2">
                <Badge variant={testResult.passed ? "success" : "danger"}>
                  {testResult.passed ? "pass" : "fail"}
                </Badge>
                <span>{testResult.name}</span>
                {testResult.message && (
                  <span className="font-mono text-sm text-muted">
                    {testResult.message}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {result.output && (
            <pre className="mt-3 max-h-60 overflow-auto rounded-lg bg-surface-raised p-3 font-mono text-sm">
              {result.output}
            </pre>
          )}
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-muted">
              Raw result
            </summary>
            <pre data-testid="run-result-json" className="font-mono text-xs">
              {JSON.stringify(comparable)}
            </pre>
          </details>
        </Card>
      )}
    </div>
  );
}
