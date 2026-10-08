import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlayerList, type RoomPlayer } from "./player-list";
import { RoomErrorCard } from "./room-error-card";

const players: RoomPlayer[] = [
  { id: "1", name: "Mika", avatar: "🦊", isAdmin: true, connected: true },
  { id: "2", name: "Sam", avatar: "🐼", isAdmin: false, connected: false },
];

describe("PlayerList", () => {
  it("marks the admin, the current player and connection state", () => {
    const html = renderToStaticMarkup(
      <PlayerList players={players} selfId="2" />,
    );
    expect(html).toContain("👑");
    expect(html).toContain("(you)");
    expect(html).toContain("Connected");
    expect(html).toContain("Disconnected");
  });

  it("shows an empty state", () => {
    expect(renderToStaticMarkup(<PlayerList players={[]} />)).toContain(
      "No players yet",
    );
  });
});

describe("RoomErrorCard", () => {
  it("renders the message and the action", () => {
    const html = renderToStaticMarkup(
      <RoomErrorCard kind="full" action={<button>Back</button>} />,
    );
    expect(html).toContain("Room is full (30/30)");
    expect(html).toContain("<button>Back</button>");
  });
});
