"use client";

import Link from "next/link";
import { ErrorScreen } from "@/components/error-screen";
import { Button, buttonClass } from "@/components/ui/button";

/** Any page that crashes while rendering: friendly message, Retry and Home. */
export default function AppError({ retry }: { retry: () => void }) {
  return (
    <ErrorScreen
      emoji="🐛"
      title="Something went wrong"
      description="A bug got away from us. Try again, or head home and start over."
      actions={
        <>
          <Button onClick={() => retry()}>Retry</Button>
          <Link href="/" className={buttonClass({ variant: "secondary" })}>
            Home
          </Link>
        </>
      }
    />
  );
}
