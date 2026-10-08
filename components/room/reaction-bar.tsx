"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import {
  isCoolingDown,
  REACTION_COOLDOWN_MS,
  REACTION_EMOJIS,
  type ReactionEmoji,
} from "@/lib/game/room-fun";

const LABELS: Record<ReactionEmoji, string> = {
  "😂": "Laugh",
  "🔥": "Fire",
  "👏": "Clap",
  "😱": "Shock",
  "🐛": "Bug",
  "🚀": "Rocket",
};

export function ReactionBar({
  onReact,
}: {
  onReact: (emoji: ReactionEmoji) => void;
}) {
  const lastAt = useRef<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const [cooling, setCooling] = useState(false);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function react(emoji: ReactionEmoji, now: number) {
    if (isCoolingDown(lastAt.current, now)) return;
    lastAt.current = now;
    setCooling(true);
    timer.current = window.setTimeout(
      () => setCooling(false),
      REACTION_COOLDOWN_MS,
    );
    onReact(emoji);
  }

  return (
    <div
      role="group"
      aria-label="Send a reaction"
      className="inline-flex flex-wrap gap-1 rounded-2xl border-2 border-border bg-surface-raised p-1.5 sm:gap-2 sm:rounded-full"
    >
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          aria-label={LABELS[emoji]}
          aria-disabled={cooling}
          onClick={(event) => react(emoji, event.timeStamp)}
          className={cn(
            "size-9 rounded-full text-xl sm:size-10 sm:text-2xl transition-transform duration-100 hover:bg-surface motion-safe:hover:scale-110 motion-safe:active:scale-95",
            cooling && "cursor-not-allowed opacity-50",
          )}
        >
          <span aria-hidden="true">{emoji}</span>
        </button>
      ))}
    </div>
  );
}
