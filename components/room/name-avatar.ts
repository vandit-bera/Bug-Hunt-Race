export const NAME_MAX_LENGTH = 20;

export const AVATAR_EMOJIS = [
  "🦊",
  "🐙",
  "🦄",
  "🐼",
  "🐸",
  "🦉",
  "🐧",
  "🦖",
  "🐝",
  "🦋",
  "🐳",
  "🦁",
];

export interface PlayerProfile {
  name: string;
  avatar: string;
}

const PROFILE_KEY = "bhr:room:profile";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Returns an error message, or null when the (trimmed) name is fine. */
export function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Enter a name.";
  if (trimmed.length > NAME_MAX_LENGTH) {
    return `Names have at most ${NAME_MAX_LENGTH} characters.`;
  }
  if (/[<>]/.test(trimmed)) return "Names can't contain < or >.";
  return null;
}

export function loadProfile(
  storage: StorageLike | null = browserStorage(),
): PlayerProfile | null {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(PROFILE_KEY) ?? "null");
    if (typeof parsed !== "object" || parsed === null) return null;
    const { name, avatar } = parsed as Record<string, unknown>;
    if (typeof name !== "string" || validateName(name) !== null) return null;
    if (typeof avatar !== "string" || !AVATAR_EMOJIS.includes(avatar)) {
      return null;
    }
    return { name: name.trim(), avatar };
  } catch {
    return null;
  }
}

export function saveProfile(
  profile: PlayerProfile,
  storage: StorageLike | null = browserStorage(),
) {
  try {
    storage?.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Storage can be blocked or full; the form works without memory.
  }
}
