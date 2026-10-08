import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/components/ui/cn";

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
      {players.map((player) => (
        <li
          key={player.id}
          className="flex items-center gap-3 rounded-lg border-2 border-border-subtle bg-surface p-2"
        >
          <Avatar emoji={player.avatar} name={player.name} size="sm" />
          <span className="w-0 min-w-0 flex-1 truncate font-bold">
            {player.name}
            {player.id === selfId && (
              <span className="ml-1 font-normal text-muted">(you)</span>
            )}
          </span>
          {player.isAdmin && (
            <span role="img" aria-label="Room admin" title="Room admin">
              👑
            </span>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-sm",
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
            {player.connected ? "Connected" : "Disconnected"}
          </span>
        </li>
      ))}
    </ul>
  );
}
