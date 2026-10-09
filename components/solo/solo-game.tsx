"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LaptopBanner } from "@/components/solo/laptop-banner";
import { Countdown } from "@/components/fx/countdown";
import {
  formatTime,
  ResultScreen,
  type Finish,
  type Outcome,
} from "@/components/solo/result-screen";
import { PuzzleWorkspace } from "@/components/solo/puzzle-workspace";
import { RunnerLoadingBar } from "@/components/runner-loading-bar";
import { SoundToggle } from "@/components/sound-toggle";
import { StreakCounter } from "@/components/streak-counter";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge, LevelBadge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/toast";
import { recordRound } from "@/lib/game/badges";
import { currentDailyStreak, toDay, type Progress } from "@/lib/game/progress";
import { loadProgress, saveProgress } from "@/lib/game/progress-storage";
import { HINT_PENALTY_RATIO, computeScore } from "@/lib/game/scoring";
import { parseSoloParams, type SoloParams } from "@/lib/game/solo-params";
import { levelForRound, pickPuzzle } from "@/lib/game/solo-pick";
import {
  getBest,
  getPlayed,
  recordBest,
  setPlayed,
} from "@/lib/game/solo-storage";
import { PUZZLES } from "@/lib/puzzles/generated";
import type { PublicPuzzle } from "@/lib/puzzles/schema";
import { LANGUAGES } from "@/lib/runner/config";
import { preloadRunner } from "@/lib/runner/preload";
import { getRunner } from "@/lib/runner/registry";
import type { RunResult } from "@/lib/runner/types";
import { playSound } from "@/lib/sound/sounds";

const TICK_MS = 250;
const LOW_TIME_SEC = 30;

const subscribeNothing = () => () => {};

export function SoloGame() {
  const params = parseSoloParams(useSearchParams());
  // Puzzle picking reads localStorage, so it only runs in the browser.
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );

  if (!params) {
    return (
      <Notice>
        That game link is not valid.{" "}
        <Link href="/solo" className="font-bold underline">
          Choose a language and level
        </Link>
        .
      </Notice>
    );
  }
  if (!mounted) return null;
  return <Game key={params.round} params={params} />;
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="mx-auto max-w-md p-6 text-center">
      {children}
    </p>
  );
}

function Game({ params }: { params: SoloParams }) {
  const { language, level, round } = params;
  const [pick] = useState(() => {
    const hasPuzzles = (candidate: PublicPuzzle["level"]) =>
      PUZZLES.some((p) => p.language === language && p.level === candidate);
    const puzzleLevel = levelForRound(level, round, hasPuzzles);
    if (!puzzleLevel) return null;
    const pool = PUZZLES.filter(
      (p) => p.language === language && p.level === puzzleLevel,
    );
    const next = pickPuzzle(pool, getPlayed(language, puzzleLevel));
    return next && { ...next, level: puzzleLevel };
  });

  useEffect(() => {
    if (pick) setPlayed(language, pick.level, pick.played);
  }, [language, pick]);

  useEffect(() => {
    void preloadRunner(language);
  }, [language]);

  if (!pick) {
    return (
      <Notice>
        No puzzles yet for {LANGUAGES[language].label}.{" "}
        <Link href="/solo" className="font-bold underline">
          Change settings
        </Link>
      </Notice>
    );
  }
  return <Board puzzle={pick.puzzle} params={params} />;
}

/** Counts down 3-2-1 before the puzzle is shown, so every player starts together. */
function Board({
  puzzle,
  params,
}: {
  puzzle: PublicPuzzle;
  params: SoloParams;
}) {
  const [ready, setReady] = useState(false);
  if (ready) return <Round puzzle={puzzle} params={params} />;
  return (
    <>
      <div className="flex justify-end">
        <SoundToggle />
      </div>
      <Countdown
        onStep={(value) => playSound(value === 0 ? "go" : "tick")}
        onDone={() => setReady(true)}
      />
    </>
  );
}

function Round({
  puzzle,
  params,
}: {
  puzzle: PublicPuzzle;
  params: SoloParams;
}) {
  const { language, level } = params;
  const [code, setCode] = useState(puzzle.buggy);
  const [remainingSec, setRemainingSec] = useState(puzzle.timeLimitSec);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [hintShown, setHintShown] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(null);
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const toast = useToast();

  const startedAt = useRef(0);
  const finished = useRef(false);
  const busy = useRef(false);
  const hintUsed = useRef(false);

  function end(outcome: Outcome) {
    if (finished.current) return;
    finished.current = true;
    const elapsedSec = (Date.now() - startedAt.current) / 1000;
    const solved = outcome === "solved";
    const score = computeScore({
      solved,
      basePoints: puzzle.basePoints,
      timeLimitSec: puzzle.timeLimitSec,
      elapsedSec,
      hintsUsed: hintUsed.current ? 1 : 0,
    });
    if (solved) playSound("solved");
    if (outcome === "timeup") playSound("timeup");
    const timeSec = Math.min(Math.round(elapsedSec), puzzle.timeLimitSec);
    const isNewBest =
      solved && recordBest(language, level, { points: score.total, timeSec });
    const day = toDay(new Date());
    const round = recordRound(loadProgress(), {
      solved,
      language,
      level: puzzle.level,
      hintUsed: hintUsed.current,
      timeSec,
      timeLimitSec: puzzle.timeLimitSec,
      day,
    });
    saveProgress(round.progress);
    setProgress(round.progress);
    for (const badge of round.newBadges) {
      toast({
        title: `${badge.emoji} Badge unlocked! ${badge.name}`,
        description: badge.howTo,
        variant: "success",
      });
    }
    setFinish({
      outcome,
      score,
      timeSec,
      hintUsed: hintUsed.current,
      isNewBest,
      best: getBest(language, level),
      winStreak: round.progress.winStreak,
      dailyStreak: currentDailyStreak(round.progress, day),
      newBadgeCount: round.newBadges.length,
    });
  }

  useEffect(() => {
    startedAt.current = Date.now();
    const timer = setInterval(() => {
      const left =
        puzzle.timeLimitSec - (Date.now() - startedAt.current) / 1000;
      setRemainingSec(Math.max(0, Math.ceil(left)));
      if (left <= 0) end("timeup");
    }, TICK_MS);
    return () => clearInterval(timer);
    // `end` only reads refs and stable props; the timer must not restart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    if (busy.current || finished.current) return;
    busy.current = true;
    setRunning(true);
    const next = await getRunner(language).run({
      language,
      code,
      tests: puzzle.tests,
    });
    busy.current = false;
    setRunning(false);
    if (finished.current) return;
    setResult(next);
    if (next.status === "passed") end("solved");
    else playSound("fail");
  }

  function showHint() {
    hintUsed.current = true;
    setHintShown(true);
  }

  function reset() {
    setCode(puzzle.buggy);
    setResult(null);
  }

  if (finish) {
    return <ResultScreen finish={finish} params={params} lastResult={result} />;
  }

  return (
    <>
      <LaptopBanner />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-2xl font-bold">{puzzle.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <LevelBadge level={puzzle.level} />
            <Badge>{LANGUAGES[language].label}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <StreakCounter winStreak={progress.winStreak} />
          <p
            role="timer"
            aria-label="Time left"
            className={cn(
              "font-display text-3xl font-bold tabular-nums",
              remainingSec <= LOW_TIME_SEC && "text-danger",
            )}
          >
            {formatTime(remainingSec)}
          </p>
          <SoundToggle />
          <ThemeToggle />
        </div>
      </header>
      <p>{puzzle.description}</p>
      {language === "python" && <RunnerLoadingBar language={language} />}

      <PuzzleWorkspace
        language={language}
        code={code}
        onCodeChange={setCode}
        onRun={() => void run()}
        running={running}
        result={result}
        hint={puzzle.hint}
        hintShown={hintShown}
        hintCost={Math.round(puzzle.basePoints * HINT_PENALTY_RATIO)}
        onShowHint={showHint}
        onReset={reset}
        onGiveUp={() => end("gaveup")}
      />
    </>
  );
}
