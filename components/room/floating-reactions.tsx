"use client";

import { useEffect } from "react";
import { capNewest, MAX_FLOATING_REACTIONS } from "@/lib/game/room-fun";

export type FloatingReaction = {
  id: number | string;
  emoji: string;
  /** Horizontal position, 0 to 100 (percent). */
  x: number;
};

const FLOAT_MS = 2500;

function FloatingEmoji({
  reaction,
  onExpire,
}: {
  reaction: FloatingReaction;
  onExpire: (id: FloatingReaction["id"]) => void;
}) {
  const { id } = reaction;
  useEffect(() => {
    const timer = window.setTimeout(() => onExpire(id), FLOAT_MS);
    return () => window.clearTimeout(timer);
  }, [id, onExpire]);

  return (
    <span
      className="absolute bottom-0 text-4xl motion-reduce:hidden motion-safe:animate-[float-up_2500ms_ease-out_forwards]"
      style={{ left: `${reaction.x}%` }}
    >
      {reaction.emoji}
    </span>
  );
}

/** Decorative layer: reactions float up and fade. At most 20 show at once. */
export function FloatingReactions({
  reactions,
  onExpire,
}: {
  reactions: readonly FloatingReaction[];
  onExpire: (id: FloatingReaction["id"]) => void;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none relative h-56 w-full overflow-hidden"
    >
      {capNewest(reactions, MAX_FLOATING_REACTIONS).map((reaction) => (
        <FloatingEmoji
          key={reaction.id}
          reaction={reaction}
          onExpire={onExpire}
        />
      ))}
    </div>
  );
}
