import type { PuzzleLevel } from "@/lib/puzzles/schema";
import { LANGUAGES } from "@/lib/runner/config";
import type { LanguageId } from "@/lib/runner/types";

/** One finished Solo round. Only the facts the badges and streaks need. */
export interface RoundEvent {
  solved: boolean;
  language: LanguageId;
  /** The level of the puzzle that was played (never "mixed"). */
  level: PuzzleLevel;
  hintUsed: boolean;
  timeSec: number;
  timeLimitSec: number;
  /** Local calendar day the round ended, as YYYY-MM-DD. */
  day: string;
}

export interface Progress {
  totalSolves: number;
  winStreak: number;
  bestWinStreak: number;
  dailyStreak: number;
  bestDailyStreak: number;
  lastPlayedDay: string | null;
  solvedLanguages: LanguageId[];
  hardSolves: number;
  /** Badge id to the day it was earned. */
  earned: Record<string, string>;
}

export const EMPTY_PROGRESS: Progress = {
  totalSolves: 0,
  winStreak: 0,
  bestWinStreak: 0,
  dailyStreak: 0,
  bestDailyStreak: 0,
  lastPlayedDay: null,
  solvedLanguages: [],
  hardSolves: 0,
  earned: {},
};

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isDay(value: unknown): value is string {
  return (
    typeof value === "string" &&
    DAY_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

/** Local calendar day of `date` as YYYY-MM-DD. */
export function toDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

function nextDailyStreak(progress: Progress, day: string): number {
  const { lastPlayedDay, dailyStreak } = progress;
  if (!lastPlayedDay) return 1;
  const gap = daysBetween(lastPlayedDay, day);
  if (gap === 0) return Math.max(1, dailyStreak);
  return gap === 1 ? dailyStreak + 1 : 1;
}

/** The daily streak to show on `today`: it lapses after a missed day. */
export function currentDailyStreak(progress: Progress, today: string): number {
  const { lastPlayedDay, dailyStreak } = progress;
  if (!lastPlayedDay || daysBetween(lastPlayedDay, today) > 1) return 0;
  return dailyStreak;
}

/** The progress after one more finished round. Never mutates its input. */
export function applyRound(progress: Progress, event: RoundEvent): Progress {
  const dailyStreak = nextDailyStreak(progress, event.day);
  const winStreak = event.solved ? progress.winStreak + 1 : 0;
  const lastPlayedDay =
    progress.lastPlayedDay && progress.lastPlayedDay > event.day
      ? progress.lastPlayedDay
      : event.day;
  const solvedLanguages =
    event.solved && !progress.solvedLanguages.includes(event.language)
      ? [...progress.solvedLanguages, event.language]
      : progress.solvedLanguages;
  return {
    ...progress,
    totalSolves: progress.totalSolves + (event.solved ? 1 : 0),
    winStreak,
    bestWinStreak: Math.max(progress.bestWinStreak, winStreak),
    dailyStreak,
    bestDailyStreak: Math.max(progress.bestDailyStreak, dailyStreak),
    lastPlayedDay,
    solvedLanguages,
    hardSolves:
      progress.hardSolves + (event.solved && event.level === "hard" ? 1 : 0),
  };
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : 0;
}

/** Rebuilds a trusted Progress from stored data; bad fields fall back. */
export function sanitizeProgress(value: unknown): Progress {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return EMPTY_PROGRESS;
  }
  const raw = value as Record<string, unknown>;
  const earned: Record<string, string> = {};
  if (
    typeof raw.earned === "object" &&
    raw.earned !== null &&
    !Array.isArray(raw.earned)
  ) {
    for (const [id, day] of Object.entries(raw.earned)) {
      if (isDay(day)) earned[id] = day;
    }
  }
  const winStreak = count(raw.winStreak);
  const dailyStreak = count(raw.dailyStreak);
  return {
    totalSolves: count(raw.totalSolves),
    winStreak,
    bestWinStreak: Math.max(count(raw.bestWinStreak), winStreak),
    dailyStreak,
    bestDailyStreak: Math.max(count(raw.bestDailyStreak), dailyStreak),
    lastPlayedDay: isDay(raw.lastPlayedDay) ? raw.lastPlayedDay : null,
    solvedLanguages: Array.isArray(raw.solvedLanguages)
      ? (Object.keys(LANGUAGES) as LanguageId[]).filter((id) =>
          (raw.solvedLanguages as unknown[]).includes(id),
        )
      : [],
    hardSolves: count(raw.hardSolves),
    earned,
  };
}
