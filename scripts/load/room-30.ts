import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import {
  DbError,
  advanceRoom,
  createRoom,
  ensureSignedIn,
  getCurrentRound,
  getLeaderboard,
  joinRoom,
  recordScore,
  type Database,
  type DbClient,
  type LeaderboardEntry,
  type RoomEvent,
  type RoomStatus,
} from "@/lib/db";
import {
  connectToRoom,
  type RoomConnection,
  type RoomView,
} from "@/lib/rooms/connection";
import { roomErrorMessage } from "@/lib/rooms/errors";
import {
  MessageMeter,
  checkDuplicateNames,
  distinctSnapshots,
  expectedRanks,
  frameEvent,
  summarize,
  timestampMicros,
  type MessageKind,
  type ScoreTotal,
  type Summary,
} from "./metrics";

/**
 * `pnpm load:room [--players 30] [--rounds 3] [--join-over 0]`: fills one
 * room on the LOCAL
 * Supabase with headless players (real `lib/db` and `lib/rooms` code, one
 * Supabase client and Realtime socket each), plays the rounds with everyone
 * submitting at once, drops the admin before the last round, and prints
 * latencies, Realtime message rates and correctness checks. Exits 1 if a
 * check fails. Refuses any Supabase that is not on this machine.
 *
 * Players join all at once by default (worst case); `--join-over <seconds>`
 * spreads the joins evenly over that time instead.
 *
 * The rounds run on the real round engine: `begin_round` picks the puzzle and
 * starts the clock; the host never submits, so each round ends on the
 * host's Skip. The local service-role key only reads the server-side totals.
 */

const ROOM_CAP = 30;
const AVATAR = "🐛";
/** Acceptance bar for a change reaching every client (TB-52). */
const P95_LIMIT_MS = 2_000;
const LIVE_TIMEOUT_MS = 15_000;
/** 15 s without a heartbeat, applied on someone's next 5 s heartbeat. */
const HAND_OVER_TIMEOUT_MS = 45_000;
/** Supabase Free plan Realtime quotas (docs/ARCHITECTURE.md → Capacity). */
const FREE_TIER = {
  connections: 200,
  messagesPerSecond: 100,
  presencePerSecond: 20,
  messagesPerMonth: 2_000_000,
};
/** Requested names; the repeats check the "Name (2)" rule under load. */
const DUPLICATE_NAMES = ["Riya", "Riya", "Riya", "Sam", "Sam"];

const { values } = parseArgs({
  options: {
    players: { type: "string", default: String(ROOM_CAP) },
    rounds: { type: "string", default: "3" },
    "join-over": { type: "string", default: "0" },
  },
});
const PLAYERS = Number(values.players);
const ROUNDS = Number(values.rounds);
const JOIN_OVER_MS = Number(values["join-over"]) * 1000;
if (!Number.isInteger(PLAYERS) || PLAYERS < 3 || PLAYERS > ROOM_CAP) {
  throw new Error(`--players must be 3–${ROOM_CAP}.`);
}
// The admin drops before the last round, so there must be one after it.
if (!Number.isInteger(ROUNDS) || ROUNDS < 2 || ROUNDS > 50) {
  throw new Error("--rounds must be 2–50.");
}
if (!(JOIN_OVER_MS >= 0 && JOIN_OVER_MS <= 600_000)) {
  throw new Error("--join-over must be 0–600 seconds.");
}

const now = () => performance.now();
const startedAt = now();
const meter = new MessageMeter(startedAt);
const phases: string[] = [];
/** Phases of the game itself (rounds, hand-over), not joining or churn. */
const gamePhases: string[] = [];

function phase(name: string, game = false) {
  phases.push(name);
  if (game) gamePhases.push(name);
  meter.setPhase(name);
  console.log(`… ${name}`);
}

/** The phase with the busiest 1 s window of `kind`. */
function peakPhase(kind: MessageKind | "all"): string {
  const peak = (p: string) => meter.peak(kind, p).perSecond;
  return phases.reduce(
    (best, p) => (peak(p) > peak(best) ? p : best),
    phases[0] ?? "–",
  );
}

// Local Supabase only --------------------------------------------------------

interface LocalSupabase {
  url: string;
  anonKey: string;
  serviceKey: string;
}

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

function localSupabase(): LocalSupabase {
  const output = execFileSync(
    "pnpm",
    ["exec", "supabase", "status", "-o", "json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  const status = JSON.parse(output.slice(output.indexOf("{"))) as Record<
    string,
    string | undefined
  >;
  const {
    API_URL: url,
    ANON_KEY: anonKey,
    SERVICE_ROLE_KEY: serviceKey,
  } = status;
  if (!url || !anonKey || !serviceKey) {
    throw new Error("Local Supabase is not running: run `pnpm db:start`.");
  }
  if (!LOCAL_HOSTS.has(new URL(url).hostname)) {
    throw new Error(`Refusing to load test a non-local Supabase: ${url}`);
  }
  return { url, anonKey, serviceKey };
}

const supabase = localSupabase();

/** Counts the Realtime frames a simulated client receives and sends. */
class CountingWebSocket extends WebSocket {
  constructor(url: string | URL, protocols?: string | string[]) {
    super(url, protocols);
    this.addEventListener("message", (event) =>
      meter.record(frameEvent(event.data), now()),
    );
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    meter.record(frameEvent(data), now(), true);
    super.send(data);
  }
}

function newClient(key = supabase.anonKey): DbClient {
  return createClient<Database>(supabase.url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    realtime: { transport: CountingWebSocket },
  });
}

// Utilities ------------------------------------------------------------------

function within<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Timed out after ${ms} ms: ${what}`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function describeError(error: unknown): string {
  if (error instanceof DbError) return error.code;
  return error instanceof Error ? error.message : String(error);
}

// A simulated player ---------------------------------------------------------

interface Leaderboard {
  /** `<room status>:<round>` it was loaded for. */
  key: string;
  entries: LeaderboardEntry[];
}

type Watcher = { test: () => boolean; resolve: (atMs: number) => void };

/** Statuses that show the leaderboard; clients load it when they see one. */
const LEADERBOARD_STATUSES: readonly RoomStatus[] = [
  "round_results",
  "final_leaderboard",
];

class SimPlayer {
  readonly client = newClient();
  playerId = "";
  grantedName = "";
  joinedAt = 0;
  /** When this client first connected, and first had the room on screen. */
  connectedAt = 0;
  firstViewAt = 0;
  view: RoomView | null = null;
  leaderboard: Leaderboard | null = null;
  readonly errors: string[] = [];
  /** First time this client saw each player id in the list / online. */
  readonly seenAt = new Map<string, number>();
  readonly onlineAt = new Map<string, number>();
  private connection: RoomConnection | null = null;
  private watchers: Watcher[] = [];
  private loadingKey = "";
  private closing = false;

  constructor(readonly requestedName: string) {}

  get connected(): boolean {
    return this.connection !== null;
  }

  connect(roomId: string) {
    if (this.connectedAt === 0) this.connectedAt = now();
    this.connection = connectToRoom(this.client, {
      roomId,
      playerId: this.playerId,
      onChange: (view) => this.onView(roomId, view),
      onClosed: () => {
        if (!this.closing) this.errors.push("room closed unexpectedly");
      },
      onError: (error) => this.errors.push(describeError(error)),
    });
  }

  disconnect() {
    this.connection?.disconnect();
    this.connection = null;
  }

  /** Stops quietly once the test closes the room on purpose. */
  close() {
    this.closing = true;
    this.disconnect();
  }

  /** Resolves with the time `test` first holds for this client. */
  watch(test: (player: SimPlayer) => boolean): Promise<number> {
    return new Promise((resolve) => {
      const watcher = { test: () => test(this), resolve };
      if (watcher.test()) resolve(now());
      else this.watchers.push(watcher);
    });
  }

  private onView(roomId: string, view: RoomView) {
    const at = now();
    if (this.firstViewAt === 0) this.firstViewAt = at;
    this.view = view;
    for (const player of view.players) {
      if (!this.seenAt.has(player.id)) this.seenAt.set(player.id, at);
    }
    for (const id of view.online) {
      if (!this.onlineAt.has(id)) this.onlineAt.set(id, at);
    }
    const key = `${view.room.status}:${view.room.current_round}`;
    if (
      LEADERBOARD_STATUSES.includes(view.room.status) &&
      this.leaderboard?.key !== key &&
      this.loadingKey !== key
    ) {
      void this.loadLeaderboard(roomId, key);
    }
    this.check();
  }

  private async loadLeaderboard(roomId: string, key: string) {
    this.loadingKey = key;
    try {
      this.leaderboard = {
        key,
        entries: await getLeaderboard(this.client, roomId),
      };
      this.check();
    } catch (error) {
      this.errors.push(`leaderboard: ${describeError(error)}`);
    } finally {
      if (this.loadingKey === key) this.loadingKey = "";
    }
  }

  private check() {
    const at = now();
    this.watchers = this.watchers.filter((watcher) => {
      if (!watcher.test()) return true;
      watcher.resolve(at);
      return false;
    });
  }
}

/**
 * Runs `action` and returns, for each client, how long until `test` held
 * for it. Watchers start before the action, so nothing is missed.
 */
async function measure(
  clients: readonly SimPlayer[],
  test: (player: SimPlayer) => boolean,
  action: () => Promise<unknown>,
  what: string,
  timeoutMs = LIVE_TIMEOUT_MS,
): Promise<number[]> {
  const start = now();
  const waits = clients.map((client) => client.watch(test));
  await action();
  const times = await within(Promise.all(waits), timeoutMs, what);
  return times.map((at) => Math.max(0, at - start));
}

// Results --------------------------------------------------------------------

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

const checks: Check[] = [];
const latencies = {
  joinRpc: [] as number[],
  connect: [] as number[],
  joinVisibleToAll: [] as number[],
  joinOnlineToAll: [] as number[],
  presenceLeave: [] as number[],
  presenceJoin: [] as number[],
  roomStatus: [] as number[],
  scoreRpc: [] as number[],
  leaderboard: [] as number[],
  handOver: [] as number[],
};
let rpcErrors = 0;

function check(name: string, ok: boolean, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? ` (${detail})` : ""}`);
}

// The test -------------------------------------------------------------------

const service = newClient(supabase.serviceKey);

/** Server-side totals per player, read with the service role. */
async function serverTotals(roomId: string) {
  const [{ data: players, error: playersError }, { data: scores, error }] =
    await Promise.all([
      service.from("players").select("id").eq("room_id", roomId),
      service
        .from("scores")
        .select(
          "player_id, points, solve_time_ms, passed, submitted_at, rounds!inner(room_id)",
        )
        .eq("rounds.room_id", roomId),
    ]);
  if (playersError || error) {
    throw new Error(
      `Could not read scores: ${(playersError ?? error)!.message}`,
    );
  }
  const totals = new Map(
    players.map((p): [string, ScoreTotal] => [
      p.id,
      { playerId: p.id, points: 0, solveMs: 0, lastSolvedUs: null },
    ]),
  );
  for (const score of scores) {
    const total = totals.get(score.player_id)!;
    total.points += score.points;
    total.solveMs += score.solve_time_ms ?? 0;
    if (score.passed) {
      const solvedUs = timestampMicros(score.submitted_at);
      total.lastSolvedUs = Math.max(total.lastSolvedUs ?? solvedUs, solvedUs);
    }
  }
  return [...totals.values()];
}

async function verifyLeaderboards(
  roomId: string,
  clients: readonly SimPlayer[],
  key: string,
) {
  const boards = clients.map((c) =>
    (c.leaderboard?.entries ?? []).map((e) => [
      e.player_id,
      e.display_name,
      e.total_points,
      e.total_solve_ms,
      e.rank,
    ]),
  );
  const groups = distinctSnapshots(boards);
  check(
    `${key}: all ${clients.length} clients show the same leaderboard`,
    groups.length === 1 && boards[0].length === PLAYERS,
    groups.length === 1
      ? `${boards[0].length} rows`
      : `views: ${groups.join(" / ")}`,
  );

  const totals = await serverTotals(roomId);
  const ranks = expectedRanks(totals);
  const byId = new Map(totals.map((t) => [t.playerId, t]));
  const wrong = (clients[0].leaderboard?.entries ?? []).filter((entry) => {
    const total = byId.get(entry.player_id);
    return (
      !total ||
      total.points !== entry.total_points ||
      total.solveMs !== entry.total_solve_ms ||
      ranks.get(entry.player_id) !== entry.rank
    );
  });
  const tiedPlaces = new Set(
    [...ranks.values()].filter((rank, i, all) => all.indexOf(rank) !== i),
  ).size;
  check(
    `${key}: ranks follow points, then earliest last solve (server time)`,
    wrong.length === 0,
    wrong.length === 0
      ? `${tiedPlaces} shared place(s)`
      : `${wrong.length} row(s) differ from the server totals`,
  );
}

async function main(): Promise<number> {
  phase(`Signing in ${PLAYERS + 1} anonymous players`);
  const admin = new SimPlayer("Host");
  // One more joiner than seats: exactly one must be refused.
  const joiners = Array.from(
    { length: PLAYERS },
    (_, i) =>
      new SimPlayer(
        DUPLICATE_NAMES[i] ?? `Player ${String(i + 1).padStart(2, "0")}`,
      ),
  );
  await Promise.all([admin, ...joiners].map((p) => ensureSignedIn(p.client)));

  phase("Creating the room");
  const created = await createRoom(admin.client, {
    language: "javascript",
    level: "easy",
    totalRounds: ROUNDS,
    displayName: admin.requestedName,
    avatar: AVATAR,
  });
  const roomId = created.room.id;
  admin.playerId = created.player.id;
  admin.grantedName = created.player.display_name;
  admin.joinedAt = now();
  admin.connect(roomId);
  await within(
    admin.watch((p) => p.view !== null),
    LIVE_TIMEOUT_MS,
    "admin connects",
  );

  phase(
    `${joiners.length} players join ${JOIN_OVER_MS ? `over ${JOIN_OVER_MS / 1000} s` : "at once"} (${PLAYERS - 1} seats left)`,
  );
  const refusals: unknown[] = [];
  await Promise.all(
    joiners.map(async (joiner, i) => {
      const delay = (JOIN_OVER_MS * i) / joiners.length;
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      const start = now();
      try {
        const { player } = await joinRoom(joiner.client, {
          code: created.room.code,
          displayName: joiner.requestedName,
          avatar: AVATAR,
        });
        joiner.joinedAt = now();
        latencies.joinRpc.push(joiner.joinedAt - start);
        joiner.playerId = player.id;
        joiner.grantedName = player.display_name;
        joiner.connect(roomId);
      } catch (error) {
        refusals.push(error);
      }
    }),
  );
  const seated = [admin, ...joiners.filter((j) => j.playerId)];
  await within(
    Promise.all(
      seated.map((p) =>
        p.watch(
          (c) =>
            c.view?.players.length === PLAYERS &&
            c.view.online.size === PLAYERS,
        ),
      ),
    ),
    LIVE_TIMEOUT_MS,
    "every client sees every player online",
  );
  for (const joiner of seated.slice(1)) {
    latencies.connect.push(joiner.firstViewAt - joiner.connectedAt);
    // Delivery to clients that were already in the room. Clients that
    // connect later get the joiner from their first load (`connect` above).
    const live = seated.filter(
      (c) =>
        c !== joiner && c.firstViewAt > 0 && c.firstViewAt <= joiner.joinedAt,
    );
    if (live.length === 0) continue;
    const seen = live.map((c) => c.seenAt.get(joiner.playerId) ?? Infinity);
    const online = live.map((c) => c.onlineAt.get(joiner.playerId) ?? Infinity);
    latencies.joinVisibleToAll.push(Math.max(...seen) - joiner.joinedAt);
    latencies.joinOnlineToAll.push(Math.max(...online) - joiner.joinedAt);
  }

  check(
    `room holds exactly ${PLAYERS} players`,
    seated.length === PLAYERS,
    `${seated.length} seated`,
  );
  check(
    "the extra concurrent joiner is refused with room_full",
    refusals.length === 1 &&
      refusals[0] instanceof DbError &&
      refusals[0].code === "room_full",
    refusals.map(describeError).join(", ") || "nobody refused",
  );
  const lateJoiner = new SimPlayer("Late");
  await ensureSignedIn(lateJoiner.client);
  const lateError = await joinRoom(lateJoiner.client, {
    code: created.room.code,
    displayName: lateJoiner.requestedName,
    avatar: AVATAR,
  }).then(
    () => null,
    (error: unknown) => error,
  );
  check(
    'a later join into the full room shows "Room is full"',
    lateError !== null && roomErrorMessage(lateError) === "Room is full",
    lateError ? roomErrorMessage(lateError) : "joined",
  );

  const granted = new Map<string, string[]>();
  for (const p of seated) {
    granted.set(p.requestedName, [
      ...(granted.get(p.requestedName) ?? []),
      p.grantedName,
    ]);
  }
  const nameErrors = checkDuplicateNames(granted);
  check(
    'duplicate names become "Name (2)", "Name (3)"',
    nameErrors.length === 0,
    nameErrors.join("; ") ||
      [...granted.entries()]
        .filter(([, names]) => names.length > 1)
        .map(([, names]) => names.join(", "))
        .join(" | "),
  );
  const lists = seated.map((p) =>
    p.view!.players.map((x) => [x.id, x.display_name]),
  );
  check(
    `all ${PLAYERS} clients show the same player list`,
    distinctSnapshots(lists).length === 1,
    `views: ${distinctSnapshots(lists).join(" / ")}`,
  );

  phase("Presence churn: 5 players drop and come back, one at a time");
  for (const leaver of seated.slice(1, 6)) {
    const others = seated.filter((p) => p !== leaver);
    const id = leaver.playerId;
    latencies.presenceLeave.push(
      Math.max(
        ...(await measure(
          others,
          (p) => p.view?.online.has(id) === false,
          async () => leaver.disconnect(),
          `${leaver.grantedName} goes offline for everyone`,
        )),
      ),
    );
    latencies.presenceJoin.push(
      Math.max(
        ...(await measure(
          others,
          (p) => p.view?.online.has(id) === true,
          async () => leaver.connect(roomId),
          `${leaver.grantedName} comes back online for everyone`,
        )),
      ),
    );
  }

  let host = admin;
  const advance = async (
    event: RoomEvent,
    status: RoomStatus,
    round: number,
  ) => {
    const clients = seated.filter((p) => p.connected);
    const times = await measure(
      clients,
      (p) =>
        p.view?.room.status === status && p.view.room.current_round === round,
      () => advanceRoom(host.client, roomId, event),
      `everyone sees ${status} (round ${round})`,
    );
    latencies.roomStatus.push(Math.max(...times));
  };

  for (let round = 1; round <= ROUNDS; round++) {
    phase(
      `Round ${round}: countdown, live, ${seated.filter((p) => p.connected && p !== host).length} submit at once, Skip`,
      true,
    );
    await advance(round === 1 ? "start" : "next_round", "countdown", round);
    await advance("begin_round", "round_live", round);
    const current = await getCurrentRound(host.client, roomId);
    if (!current) throw new Error(`Round ${round} did not start.`);
    const roundId = current.round.round_id;

    // The host never submits, so the round stays live until their Skip.
    const players = seated.filter((p) => p.connected);
    const submitters = players.filter((p) => p !== host);
    await Promise.all(
      submitters.map(async (p, i) => {
        const start = now();
        try {
          await recordScore(p.client, {
            roundId,
            // A mix of solved, unsolved and hinted results.
            passed: i % 6 !== 5,
            hintUsed: i % 4 === 0,
          });
          latencies.scoreRpc.push(now() - start);
        } catch (error) {
          rpcErrors++;
          p.errors.push(`record_score: ${describeError(error)}`);
        }
      }),
    );

    const key = `round_results:${round}`;
    const times = await measure(
      players,
      (p) => p.leaderboard?.key === key,
      () => advanceRoom(host.client, roomId, "end_round"),
      `everyone loads the round ${round} leaderboard`,
    );
    latencies.leaderboard.push(Math.max(...times));
    await verifyLeaderboards(roomId, players, key);

    if (round === ROUNDS - 1) {
      phase("Admin drops (no leave): waiting for hand-over", true);
      const successorId = [...host.view!.players]
        .filter((p) => p.id !== host.playerId)
        .sort(
          (a, b) =>
            a.joined_at.localeCompare(b.joined_at) || a.id.localeCompare(b.id),
        )[0].id;
      const dropped = host;
      const others = seated.filter((p) => p !== dropped);
      const times = await measure(
        others,
        (p) =>
          p.view?.room.admin_player_id === successorId &&
          p.view.players.find((x) => x.is_admin)?.id === successorId,
        async () => dropped.disconnect(),
        "the earliest-joined connected player becomes admin",
        HAND_OVER_TIMEOUT_MS,
      );
      latencies.handOver.push(Math.max(...times));
      host = seated.find((p) => p.playerId === successorId)!;
      check(
        "admin hand-over to the earliest-joined connected player",
        true,
        `${host.grantedName} took over after ${(Math.max(...times) / 1000).toFixed(1)} s`,
      );
    }
  }

  phase("Final leaderboard", true);
  const finalKey = `final_leaderboard:${ROUNDS}`;
  const connected = seated.filter((p) => p.connected);
  latencies.leaderboard.push(
    Math.max(
      ...(await measure(
        connected,
        (p) => p.leaderboard?.key === finalKey,
        () => advanceRoom(host.client, roomId, "finish"),
        "everyone loads the final leaderboard",
      )),
    ),
  );
  const exAdmin = seated.find((p) => !p.connected)!;
  exAdmin.connect(roomId);
  await within(
    exAdmin.watch((p) => p.leaderboard?.key === finalKey),
    LIVE_TIMEOUT_MS,
    "the returning ex-admin loads the final leaderboard",
  );
  check(
    "the returning ex-admin does not get the role back",
    exAdmin.view?.room.admin_player_id === host.playerId,
  );
  await verifyLeaderboards(roomId, seated, finalKey);

  phase("Closing the room");
  for (const p of seated) p.close();
  await advanceRoom(host.client, roomId, "close");

  const clientErrors = seated.flatMap((p) =>
    p.errors.map((e) => `${p.grantedName}: ${e}`),
  );
  check(
    "no client or RPC errors",
    clientErrors.length === 0 && rpcErrors === 0,
    clientErrors.slice(0, 5).join("; ") || "0 errors",
  );
  report();
  return checks.every((c) => c.ok) ? 0 : 1;
}

// Report ---------------------------------------------------------------------

function ms(value: number): string {
  return Number.isFinite(value) ? `${Math.round(value)} ms` : "–";
}

function report() {
  const rows: [string, Summary, boolean][] = [
    ["join_room() call", summarize(latencies.joinRpc), false],
    ["connect → own first full view", summarize(latencies.connect), false],
    [
      "join → in every connected client's list",
      summarize(latencies.joinVisibleToAll),
      true,
    ],
    [
      "join → online for every connected client",
      summarize(latencies.joinOnlineToAll),
      true,
    ],
    [
      "drop → offline for every client",
      summarize(latencies.presenceLeave),
      true,
    ],
    [
      "return → online for every client",
      summarize(latencies.presenceJoin),
      true,
    ],
    ["room status → every client", summarize(latencies.roomStatus), true],
    ["record_score() call", summarize(latencies.scoreRpc), false],
    [
      "end of round → leaderboard on every client",
      summarize(latencies.leaderboard),
      true,
    ],
    [
      "admin drop → hand-over on every client",
      summarize(latencies.handOver),
      false,
    ],
  ];

  console.log(`\nLatency (${PLAYERS} players, ${ROUNDS} rounds)`);
  console.log(
    `  ${"metric".padEnd(46)} ${"n".padStart(4)} ${"p50".padStart(9)} ${"p95".padStart(9)} ${"max".padStart(9)}`,
  );
  for (const [name, s] of rows) {
    console.log(
      `  ${name.padEnd(46)} ${String(s.count).padStart(4)} ${ms(s.p50).padStart(9)} ${ms(s.p95).padStart(9)} ${ms(s.max).padStart(9)}`,
    );
  }

  const kinds: (MessageKind | "all")[] = [
    "all",
    "postgres_changes",
    "presence",
    "presence_sent",
  ];
  const totalMessages = meter.total();
  console.log(
    "\nRealtime messages received by all clients (and presence sent)",
  );
  for (const kind of kinds) {
    const peak = meter.peak(kind);
    const total =
      kind === "all" ? totalMessages : (meter.totals.get(kind) ?? 0);
    console.log(
      `  ${kind.padEnd(17)} total ${String(total).padStart(6)}   peak ${String(peak.perSecond).padStart(4)}/s during "${peakPhase(kind)}"`,
    );
  }

  console.log("\nRealtime messages by phase (peak 1 s window)");
  phases.forEach((p) => {
    const peak = (kind: MessageKind | "all") => meter.peak(kind, p).perSecond;
    console.log(
      `  ${p.padEnd(62)} all ${String(peak("all")).padStart(4)}/s  changes ${String(peak("postgres_changes")).padStart(4)}/s  presence ${String(peak("presence")).padStart(4)}/s`,
    );
  });

  const maxOver = (names: string[], kind: MessageKind | "all") =>
    Math.max(0, ...names.map((p) => meter.peak(kind, p).perSecond));
  const peakAll = meter.peak().perSecond;
  const peakGame = maxOver(gamePhases, "all");
  const peakJoin = maxOver(phases.slice(0, 3), "all");
  const peakPresence = meter.peak("presence").perSecond;
  const peakTracks = meter.peak("presence_sent").perSecond;
  const fits = (limit: number, used: number) =>
    used === 0 ? "∞" : String(Math.floor(limit / used));
  const {
    connections,
    messagesPerSecond,
    presencePerSecond,
    messagesPerMonth,
  } = FREE_TIER;
  console.log("\nFree plan quotas vs one room of this size");
  console.log(
    `  concurrent connections ${connections}: ${PLAYERS} per room → ${fits(connections, PLAYERS)} rooms at once`,
  );
  console.log(
    `  messages/s ${messagesPerSecond}: in-game peak ${peakGame}/s → ${fits(messagesPerSecond, peakGame)} rooms changing state in the same second; joining peak ${peakJoin}/s; overall peak ${peakAll}/s`,
  );
  console.log(
    `  presence/s ${presencePerSecond}: ${peakTracks} track() calls/s sent, ${peakPresence} presence messages/s received at peak`,
  );
  console.log(
    `  messages/month ${messagesPerMonth.toLocaleString("en")}: ${meter.total()} this run → ${fits(messagesPerMonth, meter.total())} runs like this one`,
  );

  for (const [name, s, gated] of rows) {
    if (gated) {
      check(
        `p95 ${name} < ${P95_LIMIT_MS} ms`,
        s.p95 < P95_LIMIT_MS,
        ms(s.p95),
      );
    }
  }
  const failed = checks.filter((c) => !c.ok);
  console.log(
    failed.length === 0
      ? `\nPASS: ${checks.length} checks`
      : `\nFAIL: ${failed.length} of ${checks.length} checks\n${failed.map((c) => `  ✗ ${c.name} (${c.detail})`).join("\n")}`,
  );
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(
      `\nFAIL: ${error instanceof Error ? error.message : String(error)}`,
    );
    report();
    process.exit(1);
  },
);
