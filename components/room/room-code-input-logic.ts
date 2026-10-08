import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  normalizeRoomCode,
} from "@/lib/game/room-code";

export interface SanitizedRoomCode {
  value: string;
  /** Look-alike characters (0, O, 1, I) that were removed from the input. */
  rejected: string[];
}

const LOOK_ALIKES = new Set(["0", "O", "1", "I"]);

/** Cleans typed or pasted text into at most 6 valid room code characters. */
export function sanitizeRoomCodeInput(raw: string): SanitizedRoomCode {
  const rejected: string[] = [];
  let value = "";
  for (const char of normalizeRoomCode(raw)) {
    if (ROOM_CODE_ALPHABET.includes(char)) {
      value += char;
    } else if (LOOK_ALIKES.has(char)) {
      rejected.push(char);
    }
  }
  return { value: value.slice(0, ROOM_CODE_LENGTH), rejected };
}

export function lookAlikeHint(rejected: string[]): string | undefined {
  if (rejected.length === 0) return undefined;
  const unique = [...new Set(rejected)].join(", ");
  return `Codes never use ${unique} (they look like other characters), so we skipped it.`;
}
