import { LANGUAGES } from "@/lib/runner/config";
import type { LanguageId } from "@/lib/runner/types";
import type { Level } from "./types";

export const SOLO_LEVELS: readonly Level[] = [
  "easy",
  "medium",
  "hard",
  "mixed",
];

export interface SoloParams {
  language: LanguageId;
  level: Level;
  /** 0 for the first game; "Play again" adds 1 (Mixed steps levels). */
  round: number;
}

/** Reads `/solo/play` query params. Returns null when they are invalid. */
export function parseSoloParams(params: {
  get(name: string): string | null;
}): SoloParams | null {
  const language = params.get("language");
  const level = params.get("level");
  const round = Number(params.get("round") ?? 0);
  if (!language || !Object.hasOwn(LANGUAGES, language)) return null;
  if (!SOLO_LEVELS.includes(level as Level)) return null;
  if (!Number.isInteger(round) || round < 0) return null;
  return { language: language as LanguageId, level: level as Level, round };
}

export function soloPlayHref({ language, level, round }: SoloParams): string {
  return `/solo/play?language=${language}&level=${level}&round=${round}`;
}
