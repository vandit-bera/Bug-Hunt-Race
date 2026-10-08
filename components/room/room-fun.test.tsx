import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FloatingReactions } from "./floating-reactions";
import { LiveRankList } from "./live-rank-list";
import { ReactionBar } from "./reaction-bar";
import { SolveToasts } from "./solve-toast";

describe("ReactionBar", () => {
  it("renders six labelled reaction buttons", () => {
    const html = renderToStaticMarkup(<ReactionBar onReact={() => {}} />);
    expect(html.match(/<button/g)).toHaveLength(6);
    expect(html).toContain('aria-label="Rocket"');
  });
});

describe("FloatingReactions", () => {
  const many = Array.from({ length: 30 }, (_, id) => ({
    id,
    emoji: "🔥",
    x: 10,
  }));

  it("shows at most 20 reactions", () => {
    const html = renderToStaticMarkup(
      <FloatingReactions reactions={many} onExpire={() => {}} />,
    );
    expect(html.match(/🔥/g)).toHaveLength(20);
  });

  it("hides the float animation for reduced motion", () => {
    const html = renderToStaticMarkup(
      <FloatingReactions reactions={many} onExpire={() => {}} />,
    );
    expect(html).toContain("motion-reduce:hidden");
    expect(html).toContain("motion-safe:animate-");
  });
});

describe("SolveToasts", () => {
  it("shows a medal only for the top 3", () => {
    const toast = (id: number, rank: number) => ({
      id,
      name: "Riya",
      emoji: "🦊",
      seconds: 42,
      rank,
    });
    const html = renderToStaticMarkup(
      <SolveToasts toasts={[toast(1, 1), toast(2, 4)]} onDismiss={() => {}} />,
    );
    expect(html).toContain("Riya fixed it in 42s!");
    expect(html.match(/1st place/g)).toHaveLength(1);
    expect(html).not.toContain("4th place");
  });
});

describe("LiveRankList", () => {
  it("places rows by score", () => {
    const html = renderToStaticMarkup(
      <LiveRankList
        rows={[
          { id: "a", name: "Ann", emoji: "🦊", score: 10 },
          { id: "b", name: "Bo", emoji: "🐙", score: 99 },
        ]}
      />,
    );
    const top = /translateY\(0rem\)[\s\S]*?Bo/.test(html);
    expect(top).toBe(true);
  });

  it("shows an empty state", () => {
    expect(renderToStaticMarkup(<LiveRankList rows={[]} />)).toContain(
      "No players yet",
    );
  });
});
