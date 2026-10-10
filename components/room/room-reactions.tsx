"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/components/fx/use-reduced-motion";
import type { ReactionMessage } from "@/lib/game/reactions";
import {
  addCapped,
  REACTION_EMOJIS,
  REACTION_FLOAT_MS,
} from "@/lib/game/room-fun";
import {
  createReactionHub,
  type ReactionHub,
  type ReactionListener,
} from "@/lib/rooms";
import { playSound } from "@/lib/sound/sounds";
import { FloatingReactions, type FloatingReaction } from "./floating-reactions";
import { ReactionBar } from "./reaction-bar";

/** At most one reaction sound this often, however many arrive. */
const SOUND_GAP_MS = 400;

let nextId = 0;

/**
 * The room's reactions: the bar to send them and what everyone sent, floating
 * up from the bottom of the screen (or, under reduced motion, a small counter
 * next to the bar). Reactions are never stored: a player sees those sent
 * while they have the room open.
 */
export function RoomReactions({
  selfId,
  memberIds,
  onlineCount,
  sendReaction,
  subscribeReactions,
}: {
  selfId: string;
  memberIds: readonly string[];
  onlineCount: number;
  sendReaction: (message: ReactionMessage) => boolean;
  subscribeReactions: (listener: ReactionListener) => () => void;
}) {
  const reducedMotion = useReducedMotion();
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const hub = useRef<ReactionHub | null>(null);
  // The hub reads the latest room state through these, so it is not rebuilt
  // (losing its rate-limit history) every time a player joins.
  const members = useRef<ReadonlySet<string>>(new Set());
  const online = useRef(1);
  useEffect(() => {
    members.current = new Set(memberIds);
    online.current = Math.max(onlineCount, 1);
  }, [memberIds, onlineCount]);

  const expire = useCallback((id: FloatingReaction["id"]) => {
    setReactions((current) => current.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let lastSound = -Infinity;
    const created = createReactionHub({
      selfId,
      send: sendReaction,
      isMember: (id) => members.current.has(id),
      onlineCount: () => online.current,
      onShow: (_sender, emojis) => {
        const added = emojis.map((emoji) => ({
          id: nextId++,
          emoji,
          x: 5 + Math.random() * 85,
        }));
        setReactions((current) =>
          added.reduce((list, item) => addCapped(list, item), current),
        );
        // Floating emoji expire themselves; the counter shown under reduced
        // motion needs these.
        for (const { id } of added) {
          const timer = setTimeout(() => {
            timers.delete(timer);
            expire(id);
          }, REACTION_FLOAT_MS);
          timers.add(timer);
        }
        const now = Date.now();
        if (now - lastSound >= SOUND_GAP_MS) {
          lastSound = now;
          playSound("react");
        }
      },
    });
    const unsubscribe = subscribeReactions(created.receive);
    hub.current = created;
    return () => {
      unsubscribe();
      created.dispose();
      timers.forEach(clearTimeout);
      hub.current = null;
      setReactions([]);
    };
  }, [selfId, sendReaction, subscribeReactions, expire]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ReactionBar onReact={(emoji) => hub.current?.react(emoji)} />
      {reducedMotion ? (
        <ReactionCounter reactions={reactions} />
      ) : (
        <div
          data-testid="floating-reactions"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-40"
        >
          <FloatingReactions reactions={reactions} onExpire={expire} />
        </div>
      )}
    </div>
  );
}

/** Reduced motion: how many of each reaction arrived in the last moments. */
export function ReactionCounter({
  reactions,
}: {
  reactions: readonly FloatingReaction[];
}) {
  const counts = new Map<string, number>();
  for (const { emoji } of reactions) {
    counts.set(emoji, (counts.get(emoji) ?? 0) + 1);
  }
  return (
    <p
      aria-hidden="true"
      data-testid="reaction-counter"
      className="flex min-h-6 gap-2 text-sm font-bold text-muted"
    >
      {REACTION_EMOJIS.filter((emoji) => counts.has(emoji)).map((emoji) => (
        <span key={emoji}>
          {emoji} ×{counts.get(emoji)}
        </span>
      ))}
    </p>
  );
}
