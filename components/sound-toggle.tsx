"use client";

import { useEffect } from "react";
import { cn } from "@/components/ui/cn";
import { armSound } from "@/lib/sound/sound-store";
import { useMuted } from "@/lib/sound/use-muted";

export function SoundToggle({ className }: { className?: string }) {
  const [muted, setMuted] = useMuted();
  useEffect(armSound, []);

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
      <span aria-hidden="true">{muted ? "🔇 Muted" : "🔊 Sound"}</span>
    </button>
  );
}
