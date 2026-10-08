import { pythonPool } from "./python/browser-pool";
import {
  READY_STATE,
  type PreloadListener,
  type PreloadState,
} from "./preload-state";
import type { LanguageId } from "./types";

/**
 * Warms a language's runner before the player needs it, so the first run is
 * instant. JS and TS start in milliseconds and are always ready; Python
 * downloads and boots Pyodide (about 13 MB the first time, then cached).
 * Safe to call repeatedly. Never rejects: failures show in `getPreloadState`.
 */
export async function preloadRunner(language: LanguageId): Promise<void> {
  if (language === "python") await pythonPool.warm().catch(() => {});
}

/** Current loading state, for a loading bar. Stable between changes. */
export function getPreloadState(language: LanguageId): PreloadState {
  return language === "python" ? pythonPool.store.getState() : READY_STATE;
}

/** `useSyncExternalStore`-style subscription; returns the unsubscribe. */
export function subscribePreload(
  language: LanguageId,
  listener: PreloadListener,
): () => void {
  return language === "python"
    ? pythonPool.store.subscribe(listener)
    : () => {};
}
