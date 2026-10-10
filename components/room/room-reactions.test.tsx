import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReactionCounter, RoomReactions } from "./room-reactions";

describe("ReactionCounter", () => {
  it("counts each reaction, in the bar's order", () => {
    const html = renderToStaticMarkup(
      <ReactionCounter
        reactions={[
          { id: 1, emoji: "🐛", x: 0 },
          { id: 2, emoji: "🔥", x: 0 },
          { id: 3, emoji: "🐛", x: 0 },
        ]}
      />,
    );
    expect(html).toMatch(/🔥 ×1.*🐛 ×2/);
  });

  it("is empty with no reactions", () => {
    const html = renderToStaticMarkup(<ReactionCounter reactions={[]} />);
    expect(html).not.toContain("×");
  });
});

describe("RoomReactions", () => {
  it("renders the bar, and no floating layer until it knows motion is allowed", () => {
    const html = renderToStaticMarkup(
      <RoomReactions
        selfId="p1"
        memberIds={["p1"]}
        onlineCount={1}
        sendReaction={() => true}
        subscribeReactions={() => () => {}}
      />,
    );
    expect(html).toContain('aria-label="Send a reaction"');
    expect(html).toContain('data-testid="reaction-counter"');
    expect(html).not.toContain('data-testid="floating-reactions"');
  });
});
