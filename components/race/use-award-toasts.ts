"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import {
  ROOM_AWARDS,
  awardKeys,
  awardsOf,
  type PlayerAwards,
} from "@/lib/game/room-awards";

const seenKey = (playerId: string) => `bhr:room-awards-seen:${playerId}`;

/**
 * The award keys this player was already told about. Kept for the tab's
 * session so a reload or a new results screen doesn't repeat a toast.
 */
function readSeen(playerId: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(seenKey(playerId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((key): key is string => typeof key === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

function writeSeen(playerId: string, seen: Set<string>) {
  try {
    sessionStorage.setItem(seenKey(playerId), JSON.stringify([...seen]));
  } catch {
    // Storage full or blocked: the toast may show again, nothing worse.
  }
}

/**
 * A short toast when this player earns a room award (or a longer win
 * streak). Visual only, so mute doesn't apply; reduced motion turns off the
 * toast's slide-in like every other animation (globals.css).
 */
export function useAwardToasts(
  awards: ReadonlyMap<string, PlayerAwards> | null,
  playerId: string,
  game: { gameNumber: number; gameOver: boolean },
) {
  const { gameNumber, gameOver } = game;
  const toast = useToast();

  useEffect(() => {
    if (!awards) return;
    const mine = awardsOf(awards, playerId);
    const seen = readSeen(playerId);
    const keys = awardKeys(mine, { gameNumber, gameOver });
    const fresh = keys.filter((key) => !seen.has(key));
    if (fresh.length === 0) return;
    for (const key of fresh) seen.add(key);
    writeSeen(playerId, seen);

    for (const id of mine.awards) {
      if (!fresh.includes(`${gameNumber}:${id}`)) continue;
      const award = ROOM_AWARDS[id];
      toast({
        title: `${award.emoji} ${award.name}!`,
        description: award.howTo,
        variant: "success",
      });
    }
    if (mine.winStreak > 0 && fresh.includes(keys[keys.length - 1])) {
      const streak = ROOM_AWARDS["win-streak"];
      toast({
        title: `${streak.emoji} x${mine.winStreak} ${streak.name}!`,
        description: `${mine.winStreak} games won in a row.`,
        variant: "success",
      });
    }
  }, [awards, playerId, gameNumber, gameOver, toast]);
}
