import { Tooltip } from "@/components/ui/tooltip";

export function StreakCounter({ winStreak }: { winStreak: number }) {
  return (
    <Tooltip content="Win streak: puzzles solved in a row">
      <p
        aria-label={`Win streak: ${winStreak}`}
        tabIndex={0}
        className="flex items-center gap-1 rounded-full border-2 border-border px-2.5 py-0.5 font-bold tabular-nums"
      >
        <span aria-hidden="true">🔥</span>
        {winStreak}
      </p>
    </Tooltip>
  );
}
