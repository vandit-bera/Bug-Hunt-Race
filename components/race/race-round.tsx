"use client";

import { useEffect, useRef, useState } from "react";
import { LaptopBanner } from "@/components/solo/laptop-banner";
import { PuzzleWorkspace } from "@/components/solo/puzzle-workspace";
import { RunnerLoadingBar } from "@/components/runner-loading-bar";
import { Badge, LevelBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import {
  DbError,
  recordScore,
  roundClock,
  type CurrentRoundView,
  type DbClient,
  type Player,
  type Room,
} from "@/lib/db";
import { formatTimeLeft, timeLeftMs } from "@/lib/game/round-clock";
import { HINT_PENALTY_RATIO } from "@/lib/game/scoring";
import { roomErrorMessage } from "@/lib/rooms";
import { LANGUAGES } from "@/lib/runner/config";
import { preloadRunner } from "@/lib/runner/preload";
import { getRunner } from "@/lib/runner/registry";
import type { RunResult } from "@/lib/runner/types";
import { AdminControls } from "./admin-controls";
import { LiveStandings } from "./live-standings";
import { progressRows, RoundProgress } from "./round-progress";
import { useLeaderboard, useNow, useRoundScores } from "./use-race-data";

const LOW_TIME_MS = 30_000;

/** What this player has sent for the round. */
type Sent = "solved" | "gave_up" | "sent";

/**
 * A live or paused race round: the Solo editor with the shared clock. A
 * passing run sends the result; the database times it. The admin also gets
 * Pause / Resume / Skip / Stop and everyone's progress. Everyone sees the
 * live leaderboard.
 */
export function RaceRound({
  client,
  room,
  view,
  players,
  me,
}: {
  client: DbClient;
  room: Room;
  view: CurrentRoundView;
  players: Player[];
  me: Player;
}) {
  const { round } = view;
  const language = round.language;
  const now = useNow();
  const paused = room.status === "paused";
  // While paused, round.paused_at freezes the clock on the same value for all.
  const leftMs = timeLeftMs(roundClock(round), now + view.clockOffsetMs);
  const timeUp = leftMs <= 0;

  const [code, setCode] = useState(round.buggy_code);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [hintShown, setHintShown] = useState(false);
  const [sent, setSent] = useState<Sent | null>(
    round.submitted ? "sent" : null,
  );
  // A passing run whose result did not reach the database yet.
  const [unsent, setUnsent] = useState<{
    passed: boolean;
    error: string;
  } | null>(null);
  const busy = useRef(false);
  const leaderboard = useLeaderboard(client, room, true);

  useEffect(() => {
    void preloadRunner(language);
  }, [language]);

  async function submit(passed: boolean) {
    setUnsent(null);
    try {
      await recordScore(client, {
        roundId: round.round_id,
        passed,
        hintUsed: hintShown,
      });
      setSent(passed ? "solved" : "gave_up");
    } catch (caught) {
      if (caught instanceof DbError && caught.code === "already_submitted") {
        setSent("sent");
      } else {
        setUnsent({ passed, error: roomErrorMessage(caught) });
      }
    }
  }

  async function run() {
    if (busy.current || sent || paused || timeUp) return;
    busy.current = true;
    setRunning(true);
    const next = await getRunner(language).run({
      language,
      code,
      tests: round.tests,
    });
    setResult(next);
    if (next.status === "passed") await submit(true);
    busy.current = false;
    setRunning(false);
  }

  const done = sent !== null;
  return (
    <>
      <LaptopBanner />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-2xl font-bold">{round.title}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>
              Round {round.round_number}
              {room.total_rounds !== null && ` of ${room.total_rounds}`}
            </Badge>
            <LevelBadge level={round.level} />
            <Badge>{LANGUAGES[language].label}</Badge>
            {paused && (
              <Badge variant="warning" role="status">
                Paused
              </Badge>
            )}
          </div>
        </div>
        <p
          role="timer"
          aria-label="Time left"
          data-testid="round-time-left"
          className={cn(
            "font-display text-3xl font-bold tabular-nums",
            leftMs <= LOW_TIME_MS && "text-danger",
          )}
        >
          {formatTimeLeft(leftMs)}
        </p>
      </header>

      {me.is_admin && <AdminControls client={client} room={room} />}
      {paused && (
        <Card role="status" className="border-warning">
          {me.is_admin
            ? "The round is paused. Resume when everyone is ready."
            : "The admin paused the round. The clock is stopped."}
        </Card>
      )}
      {round.description && <p>{round.description}</p>}
      {language === "python" && !done && (
        <RunnerLoadingBar language={language} />
      )}

      {done ? (
        <Card role="status" className="flex flex-col gap-2">
          <CardTitle as="h3">
            {sent === "solved"
              ? "🎉 Solved!"
              : sent === "gave_up"
                ? "You gave up this one."
                : "Your result is in."}
          </CardTitle>
          <p>Waiting for others… The round ends when everyone is done.</p>
        </Card>
      ) : timeUp ? (
        <Card role="status">⏰ Time&apos;s up! Waiting for the results…</Card>
      ) : (
        <PuzzleWorkspace
          language={language}
          code={code}
          onCodeChange={setCode}
          onRun={() => void run()}
          running={running}
          result={result}
          hint={round.hint}
          hintShown={hintShown}
          hintCost={Math.round(round.base_points * HINT_PENALTY_RATIO)}
          onShowHint={() => setHintShown(true)}
          onReset={() => {
            setCode(round.buggy_code);
            setResult(null);
          }}
          onGiveUp={() => void submit(false)}
          disabled={paused || unsent !== null}
        />
      )}
      {unsent && (
        <Card role="alert" className="flex flex-col items-start gap-3">
          <p>Your result was not sent: {unsent.error}</p>
          <Button onClick={() => void submit(unsent.passed)}>
            Send it again
          </Button>
        </Card>
      )}
      <LiveStandings
        leaderboard={leaderboard}
        selfId={me.id}
        title="Live leaderboard"
      />
      {me.is_admin && (
        <AdminProgress
          client={client}
          view={view}
          players={players}
          selfId={me.id}
        />
      )}
    </>
  );
}

function AdminProgress({
  client,
  view,
  players,
  selfId,
}: {
  client: DbClient;
  view: CurrentRoundView;
  players: Player[];
  selfId: string;
}) {
  const scores = useRoundScores(client, view.round.round_id, true);
  const rows = progressRows(players, scores ?? [], view.round.started_at);
  const solved = rows.filter((row) => row.progress === "solved").length;
  return (
    <Card>
      <CardTitle as="h3">
        Players ({solved}/{rows.length} solved)
      </CardTitle>
      <RoundProgress rows={rows} label="Player progress" selfId={selfId} />
    </Card>
  );
}
