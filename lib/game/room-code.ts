/**
 * Room codes: 6 characters from A-Z and 2-9, without the look-alikes
 * 0, O, 1 and I. The database generates codes (`private.generate_room_code`)
 * and enforces the format; this module validates what players type or paste.
 */

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

/** Uppercases and strips spaces and dashes, e.g. " bug-7kx " → "BUG7KX". */
export function normalizeRoomCode(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_PATTERN.test(code);
}
