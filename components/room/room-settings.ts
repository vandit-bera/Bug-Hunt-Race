import type { Level } from "@/lib/game/types";
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
