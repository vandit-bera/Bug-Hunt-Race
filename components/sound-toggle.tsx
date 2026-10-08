"use client";

import { cn } from "@/components/ui/cn";
import { useMuted } from "@/lib/sound/use-muted";

export function SoundToggle({ className }: { className?: string }) {
  const [muted, setMuted] = useMuted();

  return (
    <button
      type="button"
      aria-pressed={muted}
      aria-label="Mute sound"
      onClick={() => setMuted(!muted)}
      className={cn(
        "rounded-lg border-2 border-border bg-surface px-3 py-2 text-sm font-bold hover:bg-surface-raised",
        className,
      )}
    >
      <span aria-hidden="true">
        {muted ? "🔇" : "🔊"}
        <span className="hidden sm:inline">{muted ? " Muted" : " Sound"}</span>
      </span>
    </button>
  );
}
