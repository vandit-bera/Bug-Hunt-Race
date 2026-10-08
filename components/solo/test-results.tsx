import { Spinner } from "@/components/ui/spinner";
import type { RunResult } from "@/lib/runner/types";

export function TestResults({
  result,
  running,
}: {
  result: RunResult | null;
  running: boolean;
}) {
  return (
    <section aria-label="Test results" aria-live="polite" className="text-sm">
      {running && (
        <p className="flex items-center gap-2">
          <Spinner size="sm" label="Running tests" />
          Running tests…
        </p>
      )}
      {!running && !result && (
        <p className="text-muted">
          Press Run Tests (Ctrl/Cmd+Enter) to check your fix.
        </p>
      )}
      {!running && result && <Outcome result={result} />}
    </section>
  );
}

function Outcome({ result }: { result: RunResult }) {
  return (
    <div className="flex flex-col gap-3">
      {result.error && (
        <p role="alert" className="font-bold text-danger">
          {result.error}
        </p>
      )}
      {result.tests.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {result.tests.map((test) => (
            <li key={test.name} className="flex gap-2">
              <span
                className={test.passed ? "text-success" : "text-danger"}
                aria-hidden="true"
              >
                {test.passed ? "✓" : "✗"}
              </span>
              <span>
                <span className="sr-only">
                  {test.passed ? "Passed: " : "Failed: "}
                </span>
                {test.name}
                {test.message && (
                  <span className="block font-mono text-xs text-muted">
                    {test.message}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {result.output && (
        <div>
          <h3 className="mb-1 font-bold">Console</h3>
          <pre className="max-h-40 overflow-auto rounded-lg bg-surface-raised p-2 font-mono text-xs whitespace-pre-wrap">
            {result.output}
          </pre>
        </div>
      )}
    </div>
  );
}
