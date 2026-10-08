import {
  type ResolvedTheme,
  type Theme,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  parseTheme,
  resolveTheme,
} from "./theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const listeners = new Set<() => void>();
// Fallback for when localStorage is blocked, so the choice still holds for this visit.
let sessionTheme: Theme = DEFAULT_THEME;

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  const onExternalChange = () => {
    applyTheme();
    notify();
  };
  window.addEventListener("storage", onExternalChange);
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onExternalChange);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onExternalChange);
    media.removeEventListener("change", onExternalChange);
  };
}

export function getStoredTheme(): Theme {
  try {
    return parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return sessionTheme;
  }
}

export function getResolvedTheme(): ResolvedTheme {
  return resolveTheme(getStoredTheme(), window.matchMedia(DARK_QUERY).matches);
}

export function applyTheme() {
  document.documentElement.dataset.theme = getResolvedTheme();
}

export function setStoredTheme(theme: Theme) {
  sessionTheme = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked (private mode); sessionTheme keeps the choice.
  }
  applyTheme();
  notify();
}
