"use client";

import { useReducedMotion } from "@/components/fx/use-reduced-motion";

/** A "+250" that floats up and fades out. Renders nothing under reduced motion. */
export function ScorePopup({ points }: { points: number }) {
  const reduced = useReducedMotion();
  if (reduced) return null;

  return (
    <span
      aria-hidden="true"
      data-testid="score-popup"
      className="pointer-events-none inline-block animate-[score-float_1400ms_ease-out_forwards] font-display text-2xl font-bold text-success"
    >
      +{points}
    </span>
  );
}
