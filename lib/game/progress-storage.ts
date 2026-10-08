import { EMPTY_PROGRESS, sanitizeProgress, type Progress } from "./progress";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** Bump the version when the stored shape changes incompatibly. */
const PROGRESS_KEY = "bhr:solo:progress:v1";

function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadProgress(
  storage: StorageLike | null = browserStorage(),
): Progress {
  try {
    return sanitizeProgress(
      JSON.parse(storage?.getItem(PROGRESS_KEY) ?? "null"),
    );
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function saveProgress(
  progress: Progress,
  storage: StorageLike | null = browserStorage(),
) {
  try {
    storage?.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Storage can be blocked or full; the game works without history.
  }
}
