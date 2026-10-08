"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { StreakCounter } from "@/components/streak-counter";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatTime } from "@/components/solo/result-screen";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";
import { BADGES, type BadgeDefinition } from "@/lib/game/badges";
import { currentDailyStreak, toDay, type Progress } from "@/lib/game/progress";
import { loadProgress } from "@/lib/game/progress-storage";
import { getBest } from "@/lib/game/solo-storage";
import type { Level } from "@/lib/game/types";
import { LANGUAGES } from "@/lib/runner/config";
import type { LanguageId } from "@/lib/runner/types";

const BEST_LEVELS: { id: Level; label: string }[] = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
  { id: "mixed", label: "Mixed" },
];
const LANGUAGE_IDS = Object.keys(LANGUAGES) as LanguageId[];

const subscribeNothing = () => () => {};

export function StatsView() {
  // Everything here comes from localStorage, so it only renders in the browser.
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  if (!mounted) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="lg" label="Loading stats" />
      </div>
    );
  }
  return <Stats />;
}

function Stats() {
  const [progress] = useState(() => loadProgress());
  const [today] = useState(() => toDay(new Date()));
  const earnedCount = BADGES.filter((b) => b.id in progress.earned).length;
  const isEmpty = progress.lastPlayedDay === null;
  const dailyStreak = currentDailyStreak(progress, today);

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">My Stats</h1>
        <div className="flex items-center gap-3">
          <StreakCounter winStreak={progress.winStreak} />
          <ThemeToggle />
        </div>
      </header>

      {isEmpty && (
        <Card role="status" className="flex flex-col items-start gap-3">
          <p>No games yet. Solve a puzzle to earn your first badge.</p>
          <Link href="/solo" className={buttonClass()}>
            Play Solo Practice
          </Link>
        </Card>
      )}

      <section aria-labelledby="totals" className="flex flex-col gap-3">
        <h2 id="totals" className="font-display text-xl font-bold">
          Streaks and solves
        </h2>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Figure label="Total solves" value={progress.totalSolves} />
          <Figure label="Win streak" value={progress.winStreak} />
          <Figure label="Best win streak" value={progress.bestWinStreak} />
          <Figure
            label="Daily streak"
            value={dailyStreak}
            unit={pluralDays(dailyStreak)}
          />
        </dl>
      </section>

      <section aria-labelledby="badges" className="flex flex-col gap-3">
        <h2 id="badges" className="font-display text-xl font-bold">
          Badges ({earnedCount}/{BADGES.length})
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BADGES.map((badge) => (
            <BadgeCard key={badge.id} badge={badge} progress={progress} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="bests" className="flex flex-col gap-3">
        <h2 id="bests" className="font-display text-xl font-bold">
          Personal bests
        </h2>
        <div className="overflow-x-auto rounded-xl border-2 border-border-subtle">
          <table className="w-full min-w-96 text-left text-sm">
            <caption className="sr-only">
              Best score and time for each language and level
            </caption>
            <thead>
              <tr className="border-b-2 border-border-subtle">
                <th scope="col" className="p-3">
                  Language
                </th>
                {BEST_LEVELS.map(({ id, label }) => (
                  <th key={id} scope="col" className="p-3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LANGUAGE_IDS.map((language) => (
                <tr
                  key={language}
                  className="border-b border-border-subtle last:border-b-0"
                >
                  <th scope="row" className="p-3 font-bold">
                    {LANGUAGES[language].label}
                  </th>
                  {BEST_LEVELS.map(({ id }) => (
                    <BestCell key={id} language={language} level={id} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div>
        <Link href="/" className={buttonClass({ variant: "secondary" })}>
          Home
        </Link>
      </div>
    </>
  );
}

function pluralDays(count: number) {
  return count === 1 ? "day" : "days";
}

function Figure({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit?: string;
}) {
  return (
    <Card className="flex flex-col gap-1">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-display text-2xl font-bold tabular-nums">
        {value}
        {unit && <span className="ml-1 text-sm text-muted">{unit}</span>}
      </dd>
    </Card>
  );
}

function BadgeCard({
  badge,
  progress,
}: {
  badge: BadgeDefinition;
  progress: Progress;
}) {
  const day = progress.earned[badge.id];
  const earned = day !== undefined;
  const card = (
    <Card
      tabIndex={earned ? undefined : 0}
      className={cn(
        "flex h-full w-full items-center gap-3",
        earned ? "border-success" : "opacity-60 grayscale",
      )}
    >
      <span aria-hidden="true" className="text-3xl">
        {badge.emoji}
      </span>
      <div>
        <p className="font-bold">{badge.name}</p>
        <p className="text-sm text-muted">
          {earned ? `Earned on ${day}` : "Locked"}
          <span className="sr-only">. {badge.howTo}</span>
        </p>
      </div>
    </Card>
  );
  return (
    <li className="flex">
      {earned ? (
        card
      ) : (
        <Tooltip content={badge.howTo} className="flex w-full">
          {card}
        </Tooltip>
      )}
    </li>
  );
}

function BestCell({ language, level }: { language: LanguageId; level: Level }) {
  const best = getBest(language, level);
  return (
    <td className="p-3 tabular-nums">
      {best ? (
        <>
          <span className="font-bold">{best.points}</span> pts
          <span className="block text-xs text-muted">
            {formatTime(best.timeSec)}
          </span>
        </>
      ) : (
        <span className="text-muted">
          <span aria-hidden="true">–</span>
          <span className="sr-only">No score yet</span>
        </span>
      )}
    </td>
  );
}
