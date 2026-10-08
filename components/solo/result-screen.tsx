"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { RulesButton } from "@/components/rules-modal";
import { AnimatedNumber } from "@/components/fx/animated-number";
import { Confetti } from "@/components/fx/confetti";
import { ScorePopup } from "@/components/fx/score-popup";
import { TestResults } from "@/components/solo/test-results";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ScoreBreakdown } from "@/lib/game/scoring";
import { soloPlayHref, type SoloParams } from "@/lib/game/solo-params";
import type { PersonalBest } from "@/lib/game/solo-storage";
import type { RunResult } from "@/lib/runner/types";

export type Outcome = "solved" | "timeup" | "gaveup";

export interface Finish {
  outcome: Outcome;
  score: ScoreBreakdown;
  timeSec: number;
  hintUsed: boolean;
  isNewBest: boolean;
  best: PersonalBest | null;
}

const HEADINGS: Record<Outcome, { emoji: string; text: string }> = {
  solved: { emoji: "🎉", text: "Bug squashed!" },
  timeup: { emoji: "⏰", text: "Time's up" },
  gaveup: { emoji: "🏳️", text: "You gave up" },
};

export function formatTime(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}

export function ResultScreen({
  finish,
  params,
  lastResult,
}: {
  finish: Finish;
  params: SoloParams;
  lastResult: RunResult | null;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const { outcome, score, hintUsed, best } = finish;
  const { emoji, text } = HEADINGS[outcome];

  return (
    <Card className="mx-auto flex w-full max-w-xl flex-col gap-4">
      {outcome === "solved" && <Confetti />}
      <span
        aria-hidden="true"
        className="inline-block animate-[celebrate_700ms_ease-out] text-5xl"
      >
        {emoji}
      </span>
      <h1
        ref={heading}
        tabIndex={-1}
        className="font-display text-3xl font-bold outline-none"
      >
        {text}
      </h1>
      <p className="text-lg">
        {outcome === "solved" ? (
          <span className="inline-flex items-baseline gap-3 font-bold">
            <span>
              <AnimatedNumber value={score.total} /> points
            </span>
            <ScorePopup points={score.total} />
          </span>
        ) : (
          "0 points. No fix this time."
        )}
      </p>
      {finish.isNewBest && (
        <p role="status" className="font-bold text-success">
          🏆 New personal best!
        </p>
      )}

      <dl className="flex flex-col gap-1 text-sm">
        <Stat label="Time" value={formatTime(finish.timeSec)} />
        {outcome === "solved" && (
          <>
            <Stat label="Base points" value={String(score.base)} />
            <Stat label="Speed bonus" value={`+${score.speedBonus}`} />
            {hintUsed && (
              <Stat label="Hint penalty" value={`-${score.hintPenalty}`} />
            )}
          </>
        )}
        <Stat label="Hint used" value={hintUsed ? "Yes" : "No"} />
        <Stat
          label="Personal best"
          value={
            best
              ? `${best.points} points in ${formatTime(best.timeSec)}`
              : "None yet"
          }
        />
      </dl>

      {outcome !== "solved" && lastResult && (
        <div className="border-t-2 border-border-subtle pt-3">
          <h2 className="mb-2 font-bold">Your last run</h2>
          <TestResults result={lastResult} running={false} />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          href={soloPlayHref({ ...params, round: params.round + 1 })}
          className={buttonClass()}
        >
          Play again
        </Link>
        <Link href="/solo" className={buttonClass({ variant: "secondary" })}>
          Change settings
        </Link>
      </div>
      <RulesButton className="self-start" />
    </Card>
  );
}
