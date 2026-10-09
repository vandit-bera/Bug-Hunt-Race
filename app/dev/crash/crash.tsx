"use client";

import { useSyncExternalStore } from "react";

/** Set this localStorage key to "off" to stop the crash (for Retry). */
export const CRASH_KEY = "bhr-dev-crash";

const subscribe = () => () => {};

/**
 * Throws while rendering, as a buggy page would, but only in the browser:
 * the server render stays clean, so the client error boundary
 * (app/error.tsx) is what catches it.
 */
export function Crash() {
  const crash = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(CRASH_KEY) !== "off",
    () => false,
  );
  if (crash) throw new Error("Crash test: this page failed on purpose.");
  return (
    <main className="p-6">
      <h1 className="font-display text-3xl font-bold">Recovered</h1>
    </main>
  );
}
