"use client";

import { useEffect } from "react";
import { armSound } from "@/lib/sound/sound-store";

/** Watches for the first click or key press on any page, so sound can play after it. */
export function SoundArm() {
  useEffect(armSound, []);
  return null;
}
