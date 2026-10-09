"use client";

import { useEffect, useRef, useState } from "react";
import { CodeEditor } from "@/components/solo/editor-loader";
import { TestResults } from "@/components/solo/test-results";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { LANGUAGES } from "@/lib/runner/config";
import type { LanguageId, RunResult } from "@/lib/runner/types";

export interface PuzzleWorkspaceProps {
  language: LanguageId;
  code: string;
  onCodeChange: (code: string) => void;
  /** Run Tests, the button or Ctrl/Cmd+Enter. Not called behind a dialog. */
  onRun: () => void;
  running: boolean;
  result: RunResult | null;
  hint: string | null;
  hintShown: boolean;
  /** Points the hint costs, shown before the player confirms. */
  hintCost: number;
  onShowHint: () => void;
  onReset: () => void;
  onGiveUp: () => void;
  /** Ignores Run Tests and the shortcut, e.g. while a race is paused. */
  disabled?: boolean;
}

/**
 * The puzzle editor with Run Tests, hint, reset and give up, and the test
 * results. Shared by Solo Practice and race rounds; the caller owns the code,
 * the clock and what a pass or a give-up means.
 */
export function PuzzleWorkspace({
  language,
  code,
  onCodeChange,
  onRun,
  running,
  result,
  hint,
  hintShown,
  hintCost,
  onShowHint,
  onReset,
  onGiveUp,
  disabled = false,
}: PuzzleWorkspaceProps) {
  const [confirm, setConfirm] = useState<"hint" | "giveup" | null>(null);

  // The Ctrl/Cmd+Enter shortcut must not act behind an open confirm dialog.
  const run = useRef(() => {});
  useEffect(() => {
    run.current = () => {
      if (confirm === null && !disabled) onRun();
    };
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        run.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="h-[55vh] min-h-72 overflow-hidden rounded-xl border-2 border-border-subtle">
          <CodeEditor
            value={code}
            language={LANGUAGES[language].monacoLanguage}
            onChange={onCodeChange}
            onRun={() => run.current()}
          />
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => run.current()}
              loading={running}
              disabled={disabled}
            >
              Run Tests
            </Button>
            {hint && (
              <Button
                variant="secondary"
                disabled={hintShown || disabled}
                onClick={() => setConfirm("hint")}
              >
                {hintShown ? "Hint used" : "Hint (costs points)"}
              </Button>
            )}
            <Button variant="ghost" disabled={disabled} onClick={onReset}>
              Reset code
            </Button>
            <Button
              variant="danger"
              disabled={disabled}
              onClick={() => setConfirm("giveup")}
            >
              Give up
            </Button>
          </div>
          <p className="text-xs text-muted">
            Ctrl/Cmd+Enter runs the tests. In the editor, Ctrl+M switches Tab to
            move focus.
          </p>
          {hintShown && hint && (
            <p className="rounded-lg border-2 border-accent p-3 text-sm">
              <span className="font-bold">💡 Hint: </span>
              {hint}
            </p>
          )}
          <TestResults result={result} running={running} />
        </div>
      </div>

      <Modal
        open={confirm === "hint"}
        onClose={() => setConfirm(null)}
        title="Show the hint?"
      >
        <p className="mb-4">
          The hint costs {hintCost} points if you solve the puzzle.
        </p>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setConfirm(null);
              onShowHint();
            }}
          >
            Show hint
          </Button>
          <Button variant="secondary" onClick={() => setConfirm(null)}>
            Keep trying
          </Button>
        </div>
      </Modal>
      <Modal
        open={confirm === "giveup"}
        onClose={() => setConfirm(null)}
        title="Give up?"
      >
        <p className="mb-4">You will score 0 points for this puzzle.</p>
        <div className="flex gap-2">
          <Button
            variant="danger"
            onClick={() => {
              setConfirm(null);
              onGiveUp();
            }}
          >
            Give up
          </Button>
          <Button variant="secondary" onClick={() => setConfirm(null)}>
            Keep trying
          </Button>
        </div>
      </Modal>
    </>
  );
}
