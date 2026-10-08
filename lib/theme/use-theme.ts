"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_THEME, type Theme } from "./theme";
import { getStoredTheme, setStoredTheme, subscribeTheme } from "./theme-store";

export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getStoredTheme,
    () => DEFAULT_THEME,
  );
  return [theme, setStoredTheme];
}
