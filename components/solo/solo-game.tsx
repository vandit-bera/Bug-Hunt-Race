"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CodeEditor } from "@/components/solo/editor-loader";
import {
  formatTime,
  ResultScreen,
  type Finish,
  type Outcome,
} from "@/components/solo/result-screen";
import { TestResults } from "@/components/solo/test-results";
import { RunnerLoadingBar } from "@/components/runner-loading-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge, LevelBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Modal } from "@/components/ui/modal";
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

function Board({
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
  const [confirm, setConfirm] = useState<"hint" | "giveup" | null>(null);
  const [finish, setFinish] = useState<Finish | null>(null);

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
    const timeSec = Math.min(Math.round(elapsedSec), puzzle.timeLimitSec);
    const isNewBest =
      solved && recordBest(language, level, { points: score.total, timeSec });
    setConfirm(null);
    setFinish({
      outcome,
      score,
      timeSec,
      hintUsed: hintUsed.current,
      isNewBest,
      best: getBest(language, level),
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
  }

  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        void runRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function showHint() {
    hintUsed.current = true;
    setHintShown(true);
    setConfirm(null);
  }

  function reset() {
    setCode(puzzle.buggy);
    setResult(null);
  }

  if (finish) {
    return <ResultScreen finish={finish} params={params} lastResult={result} />;
  }

  const hintCost = Math.round(puzzle.basePoints * HINT_PENALTY_RATIO);
  return (
    <>
      <p className="rounded-lg border-2 border-warning p-3 text-sm md:hidden">
        💻 Coding works best on a laptop. You can still play here, but typing
        code on a small screen is hard.
      </p>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-2xl font-bold">{puzzle.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <LevelBadge level={puzzle.level} />
            <Badge>{LANGUAGES[language].label}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
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
          <ThemeToggle />
        </div>
      </header>
      <p>{puzzle.description}</p>
      {language === "python" && <RunnerLoadingBar language={language} />}

      <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="h-[55vh] min-h-72 overflow-hidden rounded-xl border-2 border-border-subtle">
          <CodeEditor
            value={code}
            language={LANGUAGES[language].monacoLanguage}
            onChange={setCode}
            onRun={() => void runRef.current()}
          />
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void run()} loading={running}>
              Run Tests
            </Button>
            <Button
              variant="secondary"
              disabled={hintShown}
              onClick={() => setConfirm("hint")}
            >
              {hintShown ? "Hint used" : "Hint (costs points)"}
            </Button>
            <Button variant="ghost" onClick={reset}>
              Reset code
            </Button>
            <Button variant="danger" onClick={() => setConfirm("giveup")}>
              Give up
            </Button>
          </div>
          <p className="text-xs text-muted">
            Ctrl/Cmd+Enter runs the tests. In the editor, Ctrl+M switches Tab to
            move focus.
          </p>
          {hintShown && (
            <p className="rounded-lg border-2 border-accent p-3 text-sm">
              <span className="font-bold">💡 Hint: </span>
              {puzzle.hint}
            </p>
          )}
          <TestResults result={result} running={running} />
        </div>
      </div>

      <Modal
        open={confirm === "hint"}
        onClose={() => setConfirm(null)}
        title="Show the hint?"
      >
        <p className="mb-4">
          The hint costs {hintCost} points if you solve the puzzle.
        </p>
        <div className="flex gap-2">
          <Button onClick={showHint}>Show hint</Button>
          <Button variant="secondary" onClick={() => setConfirm(null)}>
            Keep trying
          </Button>
        </div>
      </Modal>
      <Modal
        open={confirm === "giveup"}
        onClose={() => setConfirm(null)}
        title="Give up?"
      >
        <p className="mb-4">You will score 0 points for this puzzle.</p>
        <div className="flex gap-2">
          <Button variant="danger" onClick={() => end("gaveup")}>
            Give up
          </Button>
          <Button variant="secondary" onClick={() => setConfirm(null)}>
            Keep trying
          </Button>
        </div>
      </Modal>
    </>
  );
}
