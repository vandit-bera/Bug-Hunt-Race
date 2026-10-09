"use client";

import { useEffect, useRef, useState } from "react";
import { COUNTDOWN_STEP_MS } from "@/lib/game/race-fx";

/**
 * Counts `from`…1, then "Go!", and calls `onDone` after "Go!" has shown.
 * `onStep` runs once per number (with the number, or 0 for "Go!") so the
 * caller can play a sound. `elapsedMs` starts part-way through, so screens
 * that share a start time show the same number.
 */
export function Countdown({
  from = 3,
  elapsedMs = 0,
  onStep,
  onDone,
}: {
  from?: number;
  elapsedMs?: number;
  onStep?: (value: number) => void;
  onDone: () => void;
}) {
  const [startedAt] = useState(() => performance.now() - elapsedMs);
  const [value, setValue] = useState(() =>
    Math.max(0, from - Math.floor(elapsedMs / COUNTDOWN_STEP_MS)),
  );
  const callbacks = useRef({ onStep, onDone });
  useEffect(() => {
    callbacks.current = { onStep, onDone };
  });

  useEffect(() => {
    callbacks.current.onStep?.(value);
    const stepEndsAt = startedAt + (from - value + 1) * COUNTDOWN_STEP_MS;
    const timer = setTimeout(
      () => {
        if (value === 0) callbacks.current.onDone();
        else setValue(value - 1);
      },
      Math.max(0, stepEndsAt - performance.now()),
    );
    return () => clearTimeout(timer);
  }, [value, from, startedAt]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <p className="text-muted">Get ready…</p>
      <p
        role="status"
        aria-label={value === 0 ? "Go!" : String(value)}
        // key restarts the pop animation for every number.
        key={value}
        className="animate-[countdown-pop_800ms_ease-out] font-display text-8xl font-bold text-primary"
      >
        {value === 0 ? "Go!" : value}
      </p>
    </div>
  );
}
