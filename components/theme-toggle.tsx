"use client";

import { cn } from "@/components/ui/cn";
import { THEMES, type Theme } from "@/lib/theme/theme";
import { useTheme } from "@/lib/theme/use-theme";

const LABELS: Record<Theme, string> = {
  light: "☀️ Light",
  dark: "🌙 Dark",
  system: "💻 System",
};

export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex rounded-lg border-2 border-border bg-surface p-1"
    >
      {THEMES.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={theme === option}
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
