import { LEVELS } from "@/components/ui/badge";
import type { Level } from "@/lib/game/types";
import { LANGUAGES } from "@/lib/runner/config";
import type { LanguageId } from "@/lib/runner/types";

/** `null` means "Play until I stop". */
export type RoundCount = 3 | 5 | 10 | null;

export interface RoomSettings {
  language: LanguageId;
  level: Level;
  rounds: RoundCount;
}

export const ROUND_OPTIONS: { value: RoundCount; label: string }[] = [
  { value: 3, label: "3" },
  { value: 5, label: "5" },
  { value: 10, label: "10" },
  { value: null, label: "Play until I stop" },
];

/**
 * A room's settings in one line, e.g. "JavaScript · Easy · 5 rounds". Leave
 * `totalRounds` out when it is not known (the join preview).
 */
export function describeRoomSettings({
  language,
  level,
  totalRounds,
}: {
  language: LanguageId;
  level: Level;
  /** null = until the admin stops. */
  totalRounds?: number | null;
}): string {
  const parts = [
    LANGUAGES[language].label,
    level === "mixed" ? "Mixed" : LEVELS[level].label,
  ];
  if (totalRounds === null) parts.push("Play until the admin stops");
  else if (totalRounds !== undefined) parts.push(`${totalRounds} rounds`);
  return parts.join(" · ");
}
