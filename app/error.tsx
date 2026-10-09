"use client";

import { ErrorScreen } from "@/components/error-screen";
import { buttonClass } from "@/components/ui/button";

/**
 * Any page that crashes while rendering: friendly message, Retry and Home.
 * Part of every page's first load, so it stays small: plain elements, and
 * Home is a full page load, which also clears whatever state crashed.
 */
export default function AppError({ retry }: { retry: () => void }) {
  return (
    <ErrorScreen
      emoji="🐛"
      title="Something went wrong"
      description="A bug got away from us. Try again, or head home and start over."
      actions={
        <>
          <button
            type="button"
            className={buttonClass()}
            onClick={() => retry()}
          >
            Retry
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full reload is the point */}
          <a href="/" className={buttonClass({ variant: "secondary" })}>
            Home
          </a>
        </>
      }
    />
  );
}
