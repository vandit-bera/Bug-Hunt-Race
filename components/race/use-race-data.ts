"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCurrentRound,
  getLeaderboard,
  listRoomResults,
  listRoundScores,
  type CurrentRoundView,
  type DbClient,
  type LeaderboardEntry,
  type Player,
  type Room,
  type RoomResultsRound,
  type Score,
} from "@/lib/db";
import type { PlayerAwards } from "@/lib/game/room-awards";
import { roomErrorMessage, toRoomAwards } from "@/lib/rooms";

/** How often the admin's progress list re-reads the results. */
export const SCORES_POLL_MS = 2_000;

const ROUND_STATUSES: ReadonlySet<Room["status"]> = new Set([
  "round_live",
  "paused",
  "round_results",
  "final_leaderboard",
]);

export interface CurrentRoundState {
  /** The room's current round; null in the lobby, a countdown or loading. */
  view: CurrentRoundView | null;
  error: string | null;
  retry: () => void;
}

/**
 * The room's current round, read again whenever the room status or round
 * changes (start, pause, resume and end all change the status). A view of an
 * earlier round is never returned, even while the new one loads.
 */
export function useCurrentRound(
  client: DbClient,
  room: Room,
): CurrentRoundState {
  const [view, setView] = useState<CurrentRoundView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const hasRound = ROUND_STATUSES.has(room.status);

  useEffect(() => {
    if (!hasRound) return;
    let cancelled = false;
    getCurrentRound(client, room.id).then(
      (next) => {
        if (cancelled) return;
        setView(next);
        setError(null);
      },
      (caught: unknown) => {
        if (!cancelled) setError(roomErrorMessage(caught));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [
    client,
    room.id,
    room.status,
    room.current_round,
    room.game_number,
    hasRound,
    attempt,
  ]);

  const current =
    hasRound &&
    view &&
    view.round.round_number === room.current_round &&
    view.round.game_number === room.game_number
      ? view
      : null;
  return { view: current, error, retry: () => setAttempt((n) => n + 1) };
}

/**
 * Results of a round, read once, then every `SCORES_POLL_MS` while `poll`
 * is on. Null until the first read.
 */
export function useRoundScores(
  client: DbClient,
  roundId: string,
  poll: boolean,
): Score[] | null {
  const [scores, setScores] = useState<{ roundId: string; list: Score[] }>();

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      listRoundScores(client, roundId).then(
        (list) => {
          if (!cancelled) setScores({ roundId, list });
        },
        // A failed read keeps the last list; the next poll tries again.
        () => {},
      );
    void load();
    const timer = poll ? setInterval(() => void load(), SCORES_POLL_MS) : null;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [client, roundId, poll]);

  return scores?.roundId === roundId ? scores.list : null;
}

export interface LeaderboardState {
  /** Null until the first read. */
  entries: LeaderboardEntry[] | null;
  /** Set when the first read failed; a later failed poll keeps the list. */
  error: string | null;
  retry: () => void;
}

/**
 * The room's leaderboard for the current game, read again whenever the room
 * status, round or game changes, and every `SCORES_POLL_MS` while `poll` is
 * on (scores are not sent over Realtime), so a solve shows up for everyone
 * within a couple of seconds.
 */
export function useLeaderboard(
  client: DbClient,
  room: Room,
  poll: boolean,
): LeaderboardState {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getLeaderboard(client, room.id).then(
        (next) => {
          if (cancelled) return;
          setEntries(next);
          setError(null);
        },
        (caught: unknown) => {
          if (!cancelled) setError(roomErrorMessage(caught));
        },
      );
    void load();
    const timer = poll ? setInterval(() => void load(), SCORES_POLL_MS) : null;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [
    client,
    room.id,
    room.status,
    room.current_round,
    room.game_number,
    poll,
    attempt,
  ]);

  return {
    entries,
    error: entries ? null : error,
    retry: () => {
      setError(null);
      setAttempt((n) => n + 1);
    },
  };
}

const AWARD_STATUSES: ReadonlySet<Room["status"]> = new Set([
  "round_results",
  "final_leaderboard",
]);

/**
 * Every player's room awards (see lib/game/room-awards.ts), read on the
 * round results and final leaderboard, again whenever the round or game
 * changes. Null until the first read; a failed read keeps the last awards
 * (they are a bonus, never worth an error screen).
 */
export function useRoomAwards(
  client: DbClient,
  room: Room,
  players: readonly Player[],
): ReadonlyMap<string, PlayerAwards> | null {
  const [rounds, setRounds] = useState<{
    roomId: string;
    list: RoomResultsRound[];
  }>();
  const shown = AWARD_STATUSES.has(room.status);

  useEffect(() => {
    if (!shown) return;
    let cancelled = false;
    listRoomResults(client, room.id).then(
      (list) => {
        if (!cancelled) setRounds({ roomId: room.id, list });
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [
    client,
    room.id,
    room.status,
    room.current_round,
    room.game_number,
    shown,
  ]);

  const list = rounds?.roomId === room.id ? rounds.list : null;
  const gameOver = room.status === "final_leaderboard";
  return useMemo(
    () =>
      list &&
      toRoomAwards(list, players, {
        gameNumber: room.game_number,
        gameOver,
      }),
    [list, players, room.game_number, gameOver],
  );
}

/** `Date.now()`, refreshed every `intervalMs`. */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
