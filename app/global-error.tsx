"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ErrorScreen } from "@/components/error-screen";
import { Button, buttonClass } from "@/components/ui/button";
import { applyTheme, subscribeTheme } from "@/lib/theme/theme-store";
import "./globals.css";

const noop = () => {};

/**
 * When the root layout itself fails, this replaces the whole document, so it
 * brings its own <html>, styles and theme.
 */
export default function GlobalError({ retry }: { retry: () => void }) {
  useEffect(() => {
    applyTheme();
    return subscribeTheme(noop);
  }, []);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <title>Something went wrong · Bug Hunt Race</title>
        <ErrorScreen
          emoji="💥"
          title="Something went wrong"
          description="The game hit an unexpected error. Retry, or reload from the home page."
          actions={
            <>
              <Button onClick={() => retry()}>Retry</Button>
              <Link href="/" className={buttonClass({ variant: "secondary" })}>
                Home
              </Link>
            </>
          }
        />
      </body>
    </html>
  );
}
