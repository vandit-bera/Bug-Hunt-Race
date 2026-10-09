import type { RoomConnectionStatus } from "@/lib/rooms/connection";

/**
 * Shown while a room connection is coming back
 * (`useRoomConnection(...).status === "reconnecting"`). The player keeps
 * their seat and scores meanwhile; nothing to do but wait.
 */
export function ReconnectingBanner({
  status,
}: {
  status: RoomConnectionStatus;
}) {
  return (
    <div role="status" aria-live="polite" className="empty:hidden">
      {status === "reconnecting" && (
        <p className="flex items-center gap-3 rounded-lg border-2 border-warning bg-surface-raised px-4 py-3 text-sm font-bold">
          <span
            aria-hidden="true"
            className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent text-warning"
          />
          <span>Reconnecting… Your seat and score are safe.</span>
        </p>
      )}
    </div>
  );
}
