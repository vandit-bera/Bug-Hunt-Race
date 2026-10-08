"use client";

import { useReducedMotion } from "@/components/fx/use-reduced-motion";

const PIECES = 48;
const COLORS = [
  "var(--primary)",
  "var(--accent)",
  "var(--warning)",
  "var(--danger)",
  "var(--success)",
];

// Fixed pseudo-random spread, so the burst looks the same on every render.
function spread(index: number, salt: number): number {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** A one-off burst of falling confetti over the page. Renders nothing under reduced motion. */
export function Confetti() {
  const reduced = useReducedMotion();
  if (reduced) return null;

  return (
    <div
      aria-hidden="true"
      data-testid="confetti"
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      {Array.from({ length: PIECES }, (_, i) => (
        <span
          key={i}
          className="absolute -top-4 h-3 w-2 animate-[confetti-fall_var(--dur)_ease-in_var(--delay)_forwards] rounded-sm"
          style={
            {
              left: `${spread(i, 1) * 100}%`,
              background: COLORS[i % COLORS.length],
              "--dur": `${1800 + spread(i, 2) * 1400}ms`,
              "--delay": `${spread(i, 3) * 400}ms`,
              "--drift": `${(spread(i, 4) - 0.5) * 240}px`,
              "--spin": `${(spread(i, 5) - 0.5) * 1080}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
