import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import {
  ROOM_AWARDS,
  awardsOf,
  type PlayerAwards,
} from "@/lib/game/room-awards";

export type RoomAwards = ReadonlyMap<string, PlayerAwards>;

// On phones, compact chips drop the pill so all of them fit a tight row.
const COMPACT_CHIP = "max-sm:border-0 max-sm:bg-transparent max-sm:px-0";

/**
 * A player's Race Room awards as small chips: 🩸 ⚡ 🧠 and "🔥 x2" for a win
 * streak. Screen readers hear the award names. Renders nothing without any.
 * `compact` keeps the chips on one line and drops their pill on phones, for
 * fixed-height rows (`cn` does not merge Tailwind classes, so pass this
 * rather than overriding `flex-wrap` through `className`).
 */
export function AwardBadges({
  awards,
  playerId,
  compact = false,
  className,
}: {
  awards?: RoomAwards | null;
  playerId: string;
  compact?: boolean;
  className?: string;
}) {
  const { awards: earned, winStreak } = awardsOf(awards ?? null, playerId);
  if (earned.length === 0 && winStreak === 0) return null;
  const streak = ROOM_AWARDS["win-streak"];
  const chip = cn("shrink-0 whitespace-nowrap", compact && COMPACT_CHIP);
  return (
    <span
      data-testid="room-awards"
      className={cn(
        "inline-flex gap-1",
        compact ? "flex-nowrap" : "flex-wrap",
        className,
      )}
    >
      {earned.map((id) => {
        const award = ROOM_AWARDS[id];
        return (
          <Badge
            key={id}
            variant="warning"
            size="sm"
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
          size="sm"
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
