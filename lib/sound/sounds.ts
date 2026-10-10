import { canPlaySound } from "./sound-store";

export const SOUND_NAMES = [
  "tick",
  "go",
  "pass",
  "fail",
  "solved",
  "timeup",
  "react",
] as const;

export type SoundName = (typeof SOUND_NAMES)[number];

const VOLUME = 0.5;

/** Plays a bundled sound effect. Does nothing while muted or before the first user interaction. */
export function playSound(name: SoundName) {
  if (typeof window === "undefined" || !canPlaySound()) return;
  const audio = new Audio(`/sounds/${name}.wav`);
  audio.volume = VOLUME;
  // Playback can still be refused (no audio device, autoplay policy); sound is optional.
  audio.play().catch(() => {});
}
