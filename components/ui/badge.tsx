import type { HTMLAttributes } from "react";
import { cn } from "./cn";

const variants = {
  neutral: "border-border text-foreground",
  primary: "border-primary text-primary",
  accent: "border-accent text-accent",
  success: "border-success text-success",
  danger: "border-danger text-danger",
  warning: "border-warning text-warning",
};

export function Badge({
  variant = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof variants }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border-2 bg-surface px-2.5 py-0.5 text-xs font-bold",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export const LEVELS = {
  easy: {
    label: "Easy",
    emoji: "🐛",
    color: "border-level-easy text-level-easy",
  },
  medium: {
    label: "Medium",
    emoji: "🐞",
    color: "border-level-medium text-level-medium",
  },
  hard: {
    label: "Hard",
    emoji: "🦂",
    color: "border-level-hard text-level-hard",
  },
} as const;

export type Level = keyof typeof LEVELS;

export function LevelBadge({ level }: { level: Level }) {
  const { label, emoji, color } = LEVELS[level];
  return (
    <Badge className={color}>
      <span aria-hidden="true">{emoji}</span>
      {label}
    </Badge>
  );
}
