import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import {
  ROOM_AWARDS,
  awardsOf,
  type PlayerAwards,
} from "@/lib/game/room-awards";

export type RoomAwards = ReadonlyMap<string, PlayerAwards>;

const chip = "gap-0.5 px-1.5 py-0 leading-tight";

/**
 * A player's Race Room awards as small chips: 🩸 ⚡ 🧠 and "🔥 x2" for a win
 * streak. Screen readers hear the award names. Renders nothing without any.
 */
export function AwardBadges({
  awards,
  playerId,
  className,
}: {
  awards?: RoomAwards | null;
  playerId: string;
  className?: string;
}) {
  const { awards: earned, winStreak } = awardsOf(awards ?? null, playerId);
  if (earned.length === 0 && winStreak === 0) return null;
  const streak = ROOM_AWARDS["win-streak"];
  return (
    <span
      data-testid="room-awards"
      className={cn("inline-flex flex-wrap gap-1", className)}
    >
      {earned.map((id) => {
        const award = ROOM_AWARDS[id];
        return (
          <Badge
            key={id}
            variant="warning"
            title={`${award.name}: ${award.howTo}`}
            className={chip}
          >
            <span aria-hidden="true">{award.emoji}</span>
            <span className="sr-only">{award.name}</span>
          </Badge>
        );
      })}
      {winStreak > 0 && (
        <Badge
          variant="danger"
          title={`${streak.name}: ${winStreak} games won in a row`}
          className={chip}
        >
          <span aria-hidden="true">
            {streak.emoji} x{winStreak}
          </span>
          <span className="sr-only">
            {streak.name}: {winStreak} games won in a row
          </span>
        </Badge>
      )}
    </span>
  );
}
