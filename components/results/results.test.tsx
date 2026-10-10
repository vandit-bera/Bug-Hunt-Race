import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  computeStandings,
  roundResults,
  type RoundResult,
} from "@/lib/game/standings";
import { Leaderboard } from "./leaderboard";
import { Podium } from "./podium";
import { RoundResults } from "./round-results";

const players = ["Riya", "Sam", "Kai"].map((name) => ({
  id: name.toLowerCase(),
  name,
  emoji: "🦊",
}));

const result = (
  playerId: string,
  total: number,
  solveMs: number | null,
): RoundResult => ({
  playerId,
  solveMs,
  score: { base: 100, speedBonus: 40, hintPenalty: 25, total },
});

const round = [
  result("riya", 115, 42_000),
  result("sam", 115, 42_000),
  result("kai", 0, null),
];

describe("Leaderboard", () => {
  it("shows shared places, rounds solved and points", () => {
    const html = renderToStaticMarkup(
      <Leaderboard standings={computeStandings(players, [round])} />,
    );
    expect(html.match(/ \(tied\)/g)).toHaveLength(2);
    expect(html).toContain("1 solved");
    expect(html).toContain("0 solved");
    expect(html).toContain("115");
  });

  it("lists rows in rank order in the DOM, ties included", () => {
    // Sam leads but sorts last by id, so an id-ordered DOM would fail.
    const samFirst = [
      result("riya", 115, 42_000),
      result("sam", 140, 30_000),
      result("kai", 115, 42_000),
    ];
    const html = renderToStaticMarkup(
      <Leaderboard standings={computeStandings(players, [samFirst])} />,
    );
    const places = [...html.matchAll(/Place <\/span>(\d+)/g)].map((m) => m[1]);
    expect(places).toEqual(["1", "2", "2"]);
    const positions = [...html.matchAll(/aria-posinset="(\d+)"/g)].map(
      (m) => m[1],
    );
    expect(positions).toEqual(["1", "2", "3"]);
    expect(html.indexOf("Sam")).toBeLessThan(html.indexOf("Riya"));
  });

  it("has an empty state", () => {
    expect(renderToStaticMarkup(<Leaderboard standings={[]} />)).toContain(
      "No players yet.",
    );
  });
});

describe("RoundResults", () => {
  it("shows the time, breakdown and a Not solved row with 0", () => {
    const html = renderToStaticMarkup(
      <RoundResults rows={roundResults(players, [round])} roundNumber={1} />,
    );
    expect(html).toContain("0:42");
    expect(html).toContain("100 + 40 speed − 25 hint");
    expect(html).toContain("+115");
    expect(html).toContain("Not solved");
  });
});

describe("Podium", () => {
  const standings = computeStandings(players, [round]);

  it("puts tied players on the same step", () => {
    const html = renderToStaticMarkup(<Podium standings={standings} />);
    expect(html).toContain('aria-label="1st place"');
    expect(html).not.toContain('aria-label="2nd place"');
  });

  it("reads the steps 1st, 2nd, 3rd in the DOM", () => {
    const html = renderToStaticMarkup(
      <Podium
        standings={computeStandings(players, [
          [
            result("riya", 50, 60_000),
            result("sam", 115, 42_000),
            result("kai", 80, 50_000),
          ],
        ])}
      />,
    );
    const steps = [...html.matchAll(/aria-label="(\w+) place"/g)].map(
      (m) => m[1],
    );
    expect(steps).toEqual(["1st", "2nd", "3rd"]);
  });

  it("shows admin buttons only to the admin", () => {
    const props = {
      standings,
      onPlayAgain: () => {},
      onCloseRoom: () => {},
    };
    expect(renderToStaticMarkup(<Podium {...props} />)).not.toContain(
      "Play again",
    );
    const html = renderToStaticMarkup(<Podium {...props} isAdmin />);
    expect(html).toContain("Play again");
    expect(html).toContain("Close room");
  });

  it("explains when nobody scored", () => {
    const html = renderToStaticMarkup(
      <Podium standings={computeStandings(players, [])} />,
    );
    expect(html).toContain("Nobody scored this game");
  });
});
