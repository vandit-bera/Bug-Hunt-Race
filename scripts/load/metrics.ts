/**
 * Pure helpers for the room load test (`scripts/load/room-30.ts`): latency
 * summaries, a Realtime message meter and the correctness checks. No I/O, so
 * they are unit tested.
 */

export interface Summary {
  count: number;
  p50: number;
  p95: number;
  max: number;
}

/** Nearest-rank percentile of `values` (0 < p ≤ 100); NaN when empty. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(rank, 1)) - 1];
}

export function summarize(values: readonly number[]): Summary {
  return {
    count: values.length,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    max: values.length === 0 ? Number.NaN : Math.max(...values),
  };
}

/**
 * The Realtime event name of one WebSocket frame. Text frames are Phoenix
 * messages, either `[join_ref, ref, topic, event, payload]` (protocol 2.0.0)
 * or `{ topic, event, payload, ref }` (1.0.0). Binary frames carry
 * broadcasts.
 */
export function frameEvent(data: unknown): string {
  if (typeof data !== "string") return "binary";
  try {
    const message: unknown = JSON.parse(data);
    if (Array.isArray(message) && typeof message[3] === "string") {
      return message[3];
    }
    if (
      message !== null &&
      typeof message === "object" &&
      "event" in message &&
      typeof message.event === "string"
    ) {
      return message.event;
    }
  } catch {
    // Not JSON: count it, but under its own name.
  }
  return "unknown";
}

/** Phoenix protocol traffic that is not a room update. */
const PROTOCOL_EVENTS = new Set(["phx_reply", "heartbeat", "phx_close"]);

export type MessageKind =
  | "postgres_changes"
  | "presence"
  | "other"
  /** A client's own presence `track()` (sent, not received). */
  | "presence_sent";

/**
 * Groups an event the way Supabase meters it: database changes and presence
 * are billed Realtime messages; protocol replies (join acks, heartbeats) are
 * not room updates and are left out of the peak. Of what a client sends,
 * only presence updates are counted.
 */
export function messageKind(event: string, sent = false): MessageKind | null {
  if (sent) return event === "presence" ? "presence_sent" : null;
  if (PROTOCOL_EVENTS.has(event)) return null;
  if (event === "postgres_changes") return "postgres_changes";
  if (event === "presence_state" || event === "presence_diff") {
    return "presence";
  }
  return "other";
}

export interface MessagePeak {
  /** Messages of this kind in the busiest 1 s window. */
  perSecond: number;
  /** Milliseconds since the meter started, at the start of that window. */
  atMs: number;
}

type Bucket = Map<number, number>;

/**
 * Counts messages received (and presence updates sent) by every simulated
 * client, per 1 s window and per test phase. "all" is everything received. A window that spans a phase change is split between the two
 * phases, so each phase's peak only counts its own messages.
 */
export class MessageMeter {
  private readonly buckets = new Map<string, Bucket>();
  private phase = "";
  readonly totals = new Map<MessageKind, number>();

  constructor(private readonly startMs: number) {}

  /** Messages recorded from now on belong to `name`. */
  setPhase(name: string) {
    this.phase = name;
  }

  record(event: string, atMs: number, sent = false) {
    const kind = messageKind(event, sent);
    if (!kind) return;
    this.totals.set(kind, (this.totals.get(kind) ?? 0) + 1);
    const second = Math.floor((atMs - this.startMs) / 1000);
    const keys = sent ? [kind] : [kind, "all" as const];
    for (const key of keys) {
      for (const phase of new Set(["", this.phase])) {
        const name = `${phase}|${key}`;
        const bucket: Bucket = this.buckets.get(name) ?? new Map();
        bucket.set(second, (bucket.get(second) ?? 0) + 1);
        this.buckets.set(name, bucket);
      }
    }
  }

  /** Messages received. */
  total(): number {
    let sum = 0;
    for (const [kind, count] of this.totals) {
      if (kind !== "presence_sent") sum += count;
    }
    return sum;
  }

  /** The busiest 1 s window of `kind`, overall or within one phase. */
  peak(kind: MessageKind | "all" = "all", phase = ""): MessagePeak {
    let best: MessagePeak = { perSecond: 0, atMs: 0 };
    for (const [second, count] of this.buckets.get(`${phase}|${kind}`) ?? []) {
      if (count > best.perSecond) {
        best = { perSecond: count, atMs: second * 1000 };
      }
    }
    return best;
  }
}

/**
 * Checks the room's duplicate-name rule: the k-th player who asked for a name
 * got `Name`, `Name (2)`, … `Name (k)`, in some order. `granted` maps each
 * requested name to the names the database gave those players.
 */
export function checkDuplicateNames(
  granted: ReadonlyMap<string, readonly string[]>,
): string[] {
  const errors: string[] = [];
  for (const [requested, names] of granted) {
    const expected = names.map((_, i) =>
      i === 0 ? requested : `${requested} (${i + 1})`,
    );
    const actual = [...names].sort(compareSuffixed);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      errors.push(
        `"${requested}" × ${names.length}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
      );
    }
  }
  return errors;
}

function compareSuffixed(a: string, b: string): number {
  const suffix = (name: string) => Number(/ \((\d+)\)$/.exec(name)?.[1] ?? 1);
  return suffix(a) - suffix(b);
}

export interface ScoreTotal {
  playerId: string;
  points: number;
  solveMs: number;
}

/**
 * Leaderboard places from server-side totals: more points first, then less
 * total solve time (measured by the database clock); exact ties share the
 * place, like SQL `rank()`.
 */
export function expectedRanks(
  totals: readonly ScoreTotal[],
): Map<string, number> {
  const sorted = [...totals].sort(
    (a, b) => b.points - a.points || a.solveMs - b.solveMs,
  );
  const ranks = new Map<string, number>();
  sorted.forEach((entry, i) => {
    const previous = sorted[i - 1];
    const tied =
      previous &&
      previous.points === entry.points &&
      previous.solveMs === entry.solveMs;
    ranks.set(entry.playerId, tied ? ranks.get(previous.playerId)! : i + 1);
  });
  return ranks;
}

/**
 * The distinct values among clients' snapshots, with how many clients hold
 * each. One entry means every client agrees.
 */
export function distinctSnapshots<T>(snapshots: readonly T[]): number[] {
  const counts = new Map<string, number>();
  for (const snapshot of snapshots) {
    const key = JSON.stringify(snapshot);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.values()].sort((a, b) => b - a);
}
