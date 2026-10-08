"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RunnerLoadingBar } from "@/components/runner-loading-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { LEVELS } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { levelForRound } from "@/lib/game/solo-pick";
import { soloPlayHref } from "@/lib/game/solo-params";
import type { Level } from "@/lib/game/types";
import { PUZZLES } from "@/lib/puzzles/generated";
import { LANGUAGES } from "@/lib/runner/config";
import { preloadRunner } from "@/lib/runner/preload";
import type { LanguageId } from "@/lib/runner/types";

const LANGUAGE_IDS = Object.keys(LANGUAGES) as LanguageId[];
const LEVEL_OPTIONS: { id: Level; label: string; emoji: string }[] = [
  { id: "easy", ...LEVELS.easy },
  { id: "medium", ...LEVELS.medium },
  { id: "hard", ...LEVELS.hard },
  { id: "mixed", label: "Mixed", emoji: "🎲" },
];

function countPuzzles(language: LanguageId, level: Level): number {
  return PUZZLES.filter(
    (puzzle) =>
      puzzle.language === language &&
      (level === "mixed" || puzzle.level === level),
  ).length;
}

function OptionCard({
  name,
  value,
  checked,
  onChange,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="peer absolute inset-0 cursor-pointer opacity-0"
      />
      <span
        className={cn(
          "flex flex-col items-center gap-1 rounded-xl border-2 border-border-subtle bg-surface p-4 text-center font-display font-bold",
          "hover:border-accent peer-checked:border-primary peer-checked:bg-surface-raised",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
        )}
      >
        {children}
      </span>
    </label>
  );
}

export function SoloSetup() {
  const [language, setLanguage] = useState<LanguageId>("javascript");
  const [level, setLevel] = useState<Level>("easy");

  useEffect(() => {
    void preloadRunner(language);
  }, [language]);

  const available = countPuzzles(language, level);
  const start = levelForRound(level, 0, (candidate) =>
    PUZZLES.some(
      (puzzle) => puzzle.language === language && puzzle.level === candidate,
    ),
  );

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="text-sm font-bold underline">
          ← Home
        </Link>
        <ThemeToggle />
      </div>
      <h1 className="font-display text-3xl font-bold">Solo Practice</h1>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-bold">Language</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {LANGUAGE_IDS.map((id) => (
            <OptionCard
              key={id}
              name="language"
              value={id}
              checked={language === id}
              onChange={() => setLanguage(id)}
            >
              {LANGUAGES[id].label}
            </OptionCard>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-bold">Level</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {LEVEL_OPTIONS.map((option) => (
            <OptionCard
              key={option.id}
              name="level"
              value={option.id}
              checked={level === option.id}
              onChange={() => setLevel(option.id)}
            >
              <span aria-hidden="true" className="text-2xl">
                {option.emoji}
              </span>
              {option.label}
            </OptionCard>
          ))}
        </div>
      </fieldset>

      {language === "python" && <RunnerLoadingBar language={language} />}

      {start === null ? (
        <p
          role="status"
          className="rounded-lg border-2 border-border-subtle p-4"
        >
          No puzzles yet for {LANGUAGES[language].label} on this level. Pick
          another combination.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <Link
            href={soloPlayHref({ language, level, round: 0 })}
            className={buttonClass({ size: "lg" })}
          >
            Start
          </Link>
          <p className="text-sm text-muted">
            {available} {available === 1 ? "puzzle" : "puzzles"} in this pool.
          </p>
        </div>
      )}
    </>
  );
}
