"use client";

import { useSyncExternalStore } from "react";
import { getMuted, setMuted, subscribeMuted } from "./sound-store";

export function useMuted(): [boolean, (muted: boolean) => void] {
  const muted = useSyncExternalStore(subscribeMuted, getMuted, () => false);
  return [muted, setMuted];
}
