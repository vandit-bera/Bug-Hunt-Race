import { LANGUAGES } from "@/lib/runner/config";
import { applyRound, type Progress, type RoundEvent } from "./progress";

export const SPEED_DEMON_RATIO = 0.25;
export const HAT_TRICK_STREAK = 3;
export const EXTERMINATOR_HARD_SOLVES = 10;

export interface BadgeDefinition {
  id: string;
  name: string;
  emoji: string;
  /** How to earn it; shown on the stats page and in the unlock toast. */
  howTo: string;
  /** `progress` already includes `event`. */
  isEarned: (progress: Progress, event: RoundEvent) => boolean;
}

export const BADGES: readonly BadgeDefinition[] = [
  {
    id: "first-blood",
    name: "First Blood",
    emoji: "🩸",
    howTo: "Solve your first puzzle.",
    isEarned: (progress, event) => event.solved && progress.totalSolves === 1,
  },
  {
    id: "speed-demon",
    name: "Speed Demon",
    emoji: "⚡",
    howTo: "Solve a puzzle in under 25% of its time limit.",
    isEarned: (_, event) =>
      event.solved && event.timeSec < event.timeLimitSec * SPEED_DEMON_RATIO,
  },
  {
    id: "no-hints-needed",
    name: "No Hints Needed",
    emoji: "🧠",
    howTo: "Solve a puzzle without using the hint.",
    isEarned: (_, event) => event.solved && !event.hintUsed,
  },
  {
    id: "hat-trick",
    name: "Hat Trick",
    emoji: "🎩",
    howTo: "Solve 3 puzzles in a row.",
    isEarned: (progress) => progress.winStreak >= HAT_TRICK_STREAK,
  },
  {
    id: "polyglot",
    name: "Polyglot",
    emoji: "🌍",
    howTo: "Solve a puzzle in JavaScript, TypeScript and Python.",
    isEarned: (progress) =>
      progress.solvedLanguages.length === Object.keys(LANGUAGES).length,
  },
  {
    id: "bug-exterminator",
    name: "Bug Exterminator",
    emoji: "🦂",
    howTo: `Solve ${EXTERMINATOR_HARD_SOLVES} Hard puzzles.`,
    isEarned: (progress) => progress.hardSolves >= EXTERMINATOR_HARD_SOLVES,
  },
];

export interface RoundOutcome {
  progress: Progress;
  newBadges: BadgeDefinition[];
}

/** Records a finished round and returns the badges it unlocked. */
export function recordRound(
  progress: Progress,
  event: RoundEvent,
): RoundOutcome {
  const next = applyRound(progress, event);
  const newBadges = BADGES.filter(
    (badge) => !(badge.id in next.earned) && badge.isEarned(next, event),
  );
  const earned = { ...next.earned };
  for (const badge of newBadges) earned[badge.id] = event.day;
  return { progress: { ...next, earned }, newBadges };
}
