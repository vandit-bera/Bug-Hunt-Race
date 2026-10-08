"use client";

import { useSyncExternalStore } from "react";
import { getPreloadState, subscribePreload } from "./preload";
import { IDLE_STATE, READY_STATE, type PreloadState } from "./preload-state";
import type { LanguageId } from "./types";

/** React hook over the runner's loading state; re-renders on every change. */
export function usePreloadState(language: LanguageId): PreloadState {
  return useSyncExternalStore(
    (listener) => subscribePreload(language, listener),
    () => getPreloadState(language),
    () => (language === "python" ? IDLE_STATE : READY_STATE),
  );
}
