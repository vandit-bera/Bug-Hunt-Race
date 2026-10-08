"use client";

import { Button } from "@/components/ui/button";
import { preloadRunner } from "@/lib/runner/preload";
import { usePreloadState } from "@/lib/runner/use-preload-state";
import type { LanguageId } from "@/lib/runner/types";

/** Download progress of a language's runner. Renders nothing once ready. */
export function RunnerLoadingBar({ language }: { language: LanguageId }) {
  const state = usePreloadState(language);
  if (state.status === "ready") return null;

  if (state.status === "error") {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-danger p-3 text-sm"
      >
        <span>{state.error ?? "Could not load the runner."} Try again.</span>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void preloadRunner(language)}
        >
          Retry
        </Button>
      </div>
    );
  }

  const percent = Math.round(state.progress * 100);
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <label htmlFor={`preload-${language}`} className="font-bold">
        Loading Python… {percent}%
      </label>
      <progress
        id={`preload-${language}`}
        value={percent}
        max={100}
        className="h-3 w-full overflow-hidden rounded-full accent-primary"
      />
    </div>
  );
}
