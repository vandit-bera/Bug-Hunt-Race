"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/components/fx/use-reduced-motion";

const DURATION_MS = 900;

/** Counts up from 0 to `value`. Shows the final value at once under reduced motion. */
export function AnimatedNumber({
  value,
  durationMs = DURATION_MS,
}: {
  value: number;
  durationMs?: number;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min(1, (now - start) / durationMs);
      // Ease out, so the number settles slowly on the final value.
      setShown(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [reduced, value, durationMs]);

  return (
    <>
      <span aria-hidden="true" className="tabular-nums">
        {reduced ? value : shown}
      </span>
      <span className="sr-only">{value}</span>
    </>
  );
}
