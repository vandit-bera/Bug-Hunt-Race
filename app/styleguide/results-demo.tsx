"use client";

import { useState } from "react";
import { Leaderboard } from "@/components/results/leaderboard";
import { Podium } from "@/components/results/podium";
import { RoundResults } from "@/components/results/round-results";
import { Button } from "@/components/ui/button";
import { AVATAR_EMOJIS } from "@/components/room/name-avatar";
import { computeScore } from "@/lib/game/scoring";
import {
  computeStandings,
  roundResults,
  type RoundResult,
  type StandingsPlayer,
} from "@/lib/game/standings";

const SIZES = [2, 5, 30] as const;
const ROUNDS = 3;
const BASE_POINTS = 100;
const TIME_LIMIT_SEC = 120;
const NAMES = [
  "Riya",
  "Sam",
  "Kai",
  "Lee",
  "Mika",
  "Vandit",
  "Ana",
  "Bo",
  "Chandrasekhar",
  "Dee",
];

// Fixed pseudo-random numbers, so the sample data is the same on every render.
function sample(index: number, salt: number): number {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function makePlayers(count: number): StandingsPlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${String(i).padStart(2, "0")}`,
    name:
      i < NAMES.length
        ? NAMES[i]
        : `${NAMES[i % NAMES.length]} ${Math.floor(i / NAMES.length) + 1}`,
    emoji: AVATAR_EMOJIS[i % AVATAR_EMOJIS.length],
  }));
}

function makeRound(
  players: readonly StandingsPlayer[],
  round: number,
): RoundResult[] {
  return players.map((player, i) => {
    const salt = round * 10;
    if (sample(i, salt) < 0.2) {
      return {
        playerId: player.id,
        solveMs: null,
        score: computeScore({
          solved: false,
          basePoints: BASE_POINTS,
          timeLimitSec: TIME_LIMIT_SEC,
          elapsedSec: TIME_LIMIT_SEC,
          hintsUsed: 0,
        }),
      };
    }
    // Two players solve at the same moment each round, so ties show up.
    const elapsedSec = i < 2 ? 30 : 10 + Math.round(sample(i, salt + 1) * 100);
    const hintsUsed = sample(i, salt + 2) < 0.25 ? 1 : 0;
    return {
      playerId: player.id,
      solveMs: elapsedSec * 1000,
      score: computeScore({
        solved: true,
        basePoints: BASE_POINTS,
        timeLimitSec: TIME_LIMIT_SEC,
        elapsedSec,
        hintsUsed: i < 2 ? 0 : hintsUsed,
      }),
    };
  });
}

function makeGame(count: number) {
  const players = makePlayers(count);
  const rounds = Array.from({ length: ROUNDS }, (_, r) =>
    makeRound(players, r + 1),
  );
  return { players, rounds };
}

export function ResultsDemo({ theme }: { theme: "light" | "dark" }) {
  const [size, setSize] = useState<(typeof SIZES)[number]>(5);
  const [played, setPlayed] = useState(1);
  const [confettiRun, setConfettiRun] = useState(0);
  const [action, setAction] = useState("");

  const { players, rounds } = makeGame(size);
  const soFar = rounds.slice(0, played);
  const standings = computeStandings(players, soFar);
  const currentPlayerId = players[1]?.id;

  return (
    <div className="flex w-full flex-col gap-6">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="mb-2 text-sm text-muted">Sample players</legend>
        {SIZES.map((option) => (
          <Button
            key={option}
            size="sm"
            variant={option === size ? "primary" : "secondary"}
            aria-pressed={option === size}
            onClick={() => {
              setSize(option);
              setPlayed(1);
            }}
          >
            {option} players
          </Button>
        ))}
      </fieldset>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-bold">Live leaderboard</h4>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPlayed((n) => (n % ROUNDS) + 1)}
          >
            {played < ROUNDS ? `Play round ${played + 1}` : "Back to round 1"}
          </Button>
        </div>
        <Leaderboard
          standings={standings}
          currentPlayerId={currentPlayerId}
          label={`${theme} live leaderboard`}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h4 className="font-bold">Round {played} results</h4>
        <RoundResults
          rows={roundResults(players, soFar)}
          roundNumber={played}
          currentPlayerId={currentPlayerId}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-bold">Final podium</h4>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setConfettiRun((run) => run + 1)}
          >
            Replay confetti
          </Button>
        </div>
        <Podium
          key={confettiRun}
          standings={computeStandings(players, rounds)}
          currentPlayerId={currentPlayerId}
          isAdmin
          confetti={confettiRun > 0}
          onPlayAgain={() => setAction("Play again clicked")}
          onCloseRoom={() => setAction("Close room clicked")}
        />
        <p role="status" className="text-center text-sm text-muted">
          {action}
        </p>
      </section>
    </div>
  );
}
