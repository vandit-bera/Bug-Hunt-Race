export const MUTE_STORAGE_KEY = "bhr:muted";

const listeners = new Set<() => void>();
// Fallback for when localStorage is blocked, so the choice still holds for this visit.
let sessionMuted = false;
let interacted = false;
let detachInteraction: (() => void) | null = null;

function notify() {
  listeners.forEach((listener) => listener());
}

function onInteraction() {
  interacted = true;
  detachInteraction?.();
  detachInteraction = null;
  notify();
}

// Browsers block audio until the user acts, so sound stays off until then.
function watchInteraction() {
  if (interacted || detachInteraction) return;
  const events = ["pointerdown", "keydown"] as const;
  events.forEach((type) =>
    window.addEventListener(type, onInteraction, { capture: true }),
  );
  detachInteraction = () =>
    events.forEach((type) =>
      window.removeEventListener(type, onInteraction, { capture: true }),
    );
}

export function subscribeMuted(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", notify);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", notify);
  };
}

export function getMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return sessionMuted;
  }
}

export function setMuted(muted: boolean) {
  sessionMuted = muted;
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");
  } catch {
    // Storage can be blocked (private mode); sessionMuted keeps the choice.
  }
  notify();
}

/** True once the player has pressed a key or clicked, and has not muted. */
export function canPlaySound(): boolean {
  watchInteraction();
  return interacted && !getMuted();
}

/** Starts listening for the first interaction. Call once when the app mounts. */
export function armSound() {
  watchInteraction();
}
