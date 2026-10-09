import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/components/ui/cn";
import { splitDuplicateSuffix } from "./name-avatar";

export interface RoomPlayer {
  id: string;
  name: string;
  avatar: string;
  isAdmin: boolean;
  connected: boolean;
}

export function PlayerList({
  players,
  selfId,
}: {
  players: RoomPlayer[];
  selfId?: string;
}) {
  if (players.length === 0) {
    return (
      <p role="status" className="text-muted">
        No players yet. Share the code to get started.
      </p>
    );
  }

  return (
    <ul aria-label="Players" className="flex flex-col gap-2">
      {players.map((player) => {
        const { base, suffix } = splitDuplicateSuffix(player.name);
        return (
          <li
            key={player.id}
            className="flex items-center gap-2 rounded-lg border-2 border-border-subtle bg-surface p-2 sm:gap-3"
          >
            <Avatar emoji={player.avatar} name={player.name} size="sm" />
            <span
              title={player.name}
              className="flex w-0 min-w-0 flex-1 items-baseline gap-1 font-bold"
            >
              <span className="min-w-[2ch] truncate">{base}</span>
              {suffix && <span className="shrink-0">{suffix}</span>}
              {player.id === selfId && (
                <span className="shrink-0 font-normal text-muted">(you)</span>
              )}
            </span>
            {player.isAdmin && (
              <span
                role="img"
                aria-label="Room admin"
                title="Room admin"
                className="shrink-0"
              >
                👑
              </span>
            )}
            <span
              title={player.connected ? "Connected" : "Disconnected"}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 text-sm",
                player.connected ? "text-success" : "text-muted",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-2.5 rounded-full",
                  player.connected ? "bg-success" : "bg-muted",
                )}
              />
              <span className="sr-only sm:not-sr-only">
                {player.connected ? "Connected" : "Disconnected"}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
