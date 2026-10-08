"use client";

import { useEffect, useRef, useState } from "react";

const STEP_MS = 800;

/**
 * Counts `from`…1, then "Go!", and calls `onDone` after "Go!" has shown.
 * `onStep` runs once per number (with the number, or 0 for "Go!") so the
 * caller can play a sound.
 */
export function Countdown({
  from = 3,
  onStep,
  onDone,
}: {
  from?: number;
  onStep?: (value: number) => void;
  onDone: () => void;
}) {
  const [value, setValue] = useState(from);
  const callbacks = useRef({ onStep, onDone });
  useEffect(() => {
    callbacks.current = { onStep, onDone };
  });

  useEffect(() => {
    callbacks.current.onStep?.(value);
    const timer = setTimeout(() => {
      if (value === 0) callbacks.current.onDone();
      else setValue(value - 1);
    }, STEP_MS);
    return () => clearTimeout(timer);
  }, [value]);

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
