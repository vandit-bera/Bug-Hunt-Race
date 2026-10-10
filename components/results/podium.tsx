"use client";

import { Confetti } from "@/components/fx/confetti";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import {
  podiumSteps,
  type PodiumStep,
  type Standing,
} from "@/lib/game/standings";
import { AwardBadges, type RoomAwards } from "./award-badges";
import { Leaderboard } from "./leaderboard";

// Classic podium order: 2nd on the left, 1st in the middle, 3rd on the right.
// Only the look changes (`order`); the DOM stays 1st, 2nd, 3rd for screen readers.
const MEDALS: Record<
  number,
  { emoji: string; label: string; step: string; order: string }
> = {
  1: {
    emoji: "🥇",
    label: "1st place",
    step: "h-28 border-warning",
    order: "order-2",
  },
  2: {
    emoji: "🥈",
    label: "2nd place",
    step: "h-20 border-border",
    order: "order-1",
  },
  3: {
    emoji: "🥉",
    label: "3rd place",
    step: "h-14 border-accent",
    order: "order-3",
  },
};

function Step({
  step,
  awards,
}: {
  step: PodiumStep;
  awards?: RoomAwards | null;
}) {
  const medal = MEDALS[step.rank];
  return (
    <li
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center gap-2",
        medal.order,
      )}
    >
      <ul
        aria-label={medal.label}
        className="flex flex-wrap justify-center gap-1"
      >
        {step.players.map((player) => (
          <li
            key={player.id}
            className="flex w-16 min-w-0 flex-col items-center text-center sm:w-20"
          >
            <Avatar emoji={player.emoji} name={player.name} />
            <span className="w-full truncate text-sm font-bold">
              {player.name}
            </span>
            <span className="font-mono text-xs text-muted tabular-nums">
              {player.totalPoints} pts
            </span>
            <AwardBadges
              awards={awards}
              playerId={player.id}
              className="mt-1 justify-center"
            />
          </li>
        ))}
      </ul>
      <div
        className={cn(
          "flex w-full items-start justify-center rounded-t-lg border-2 border-b-0 bg-surface-raised pt-2 text-3xl",
          medal.step,
        )}
      >
        <span aria-hidden="true">{medal.emoji}</span>
      </div>
    </li>
  );
}

/**
 * Final results: the top 3 on a podium (tied players share a step), the full
 * list below and a confetti burst; room awards show next to the names. Play again / Close room show only for the
 * admin; `busy` names the one that is running and disables both.
 */
export function Podium({
  standings,
  currentPlayerId,
  isAdmin = false,
  confetti = true,
  onPlayAgain,
  onCloseRoom,
  busy = null,
  awards,
}: {
  standings: readonly Standing[];
  currentPlayerId?: string;
  isAdmin?: boolean;
  confetti?: boolean;
  onPlayAgain?: () => void;
  onCloseRoom?: () => void;
  busy?: "play_again" | "close" | null;
  awards?: RoomAwards | null;
}) {
  const steps = podiumSteps(standings);

  return (
    <div className="flex w-full flex-col gap-6">
      {confetti && steps.length > 0 && <Confetti />}
      {steps.length > 0 ? (
        <ol
          aria-label="Podium"
          className="mx-auto flex w-full max-w-md items-end gap-2"
        >
          {steps.map((step) => (
            <Step key={step.rank} step={step} awards={awards} />
          ))}
        </ol>
      ) : (
        <p className="text-center text-muted">
          Nobody scored this game. Better luck next time!
        </p>
      )}
      <Leaderboard
        standings={standings}
        currentPlayerId={currentPlayerId}
        label="Final leaderboard"
        awards={awards}
      />
      {isAdmin && (onPlayAgain || onCloseRoom) && (
        <div className="flex flex-wrap justify-center gap-3">
          {onPlayAgain && (
            <Button
              loading={busy === "play_again"}
              disabled={busy !== null}
              onClick={onPlayAgain}
            >
              Play again
            </Button>
          )}
          {onCloseRoom && (
            <Button
              variant="secondary"
              loading={busy === "close"}
              disabled={busy !== null}
              onClick={onCloseRoom}
            >
              Close room
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
