"use client";

import Link from "next/link";
import { Button, buttonClass } from "@/components/ui/button";
import { RoomErrorCard } from "./room-error-card";

/**
 * The room screens' state for "Supabase or the network is down" (an error
 * for which `isUnavailableError` is true): a friendly card with Retry, never
 * a white screen or the error itself. Results already saved stay saved.
 */
export function ConnectionError({
  onRetry,
  retrying = false,
}: {
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <RoomErrorCard
      kind="offline"
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onRetry} loading={retrying}>
            Retry
          </Button>
          <Link href="/" className={buttonClass({ variant: "secondary" })}>
            Home
          </Link>
        </div>
      }
    />
  );
}
