"use client";

import { useEffect } from "react";
import { subscribeTheme } from "@/lib/theme/theme-store";

const noop = () => {};

// Keeps data-theme in sync with OS and cross-tab changes on every page.
export function ThemeSync() {
  useEffect(() => subscribeTheme(noop), []);
  return null;
}
