"use client";

import { useEffect } from "react";
import { cn } from "@/components/ui/cn";

export type SolveToastData = {
  id: number | string;
  name: string;
  emoji: string;
  seconds: number;
  /** 1-based finishing place. Places 1 to 3 get a medal. */
  rank: number;
};

const MEDALS: Record<number, { icon: string; label: string }> = {
  1: { icon: "🥇", label: "1st place" },
  2: { icon: "🥈", label: "2nd place" },
  3: { icon: "🥉", label: "3rd place" },
};
const SOLVE_TOAST_MS = 5000;

function SolveToast({
  toast,
  onDismiss,
}: {
  toast: SolveToastData;
  onDismiss: (id: SolveToastData["id"]) => void;
}) {
  const { id } = toast;
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(id), SOLVE_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [id, onDismiss]);

  const medal = MEDALS[toast.rank];
  return (
    <li
      className={cn(
        "pointer-events-auto flex items-center gap-2 rounded-lg border-2 bg-surface-raised px-3 py-2 font-bold text-foreground motion-safe:animate-[toast-in_200ms_ease-out]",
        medal ? "border-warning" : "border-success",
      )}
    >
      <span aria-hidden="true">{toast.emoji}</span>
      <span className="flex-1">
        {toast.name} fixed it in {toast.seconds}s!{" "}
        <span aria-hidden="true">⚡</span>
      </span>
      {medal && (
        <span role="img" aria-label={medal.label} className="text-xl">
          {medal.icon}
        </span>
      )}
    </li>
  );
}

/** Stacked live toasts, newest at the bottom. Each one dismisses itself. */
export function SolveToasts({
  toasts,
  onDismiss,
}: {
  toasts: readonly SolveToastData[];
  onDismiss: (id: SolveToastData["id"]) => void;
}) {
  return (
    <ul
      role="status"
      aria-live="polite"
      className="pointer-events-none flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((toast) => (
        <SolveToast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </ul>
  );
}
