export const REACTION_EMOJIS = ["😂", "🔥", "👏", "😱", "🐛", "🚀"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export const REACTION_COOLDOWN_MS = 1000;
export const MAX_FLOATING_REACTIONS = 20;

export function isCoolingDown(
  lastReactionAt: number | null,
  now: number,
  cooldownMs: number = REACTION_COOLDOWN_MS,
): boolean {
  return lastReactionAt !== null && now - lastReactionAt < cooldownMs;
}

/** Keeps the newest `max` items, dropping the oldest. */
export function capNewest<T>(items: readonly T[], max: number): T[] {
  return items.length > max ? items.slice(items.length - max) : [...items];
}

/**
 * Adds a reaction and drops the oldest ones over the cap. Callers should store
 * reactions through this so the list never grows past `max`.
 */
export function addCapped<T>(
  items: readonly T[],
  item: T,
  max: number = MAX_FLOATING_REACTIONS,
): T[] {
  return capNewest([...items, item], max);
}

/** The oldest items that do not fit under the cap. */
export function overflow<T>(items: readonly T[], max: number): T[] {
  return items.slice(0, Math.max(items.length - max, 0));
}

export type RankRow = {
  id: string;
  name: string;
  emoji: string;
  score: number;
};
export type RankedRow = RankRow & {
  rank: number;
  /** Places gained (positive) or lost (negative) at the last reorder. */
  change: number;
};

/**
 * Orders rows by score (highest first). Ties keep their previous order so rows
 * don't jump around. `change` compares against `previous`; when a row did not
 * move, the earlier marker is kept until the next move.
 */
export function rankRows(
  rows: readonly RankRow[],
  previous: readonly RankedRow[] = [],
): RankedRow[] {
  const before = new Map(previous.map((row) => [row.id, row]));
  const order = (id: string) => before.get(id)?.rank ?? Infinity;
  return [...rows]
    .sort((a, b) => b.score - a.score || order(a.id) - order(b.id))
    .map((row, index) => {
      const old = before.get(row.id);
      const rank = index + 1;
      const moved = old ? old.rank - rank : 0;
      return { ...row, rank, change: moved || (old?.change ?? 0) };
    });
}
