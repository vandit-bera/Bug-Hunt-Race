/** The game's room limit (private.max_players_per_room). */
export const MAX_PLAYERS_PER_ROOM = 30;

/** The room page: the lobby, and later the race itself. */
export function roomHref(code: string): string {
  return `/room/${code}`;
}

/** What players open or scan to join, e.g. https://site/join/BUG7KX. */
export function inviteLink(origin: string, code: string): string {
  return `${origin}/join/${code}`;
}
