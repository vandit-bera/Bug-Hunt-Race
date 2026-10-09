import { describe, expect, it } from "vitest";
import {
  anyoneSolved,
  racePhase,
  roundProgress,
  type RacePlayer,
  type RaceResult,
} from "./race";

describe("racePhase", () => {
  const inRound = { joinedLate: false };
  const late = { joinedLate: true };

  it("follows the room status outside a round", () => {
    expect(racePhase("lobby", null)).toBe("lobby");
    expect(racePhase("countdown", null)).toBe("countdown");
    expect(racePhase("final_leaderboard", inRound)).toBe("final");
  });

  it("plays a live or paused round the player was in at the start", () => {
    expect(racePhase("round_live", inRound)).toBe("playing");
    expect(racePhase("paused", inRound)).toBe("playing");
  });

  it("keeps late joiners waiting until the next round", () => {
    expect(racePhase("round_live", late)).toBe("waiting");
    expect(racePhase("paused", late)).toBe("waiting");
    expect(racePhase("round_results", late)).toBe("results");
  });

  it("waits for the round to load", () => {
    expect(racePhase("round_live", null)).toBe("loading");
    expect(racePhase("paused", null)).toBe("loading");
    expect(racePhase("round_results", null)).toBe("loading");
  });
});

describe("roundProgress", () => {
  const started = "2026-10-09T10:00:00Z";
  const player = (id: string, joinedAt: string): RacePlayer => ({
    id,
    name: id,
    avatar: "🦊",
    joinedAt,
  });
  const result = (
    playerId: string,
    passed: boolean,
    solveTimeMs: number | null = null,
  ): RaceResult => ({
    playerId,
    passed,
    solveTimeMs,
    hintUsed: false,
    points: passed ? 100 : 0,
  });
  const ana = player("ana", "2026-10-09T09:58:00Z");
  const ben = player("ben", "2026-10-09T09:58:30Z");
  const cleo = player("cleo", "2026-10-09T09:59:00Z");
  const dev = player("dev", "2026-10-09T09:59:30Z");

  it("lists solvers fastest first, then gave up, then still fixing", () => {
    const rows = roundProgress(
      [ana, ben, cleo, dev],
      [
        result("dev", true, 30_000),
        result("ben", false),
        result("cleo", true, 20_000),
      ],
      started,
    );
    expect(rows.map((row) => [row.player.id, row.progress])).toEqual([
      ["cleo", "solved"],
      ["dev", "solved"],
      ["ben", "gave_up"],
      ["ana", "fixing"],
    ]);
  });

  it("keeps join order among players still fixing", () => {
    const rows = roundProgress([cleo, ana, ben], [], started);
    expect(rows.map((row) => row.player.id)).toEqual(["ana", "ben", "cleo"]);
  });

  it("leaves out players who joined after the start", () => {
    const late = player("eli", "2026-10-09T10:00:01Z");
    const rows = roundProgress([ana, late], [], started);
    expect(rows.map((row) => row.player.id)).toEqual(["ana"]);
  });

  it("counts a player who joined at the very start", () => {
    const rows = roundProgress([player("fay", started)], [], started);
    expect(rows).toHaveLength(1);
  });

  it("knows whether anyone solved", () => {
    expect(
      anyoneSolved(roundProgress([ana, ben], [result("ana", false)], started)),
    ).toBe(false);
    expect(
      anyoneSolved(
        roundProgress([ana, ben], [result("ana", true, 5_000)], started),
      ),
    ).toBe(true);
  });
});
