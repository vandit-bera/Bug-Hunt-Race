import type { ReactNode } from "react";
import { Card, CardTitle } from "@/components/ui/card";

export type RoomErrorKind =
  "not-found" | "closed" | "locked" | "full" | "disconnected" | "offline";

const COPY: Record<
  RoomErrorKind,
  { emoji: string; title: string; description: string }
> = {
  "not-found": {
    emoji: "🔍",
    title: "Room not found",
    description:
      "Check the code and try again. It may have ended, or the link is old.",
  },
  closed: {
    emoji: "🏁",
    title: "Room closed",
    description:
      "This game is over and the room is closed. Join another room or create a new one.",
  },
  locked: {
    emoji: "🔒",
    title: "This room is locked",
    description: "The admin stopped new players from joining.",
  },
  full: {
    emoji: "🚪",
    title: "Room is full (30/30)",
    description: "Rooms hold up to 30 players. Ask the admin to make space.",
  },
  disconnected: {
    emoji: "📡",
    title: "You got disconnected",
    description: "We lost the connection to the room. Try to reconnect.",
  },
  offline: {
    emoji: "🔌",
    title: "Can't reach the game",
    description:
      "The network or the game server is down. Your seat and saved scores are safe; retry in a moment.",
  },
};

/** Pass the action button (e.g. "Try another code") as `action`. */
export function RoomErrorCard({
  kind,
  action,
}: {
  kind: RoomErrorKind;
  action: ReactNode;
}) {
  const { emoji, title, description } = COPY[kind];
  return (
    <Card role="alert" className="flex flex-col items-center gap-3 text-center">
      <span aria-hidden="true" className="text-5xl">
        {emoji}
      </span>
      <CardTitle className="mb-0 text-lg sm:text-xl">{title}</CardTitle>
      <p className="text-muted">{description}</p>
      {action}
    </Card>
  );
}
