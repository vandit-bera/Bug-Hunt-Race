"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/components/ui/cn";
import { THEMES, type Theme } from "@/lib/theme/theme";
import { useTheme } from "@/lib/theme/use-theme";

const LABELS: Record<Theme, string> = {
  light: "☀️ Light",
  dark: "🌙 Dark",
  system: "💻 System",
};

const STEP: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = STEP[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (THEMES.indexOf(theme) + step + THEMES.length) % THEMES.length;
    setTheme(THEMES[next]);
    buttons.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      onKeyDown={onKeyDown}
      className="inline-flex rounded-lg border-2 border-border bg-surface p-1"
    >
      {THEMES.map((option, index) => (
        <button
          key={option}
          ref={(node) => {
            buttons.current[index] = node;
          }}
          type="button"
          role="radio"
          aria-checked={theme === option}
          tabIndex={theme === option ? 0 : -1}
          onClick={() => setTheme(option)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-bold",
            theme === option
              ? "bg-primary text-primary-foreground"
              : "text-foreground hover:bg-surface-raised",
          )}
        >
          {LABELS[option]}
        </button>
      ))}
    </div>
  );
}
