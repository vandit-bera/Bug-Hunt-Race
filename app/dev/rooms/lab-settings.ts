import type { DbLanguage, RoomLevel } from "@/lib/db";
import { Constants } from "@/lib/db/types";

export interface LabSettings {
  language: DbLanguage;
  level: RoomLevel;
  /** null = play until the admin stops. */
  totalRounds: number | null;
}

export const DEFAULT_LAB_SETTINGS: LabSettings = {
  language: "javascript",
  level: "easy",
  totalRounds: 3,
};

function oneOf<T extends string>(
  options: readonly T[],
  value: string | null,
): T | undefined {
  return options.find((option) => option === value);
}

function parseRounds(value: string | null): number | null | undefined {
  if (value === "endless") return null;
  if (value === null || !/^\d+$/.test(value)) return undefined;
  const rounds = Number(value);
  return rounds >= 1 && rounds <= 50 ? rounds : undefined;
}

/**
 * Room settings for the lab's "Create room", from the page URL, e.g.
 * `/dev/rooms?language=python&level=mixed&rounds=endless`. Missing or invalid
 * values fall back to the defaults. Lets E2E tests create rooms with any
 * settings without a settings form.
 */
export function parseLabSettings(search: string): LabSettings {
  const params = new URLSearchParams(search);
  const { Enums } = Constants.public;
  const rounds = parseRounds(params.get("rounds"));
  return {
    language:
      oneOf(Enums.language_id, params.get("language")) ??
      DEFAULT_LAB_SETTINGS.language,
    level:
      oneOf(Enums.room_level, params.get("level")) ??
      DEFAULT_LAB_SETTINGS.level,
    totalRounds:
      rounds === undefined ? DEFAULT_LAB_SETTINGS.totalRounds : rounds,
  };
}
