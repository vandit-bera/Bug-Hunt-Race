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

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
    media.removeEventListener("change", listener);
  };
}

export function getStoredTheme(): Theme {
  try {
    return parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function getResolvedTheme(): ResolvedTheme {
  return resolveTheme(getStoredTheme(), window.matchMedia(DARK_QUERY).matches);
}

export function applyTheme() {
  document.documentElement.dataset.theme = getResolvedTheme();
}

export function setStoredTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked (private mode); the theme still applies for this visit.
  }
  applyTheme();
  notify();
}
