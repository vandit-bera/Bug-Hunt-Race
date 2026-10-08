# Architecture

The full product plan (game modes, scoring, screens, test plan, failure cases)
is the TB-19 epic. This doc covers how the code is organised and the contracts
every task builds on. Update it when you change one of those contracts.

## Stack

| Part             | Choice                                                   |
| ---------------- | -------------------------------------------------------- |
| App              | Next.js (App Router), React, TypeScript (strict)         |
| Styling          | Tailwind CSS v4                                          |
| Editor           | Monaco                                                   |
| Database + live  | Supabase (Postgres + Realtime)                           |
| Code runner (v1) | In the browser: Web Worker for JS/TS, Pyodide for Python |
| Hosting          | Vercel (preview deploy per PR)                           |
| Tests            | Vitest (unit), Playwright (E2E)                          |
| Tooling          | pnpm, ESLint, Prettier, GitHub Actions                   |

## Folder map

```text
app/                  Routes (App Router). Pages stay thin: they compose components.
components/           Reusable UI components.
lib/runner/           Code-runner plug-in interface, language config, runners.
lib/game/             Pure game logic: scoring, room state machine, room codes.
lib/db/               Supabase client, generated types, typed data access.
lib/rooms/            Live room connection: Realtime, presence, heartbeats.
lib/puzzles/          Puzzle format, loader, checker, generated puzzle index.
puzzles/              Puzzle files: <language>/<level>/<id>/ (see puzzles/README.md).
supabase/             Local Supabase config, SQL migrations, dev seed, pgTAP tests.
scripts/              Repo scripts, e.g. the puzzle checker.
e2e/                  Playwright tests; multi-player harness in e2e/support/.
docs/                 This doc and other design notes.
```

Rules of thumb:

- `lib/game` is framework-free TypeScript (no React, no Supabase), so it is
  easy to unit test. UI and data access call into it, never the other way.
- Anything that talks to Supabase goes through `lib/db`; components do not
  build queries inline.
- Client components only where needed (editor, realtime, interaction).

## Code runner plug-in interface

Defined in `lib/runner/types.ts` (types) and `lib/runner/config.ts`
(language list, limits). Phase 2 adds the implementations.

```ts
type LanguageId = "javascript" | "typescript" | "python";

interface RunRequest {
  language: LanguageId;
  code: string; // player's code (or the reference fix)
  tests: string; // test source in the same language
  timeoutMs?: number; // default DEFAULT_RUN_TIMEOUT_MS = 5000
}

type RunStatus = "passed" | "failed" | "error" | "timeout";

interface RunResult {
  status: RunStatus;
  tests: { name: string; passed: boolean; message?: string }[];
  output: string; // console output, capped at MAX_OUTPUT_CHARS
  error?: string; // for "error" / "timeout"
  durationMs: number;
}

interface CodeRunner {
  readonly language: LanguageId;
  run(request: RunRequest): Promise<RunResult>; // never rejects
  dispose(): void;
}
```

Contract for implementations:

- Code runs off the main thread (Web Worker). The page must never freeze.
- The timeout is enforced from the outside: terminate the worker after
  `timeoutMs` and return `status: "timeout"`. Do not trust code to stop itself.
- No network, DOM or storage access from user code.
- Syntax errors and crashes return `status: "error"`; `run` never throws.
- Adding a language = add a `LanguageId`, a `LANGUAGES` entry, a runner, and
  puzzles. Nothing else should change.

Known trade-off (accepted): runs happen in the player's browser, so a
determined player could fake a pass with dev tools. Fine for an internal game.

### Using a runner

```ts
import { getRunner } from "@/lib/runner/registry"; // browser only

const result = await getRunner("typescript").run({
  language: "typescript",
  code: playerCode,
  tests: puzzle.tests,
});
```

`getRunner(language)` returns a shared runner per language and throws for a
language without one. Every `run` gets a **fresh
worker**, so nothing leaks between runs; `dispose()` stops runs in flight.

CI and other Node code use `runInNode(request)` from `@/lib/runner/node`. It
uses the same compiler, harness and lockdown, in a `worker_threads` thread that
is terminated on timeout, so a puzzle passes in CI exactly when it passes in
the browser. An E2E test runs the shared cases in `lib/runner/test-cases.ts`
in both and requires identical results.

### JS/TS runner (`lib/runner/js/`)

```mermaid
sequenceDiagram
  participant Page
  participant Worker as Web Worker (one per run)
  Page->>Worker: RunRequest + private MessagePort
  Note over Worker: lockdown already applied<br/>compile (sucrase)<br/>run code + tests
  Worker-->>Page: outcome on the port
  Note over Page: after timeoutMs: worker.terminate()<br/>→ status "timeout"
```

- **Compile:** [sucrase](https://github.com/alangpierce/sucrase) strips
  TypeScript types (no type checking, so type errors never block a run) and
  parses JavaScript, so syntax errors read like
  `SyntaxError in your code: Unexpected token (2:13)`. It adds about 48 KB
  gzipped to the worker chunk only; the `typescript` package would be ~3 MB.
  Modern syntax is kept as is. Puzzle code is a plain script: no
  `import`/`export`.
- **Scope:** the code and the tests run as one async function body, code
  first, so tests can call anything the code declares and may use top-level
  `await`. A name declared in both is a `SyntaxError`.
- **Result back:** sent on a `MessagePort` that only the harness holds, so
  player code cannot post a fake result to the page.

### Test harness API (JS/TS)

```js
test("adds two numbers", () => {
  expect(add(2, 3)).toBe(5); // Object.is
  expect(parse("1,2")).toEqual([1, 2]); // deep: arrays, objects, Map, Set, Date, RegExp
  expect(() => parse("")).toThrow(); // optional: toThrow("text") or toThrow(/regex/)
});
test("async works too", async () => {
  expect(await load()).toEqual({ ok: true });
});
```

- Tests run in order, one at a time. A failed `expect` or a throw fails that
  test only, with a message such as `Expected 5, received -1`.
- `status`: `passed` if every test passed; `failed` if any failed; `error` on
  a syntax error, a throw at the top level, a crash, or **no tests**.
- Unhandled promise rejections are ignored: a test fails only through what it
  awaits. An error thrown outside awaited code (e.g. in a `setTimeout`
  callback) ends the run as `error`, e.g. `Error: late`.
- `self` is the global scope in both environments; `close()` and Node-only
  globals (`process`, `require`, `global`, `Buffer`, `setImmediate`) are
  blocked in both, so the browser and Node give the same result.
- `console.log/info/warn/error/debug` are captured into `output`, capped at
  `MAX_OUTPUT_CHARS` (10 000) with a `… output truncated` note. Output is lost
  on timeout (the worker is killed).

### Sandbox limits

- **CPU:** the worker is terminated after `timeoutMs` (default 5 s), whatever
  it is doing. The page stays responsive (E2E proves it).
- **Blocked globals** (`lib/runner/js/lockdown.ts`): `fetch`, `XMLHttpRequest`,
  `WebSocket`, `EventSource`, `WebTransport`, `importScripts`, `indexedDB`,
  `caches`, `navigator`, `postMessage`, nested `Worker`s, `BroadcastChannel`,
  `Notification`, `close`, and the Node-only globals listed above. Each is replaced by a
  non-configurable stub that throws `<name> is blocked in the sandbox`, and
  the original is deleted from the prototype chain.
- **Everything else on the network, including dynamic `import()`:** the
  worker script is served with
  `Content-Security-Policy: default-src 'none'; script-src 'self' 'unsafe-eval'`
  (`next.config.ts`). The browser blocks every connection and every
  cross-origin script. Same-origin scripts stay loadable, because Turbopack
  loads the worker's own chunks that way.
- **DOM, `localStorage`, cookies:** not present in workers.
- **Memory:** there is no browser-side cap (no API for one). Most runaway
  loops hit the 5 s timeout first, but allocating fast enough (e.g.
  `while (true) a.push(new Array(1e6).fill(1))`) can crash the **whole tab**,
  not just the worker. Node threads are capped at 256 MB.
- **Node entry is for trusted code only.** The thread gets the same lockdown,
  but Node cannot apply the worker CSP, so dynamic `import()` (`node:fs`,
  `data:` URLs) still works there. It runs puzzle files from this repo in CI,
  which are reviewed like any other code; never point it at player code.

If Turbopack renames its worker bootstrap (`turbopack-worker-*.js`), the CSP
header stops matching; the E2E test `network APIs are blocked, including
cross-origin import()` fails when that happens.

### Python runner (`lib/runner/python/`)

Python runs in the browser with [Pyodide](https://pyodide.org) (CPython
compiled to WebAssembly) in a Web Worker, behind the same `CodeRunner`
interface and the same `SandboxRunner` timeout logic as JS/TS.

- **Self-hosted, pinned.** `pyodide` is an exact-version npm dependency
  (`314.0.7`); `scripts/copy-pyodide.mjs` (run by `postinstall`) copies the
  runtime (about 13 MB) to `public/pyodide/<version>/` (git-ignored). Why not
  the CDN: no third-party host to trust or to be down during a game, the same
  version in the browser and in Node, and same-origin files let the worker's
  CSP stay at `'self'`. The versioned path is served `immutable`, so the
  browser downloads it once.
- **Warm spare** (`browser-pool.ts`). Booting Pyodide takes seconds, so the
  pool keeps one booted worker in reserve. A run takes the spare and a new
  one starts booting at once, which keeps "a fresh worker per run" and means
  the next run after a timeout (which killed its worker) is instant. A spare
  costs one idle Pyodide (a few tens of MB). Boot time is not part of the 5 s
  run clock: `OpenSession` may be async and the timer starts after it opens.
- **Preload.** `preloadRunner("python")` starts the download and boot; call it
  from the lobby or setup screen. `getPreloadState(lang)` /
  `subscribePreload(lang, cb)` (or the `usePreloadState(lang)` hook) give
  `{ status: "idle" | "loading" | "ready" | "error", progress: 0..1, error? }`.
  Progress is real download progress (bytes against `manifest.json`), then
  Pyodide init. JS and TS are always `ready`.
- **Node entry.** `runInNode({ language: "python", ... })` boots Pyodide from
  `node_modules` in a `worker_threads` thread, with the same harness and
  lockdown, and terminates it on timeout. It boots a fresh interpreter per
  call (about 1 s), which is fine for the puzzle checker. Trusted code only,
  like the JS entry.

### Test harness API (Python)

Puzzle tests are plain functions using `assert`:

```python
def test_adds_two_numbers():
    assert add(2, 3) == 5
```

- The code and the tests run in one namespace, code first. Every function
  named `test_*` defined by the tests runs in definition order; a failed
  assert or any exception fails that test only.
- A bare `assert a == b` (also `!=`, `<`, `in`, `is`, ...) is rewritten to
  explain itself: `assert add(2, 3) == 5 (left: -1, right: 5)`. Other bare
  asserts report their source (`assert is_valid(x)`). A custom message
  (`assert x, "why"`) is used as written. Other exceptions read
  `IndexError: list index out of range`.
- `status`: `passed`, `failed`, or `error` for a syntax error
  (`SyntaxError in your code: expected ':' (line 1)`), an exception at the top
  level, or **no tests**. `async def` tests are not supported (reported as a
  failed test).
- `print` and `sys.stderr` output is captured into `output`, capped at
  `MAX_OUTPUT_CHARS` like JS. Output is lost on timeout.

### Python sandbox limits

- **CPU:** the worker is terminated after `timeoutMs`, whatever Python is
  doing (`while True: pass`). Same for Node.
- **Network:** CPython in WebAssembly has no sockets, so `socket` and
  `urllib` fail with `OSError`. Everything that goes through the browser
  (`js.fetch`, `XMLHttpRequest`, `WebSocket`, `pyodide.http.pyfetch` and
  `open_url`) hits the same lockdown stubs as the JS runner and
  throws `<name> is blocked in the sandbox`. The lockdown is applied after
  Pyodide has loaded, so the runtime itself still works.
- **CSP:** the worker's CSP is `default-src 'none'; script-src 'self'
'unsafe-eval'; connect-src 'self'`. Cross-origin requests, including
  `import()`, are blocked by the browser. **Known limit:** same-origin
  requests are not blocked by the CSP (Pyodide must download its files from
  there); only the lockdown stubs stop them. A determined player could use a
  Pyodide internal that keeps its own reference to `fetch`; they could reach
  this site only, never another host. Acceptable for an internal game.
- **Packages:** only the standard library; `micropip` is not installed and
  `loadPackage` cannot download anything.
- **Memory:** as for JS, there is no browser-side cap; a memory bomb can
  crash the tab. Node threads are capped at 512 MB.

## Puzzles

Authoring rules and the file format are in `puzzles/README.md`. Each puzzle
is a folder `puzzles/<language>/<level>/<id>/` with `puzzle.json`,
`buggy.<ext>`, `fix.<ext>` and `tests.<ext>`.

```mermaid
flowchart LR
  files["puzzles/*/*/*/"] --> load["lib/puzzles/load.ts<br/>validate format"]
  load --> check["pnpm puzzles:check<br/>runInNode: buggy fails, fix passes"]
  load --> build["pnpm puzzles:build"]
  build --> index["lib/puzzles/generated/index.ts<br/>PUZZLES: PublicPuzzle[] (no fix)"]
  index --> app["App"]
```

- **Format:** `PuzzleMeta` and `validatePuzzleMeta` in `lib/puzzles/schema.ts`
  are the source of truth. `puzzles/puzzle.schema.json` mirrors them for
  editors; a unit test keeps the two in sync. Per level:

  | Level  | Time limit | Base points | Lines of code (buggy and fix) |
  | ------ | ---------- | ----------- | ----------------------------- |
  | easy   | 180 s      | 100         | 5–15                          |
  | medium | 300 s      | 200         | 15–40                         |
  | hard   | 480 s      | 300         | 40–80                         |

- **Checker (`pnpm puzzles:check`, runs in CI):** validates every folder,
  then runs each puzzle twice with `runInNode`, the same compiler, harness
  and lockdown as the browser. The buggy code must end `failed` (a syntax
  error, crash or timeout is not a fair bug); the fix must end `passed`. It
  also fails when the generated index is out of date. `--dir <folder>` checks
  another folder (the tests use `lib/puzzles/fixtures/`).
- **Index (`pnpm puzzles:build`):** writes `lib/puzzles/generated/index.ts`,
  committed like `lib/db/types.ts`. It holds `PublicPuzzle` objects: the
  metadata, buggy code and tests. **The reference fix is never in it**, so it
  can never reach the client bundle; a unit test checks this. The loader
  (`load.ts`) and checker use `node:fs` and are for scripts and tests only.
- `puzzles/` is excluded from `tsc` and ESLint: puzzle files are plain
  scripts that use the harness globals, and buggy and fix declare the same
  names.

## Solo Practice and scoring

Screens: `/` (home), `/solo` (pick language and level), `/solo/play` (the
game and the result screen). The game link carries its settings:
`/solo/play?language=python&level=mixed&round=0`; "Play again" adds 1 to
`round`, which is how Mixed steps Easy, Medium, Hard (levels with no puzzles
are skipped). Everything is client side; nothing is sent to Supabase.

- **Scoring** (`lib/game/scoring.ts`, pure, reused by Race Rooms):
  `score = base + speedBonus - hintPenalty`, never below 0.
  - `base` is the level's base points (100 / 200 / 300).
  - `speedBonus = round(base * 0.5 * timeLeft / timeLimit)`: up to +50% for an
    instant solve, 0 when solved at the last second.
  - `hintPenalty = round(base * 0.25)` per hint (the solo game allows one).
  - Unsolved, time-up and gave-up rounds score 0, and so does a solve that
    lands after the time limit.
- **Personal best** (`lib/game/solo-storage.ts`): kept in `localStorage` per
  language + selected level (Mixed has its own best). More points win; equal
  points are decided by the faster time.
- **Puzzle picking** (`lib/game/solo-pick.ts`): random from the language +
  level pool, without repeats until every puzzle there has been played; the
  played ids are in `localStorage` too.
- **Setup screen:** `/solo` counts the pools on the server and passes the
  sizes down, so the puzzle pack only ships with the game.
- **Editor:** Monaco, bundled with the app (no CDN) and loaded on demand. Only
  the editor worker runs, so there are no type-checker squiggles that would
  point at the bug.
- **Give up / time up:** the result screen shows 0 points and the last test
  run. The reference fix is never sent to the browser (see Puzzles), so there
  is no "show the answer".

## Sound and fun FX

- `lib/sound/`: `playSound(name)` plays a bundled file from `public/sounds/`
  (`tick`, `go`, `pass`, `fail`, `solved`, `timeup`; under 200 KB in total,
  generated by `scripts/generate-sounds.mjs`, CC0). It does nothing until the
  player's first click or key press (browser autoplay rules) or while muted.
  The mute choice lives in localStorage (`bhr:muted`); `SoundToggle` is the
  header button.
- `components/fx/`: `Countdown`, `Confetti`, `ScorePopup`, `AnimatedNumber`.
  Confetti and the popup render nothing under `prefers-reduced-motion`, and the
  count-up shows the final number at once. Solo uses all of them; Race Rooms
  can reuse them.

## Room state machine

Copied from TB-19 §12. The room's current state lives in the database and is
broadcast over Supabase Realtime. Only the admin moves the room between states;
the database itself closes abandoned rooms.

```mermaid
stateDiagram-v2
  [*] --> Lobby: room created
  Lobby --> Countdown: admin Start
  Countdown --> RoundLive
  RoundLive --> Paused: admin Pause
  Paused --> RoundLive: admin Resume
  RoundLive --> RoundResults: solved or time up or Skip
  RoundResults --> Countdown: next round
  RoundResults --> FinalLeaderboard: last round
  RoundLive --> FinalLeaderboard: admin Stop
  Paused --> FinalLeaderboard: admin Stop
  FinalLeaderboard --> Lobby: Play again
  FinalLeaderboard --> Closed: admin closes
  Lobby --> Closed: empty for 10 min
  Closed --> [*]
```

The state ids in code (`RoomState` in `lib/game/types.ts`) are `lobby`,
`countdown`, `round_live`, `paused`, `round_results`, `final_leaderboard`,
`closed`.

The machine is `lib/game/room-machine.ts` (pure, `transition(room, event,
actor)`). The database enforces the same table, `private.room_transitions`,
in `advance_room()`; a unit test fails if the two drift apart. Any (state,
event) pair not listed is rejected with `invalid_transition`, and only the
room admin may call `advance_room()` (`not_room_admin` otherwise).

| Event         | From → to                               | By     | Notes                                         |
| ------------- | --------------------------------------- | ------ | --------------------------------------------- |
| `start`       | lobby → countdown                       | admin  | round 1                                       |
| `begin_round` | countdown → round_live                  | admin  | countdown over (3.4 may move it to timer)     |
| `pause`       | round_live → paused                     | admin  |                                               |
| `resume`      | paused → round_live                     | admin  |                                               |
| `end_round`   | round_live → round_results              | admin  | solved, time up or Skip                       |
| `next_round`  | round_results → countdown               | admin  | only if a round is left; round + 1            |
| `finish`      | round_results → final_leaderboard       | admin  | only after the last round (or "until I stop") |
| `stop`        | round_live / paused → final_leaderboard | admin  |                                               |
| `play_again`  | final_leaderboard → lobby               | admin  | round back to 0                               |
| `close`       | final_leaderboard → closed              | admin  |                                               |
| `abandon`     | any open state → closed                 | system | nobody seen for 10 min (see below)            |

`abandon` widens the diagram's "Lobby → Closed: empty for 10 min" to every
open state, so a room everyone walked away from mid-game also frees its code.

## Rooms and Realtime

`lib/db` has the room actions; `lib/rooms` keeps a live view of one room.

```ts
const { room, player } = await joinRoom(db, { code, displayName, avatar });
const connection = connectToRoom(db, {
  roomId: room.id,
  playerId: player.id,
  onChange: ({ room, players, online }) => render(room, players, online),
  onClosed: () => showRoomNotFound(),
});
await advanceRoom(db, room.id, "start"); // admin only
await setRoomLocked(db, room.id, true); // admin only
connection.disconnect(); // stop listening, keep the seat
await connection.leave(); // leave for good
```

React components can use `useRoomConnection(db, roomId, playerId)`, and
`roomErrorMessage(error)` gives "Room not found", "Room is full", … for a
`DbError`. `/dev/rooms` is a bare test page for all of this until the race
screens (3.2–3.5) exist.

Room screens so far:

- `/room/new` (Create Room): settings, then the admin's name and avatar.
  Creates the room and goes to `/room/<code>`.
- `/room/<code>`: finds the caller's seat with `findMyMembership` (so a
  reload keeps it), then connects. The admin sees the ready panel: code,
  invite link `<site>/join/<code>` with Copy and Share, QR (made in the
  browser) with a full-screen view, the Lock switch and "n / 30".
- All room screens share one Supabase client per tab
  (`getBrowserDbClient()`).

- **One channel per room**, `room:<room id>`:
  - `postgres_changes` UPDATE on `rooms` (`id=eq.<id>`): the new row is
    applied as is.
  - `postgres_changes` on `players` (`room_id=eq.<id>`): the player list is
    reloaded (simpler than merging partial rows, and still one query). One
    reload runs at a time; changes that arrive meanwhile cause exactly one
    more, so a burst of joins costs two queries per client, not one per
    change.
  - **Presence**, keyed by player id: who has the page open right now. Fast
    (~1 s) but UI-only; anyone who knows the room id could join the channel,
    so nothing authoritative is decided from it.
  - On every (re)subscribe the room and players are reloaded, so changes
    missed while offline are picked up.
- **Security:** Realtime applies RLS to `postgres_changes`, so a client only
  receives rows of rooms it is in. Rows are never deleted through the API
  (leaving sets `left_at`), so no unfiltered DELETE events exist.
- **Heartbeats:** `connectToRoom` calls `room_heartbeat()` every 5 s. The
  database stores the time in `private.player_presence` (not in `players`,
  so heartbeats do not spam Realtime). A player not seen for **15 s** gets
  `connected = false`; that change is what other clients see.
- **Admin hand-over:** whenever a heartbeat or join finds the admin
  disconnected (or gone), the **earliest-joined connected player** becomes
  admin. If the admin leaves, it happens at once. With nobody connected a
  dropped admin keeps the role; one who left loses it, and the next player to
  connect takes it. A returning ex-admin does not get the role back.
- **Reconnect:** identity is the anonymous Supabase session stored in the
  browser, so `join_room()` from the same browser returns the same player,
  name and score, even when the room is locked or full ("kick-free").
- **Leaving:** `leave_room()` sets `left_at`: the seat and the name are free
  again, scores stay. Coming back later returns the same player (same scores)
  but obeys the lock, the cap and the name rules like a new player.
- **Auto-close:** a room in which nobody has been seen for **10 minutes**
  (an empty room counts from its creation) is closed by the next
  `find_open_room()`, `create_room()`, `join_room()` or heartbeat. There is no
  cron job: until someone touches it, an abandoned room just sits there, and
  every lookup treats it as closed. Closed and unknown codes both give "Room
  not found".
- **Limits:** 30 players per room (`room_full` for the 31st). Browsers slow
  timers in background tabs; after several minutes hidden, heartbeats can
  stall and the player counts as disconnected until the tab is visible again.

### Capacity

`pnpm load:room` (`scripts/load/room-30.ts`, TB-52) fills one room with 30
headless players on the **local** Supabase: the real `lib/db` and `lib/rooms`
code, one Supabase client and Realtime socket per player. It runs 3 rounds in
which every player calls `record_score()` at the same moment, drops the admin
before the last round, and checks that every client ends with the same player
list and leaderboard. It counts every Realtime frame the clients receive. It
refuses any Supabase that is not on this machine, and it inserts `rounds` rows
with the local service-role key because no API creates rounds yet.

Results on a MacBook with Docker Desktop (2026-10-08), 30 players, all joining
in the same second (`--join-over 30` in brackets, where it differs):

| Change reaching every client                      | p50             | p95             |
| ------------------------------------------------- | --------------- | --------------- |
| `join_room()` call                                | 193 ms (30 ms)  | 311 ms (44 ms)  |
| Join → in every connected client's player list    | 181 ms (226 ms) | 270 ms (478 ms) |
| Join → online (presence) for every client         | 30 ms (9 ms)    | 42 ms (13 ms)   |
| Drop / return → presence for every client         | 4 / 8 ms        | 4 / 9 ms        |
| Room status (countdown, live, …) → every client   | 498 ms          | 523 ms          |
| `record_score()` call, 30 at once                 | 17 ms           | 20 ms           |
| End of round → leaderboard loaded on every client | 533 ms          | 540 ms          |
| Admin drops → hand-over seen by every client      | 11.8 s (13.5 s) | (one event)     |

- Everything stays far under the 2 s goal. Database changes take ~0.5 s through
  Realtime's Postgres Changes pipeline; presence never touches Postgres and
  takes milliseconds. The hand-over takes 15 s by design (heartbeats). Over the
  internet, add one round trip to each number.
- Correct at 30: identical player lists and leaderboards on all clients; the
  31st concurrent joiner and a later one get `room_full` ("Room is full");
  repeated names become "Riya", "Riya (2)", "Riya (3)"; ranks follow points,
  then the server-measured solve time, and exact ties share the place (every
  run has some); the earliest-joined connected player takes over as admin and
  the old admin does not get the role back.
- **Engine bug found and fixed:** the player-list reload used to drop every
  answer that a newer change had overtaken. With 30 joins in one second each
  client kept starting new queries and dropping the answers, so the list froze
  until the burst ended: p95 **7.6 s** from join to every list. Now one reload
  runs at a time with at most one more queued (p95 270 ms), instead of one
  query per change (29 per client, ~870 for the room).

Realtime messages received by all 30 clients (each database change or
presence update reaches every subscriber, and Supabase bills each delivery):

| Moment                                 | Busiest second                  |
| -------------------------------------- | ------------------------------- |
| 30 players join in the same second     | ~1,400 messages                 |
| 30 players join over 30 s              | ~60 messages                    |
| One room status change                 | 30 (2 changes in 1 s: 60)       |
| Admin hand-over (4 row changes)        | ~116                            |
| One player drops or comes back         | ~30                             |
| `record_score()` × 30                  | 0 (`scores` is not on Realtime) |
| Whole run (3 rounds, churn, hand-over) | ~2,300 messages in total        |

Against the Supabase **Free** plan Realtime quotas
([limits](https://supabase.com/docs/guides/realtime/limits),
[message billing](https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages)):

| Quota                        | Free plan | One 30-player room                                                               |
| ---------------------------- | --------- | -------------------------------------------------------------------------------- |
| Concurrent connections       | 200       | 30 (one socket per player, one channel each)                                     |
| Messages per second          | 100       | 30–60 per state change; ~116 at a hand-over; ~1,400 if all 30 join in one second |
| Presence messages per second | 20        | 1 `track()` per player per (re)connect; 35/s if all join at once                 |
| Channel joins per second     | 100       | 30 if all join at once                                                           |
| Messages per month           | 2 million | ~2,300 per game → ~850 games a month                                             |

**How many rooms of 30 at once:** connections cap it at **6** (180 of 200),
so plan for **5** to leave room for reconnects and second tabs. The message
rate is the tighter limit in practice: every room event costs about 30
messages, so about three rooms changing state in the same second reach 100/s.
Supabase disconnects clients of a project over its message rate
(`tenant_events`; supabase-js reconnects when it drops), so on the Free plan:

- **One room of 30** (the team game) fits, as long as players do not all join
  in the same second. In practice joins are spread out (~60/s for 30 joins
  over 30 s); a burst only costs a short reconnect.
- **Two or three rooms** at once fit most of the time; their state changes
  rarely land in the same second.
- **Live leaderboard (race-round tasks):** do not push one message per solve
  to all 30 players (30 solves × 30 players = 900 messages within seconds).
  Load the leaderboard when the round ends (as today), or poll it every few
  seconds during the round (database reads, not Realtime messages). If a
  push is needed, send one throttled Broadcast at most once a second; it also
  skips the per-subscriber RLS check that
  [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
  does for every event.

Re-run `pnpm load:room` after changing `lib/rooms`, the room functions or the
Realtime setup. It is not part of CI (too slow); run the "Load test" workflow
by hand from the Actions tab.

## Data model

Defined by the SQL migrations in `supabase/migrations/` (run in filename
order). TypeScript types in `lib/db/types.ts` are generated from them with
`pnpm db:types`; CI fails if they drift.

```mermaid
erDiagram
  rooms ||--o{ players : "has"
  rooms |o--o| players : "admin_player_id"
  rooms ||--o{ rounds : "plays"
  puzzles ||--o{ rounds : "used in"
  rounds ||--o{ scores : "has"
  players ||--o{ scores : "earns"
  auth_users ||--o{ players : "anonymous sign-in"

  rooms {
    uuid id PK
    text code "6 chars, no 0/O/1/I, unique while not closed"
    uuid admin_player_id FK
    room_status status "lobby ... closed"
    language_id language
    room_level level "easy/medium/hard/mixed"
    int total_rounds "null = until stopped"
    bool locked
    int current_round
    timestamptz created_at
    timestamptz updated_at
    timestamptz closed_at
  }
  players {
    uuid id PK
    uuid room_id FK
    uuid user_id FK "auth.users, one per room"
    text display_name "unique per room, case-insensitive"
    text avatar "emoji"
    bool is_admin "mirrors rooms.admin_player_id"
    bool connected "set by heartbeats"
    timestamptz joined_at
    timestamptz left_at "set by leave_room"
  }
  puzzles {
    text id PK "slug from puzzles/"
    language_id language
    puzzle_level level
    text title
    text buggy_code
    text tests
    text hint
    int time_limit_seconds
    int base_points "100/200/300 by level"
  }
  rounds {
    uuid id PK
    uuid room_id FK
    text puzzle_id FK
    int round_number "unique per room"
    timestamptz started_at
    timestamptz ended_at
    timestamptz paused_at "set while paused"
    int paused_ms "earlier pauses"
  }
  scores {
    uuid id PK
    uuid round_id FK
    uuid player_id FK "one row per player per round"
    bool passed
    int solve_time_ms "server-measured, excludes pauses"
    bool hint_used
    int points
    timestamptz submitted_at "server time, breaks ties"
  }
```

Enums: `room_status` (same ids as `RoomState`), `language_id` (same as
`LanguageId`), `puzzle_level`, `room_level`. A type test keeps them in sync.

Notes:

- **No reference fix in the database.** It stays in `puzzles/` for the CI
  checker, so no API call can ever return it.
- **Room codes** are generated in Postgres (`private.generate_room_code`) and
  unique only among rooms that are not closed (partial unique index), so codes
  can be reused. `lib/game/room-code.ts` validates what players type.
- **Indexes:** open-room code lookup (`rooms_open_code_key`), players by room
  and name, scores by round + player and by player (leaderboard), rounds by
  room + number.

### Identity and row-level security

Players have no accounts. Each browser signs in with **Supabase anonymous
auth**, and `auth.uid()` identifies the player in every policy. A player row
links that user to one room, so rejoining from the same browser keeps the
name and score.

| Table / view       | Read                       | Write                                                      |
| ------------------ | -------------------------- | ---------------------------------------------------------- |
| `rooms`            | Players in that room       | Admin only: settings (`language`, `level`, `total_rounds`) |
| `players`          | Players in that room       | Nobody: only the functions below                           |
| `puzzles`          | Anyone                     | Nobody (migrations / seed only)                            |
| `rounds`           | Players in that room       | Nobody yet (Phase 3 adds round functions)                  |
| `scores`           | Players in that room       | Nobody: only `record_score()`                              |
| `room_leaderboard` | Players in that room (RLS) | n/a (view, `security_invoker`)                             |

Everything else goes through `security definer` functions that check
`auth.uid()` themselves:

| Function                                                           | Who                  | Does                                                                                                 |
| ------------------------------------------------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------- |
| `find_open_room(code)`                                             | Anyone               | Status, lock, full flag and settings of an open room. Nothing else.                                  |
| `create_room(language, level, display_name, avatar, total_rounds)` | Signed in            | New room in `lobby` with a fresh code; caller becomes admin.                                         |
| `join_room(code, display_name, avatar)`                            | Signed in            | Joins an open, unlocked, non-full room (max 30). "Riya" → "Riya (2)". Rejoin returns the old player. |
| `room_heartbeat(room_id)`                                          | Players in the room  | "Still here". Marks silent players disconnected, hands over admin. Returns the room status.          |
| `leave_room(room_id)`                                              | Players in the room  | Frees the seat and name, keeps scores; passes the admin role on.                                     |
| `advance_room(room_id, event)`                                     | Room admin           | Moves the room through the state machine.                                                            |
| `set_room_locked(room_id, locked)`                                 | Room admin           | Locks or unlocks the room to new players.                                                            |
| `record_score(round_id, passed, hint_used)`                        | Players in the round | Server measures solve time and computes points. A pass is final.                                     |

Errors are raised with a stable code as the message (`room_not_found`,
`room_locked`, `room_full`, `not_room_admin`, `invalid_transition`, ...); `lib/db` turns them into a
typed `DbError`.

Scoring (TB-19 §3) lives in `private.calculate_points`: base points (Easy 100 /
Medium 200 / Hard 300) + up to 50% speed bonus for time left − 25% if a hint
was used; unsolved = 0. A 5 s grace after the deadline absorbs network lag.
The leaderboard ranks by total points, then total solve time; exact ties share
the place. Task 13 may tune the numbers in a new migration.

### Abuse limits

Players are anonymous, so limits protect the database from a script, not
from a determined attacker with many IPs. Migration
`20261008000005_abuse_limits.sql` (TB-41):

| Limit                      | Value                          | Enforced by                                                             |
| -------------------------- | ------------------------------ | ----------------------------------------------------------------------- |
| Rooms created per user     | 10 per rolling hour            | `before insert` trigger on `rooms` → `rate_limited`                     |
| Display name               | 1–24 chars, no control chars   | `private.clean_display_name` → `invalid_display_name`                   |
| No HTML in names / avatars | `<` and `>` rejected           | `private.clean_display_name`, `private.check_avatar`                    |
| Avatar                     | 1–16 chars                     | `private.check_avatar` → `invalid_avatar`                               |
| Players per room           | 30                             | `join_room` → `room_full`                                               |
| New anonymous users per IP | 30 per hour (Supabase default) | Supabase Auth → Rate Limits (dashboard; `supabase/config.toml` locally) |

- The room limit counts creates in `private.room_creations` (pruned per user
  as they go). It runs as a trigger, so it holds for every function that
  creates a room. Inserts without a user (seed, migrations) are not limited.
- React escapes text, so `<` / `>` in a name could not run as HTML anyway.
  Rejecting them keeps names safe in any other sink (titles, exports).
- **Watch the IP limit:** a whole office behind one NAT IP shares the 30
  anonymous sign-ins per hour. Raise it in the Supabase dashboard before a
  large game (Vandit's call; it is a live-project setting).
- Not limited: joins (bounded by the room cap), score submits (one row per
  player per round), Realtime messages (Supabase's per-project quotas).

### Data access (`lib/db`)

Components never build queries inline. They call typed functions that take a
Supabase client:

```ts
const db = createBrowserDbClient();
await ensureSignedIn(db); // anonymous sign-in, reuses the stored session
const { room, player } = await createRoom(db, {
  language,
  level,
  totalRounds,
  displayName,
  avatar,
});
const preview = await findRoomByCode(db, "bug-7kx"); // null if unknown/closed
await joinRoom(db, { code, displayName, avatar });
await listPlayers(db, room.id);
await recordScore(db, { roundId, passed: true, hintUsed: false });
await getLeaderboard(db, room.id);
```

### Working on the database

```bash
pnpm db:start   # local Supabase in Docker (API on :54321, Postgres on :54322)
pnpm db:reset   # recreate from migrations + supabase/seed.sql
pnpm db:test    # pgTAP tests in supabase/tests (RLS, codes, names, scoring, rooms)
pnpm db:types   # regenerate lib/db/types.ts after changing a migration
```

Add a change as a **new** migration file; never edit one that has been
applied to production. Supabase grants new tables to the API roles by
default, so every new table needs `enable row level security`, explicit
grants, and a pgTAP test.

## Security headers

Set for every response except built JS in `next.config.ts`, from
`lib/security/headers.ts` (unit tested; an E2E test checks them on real
pages):

- **Content-Security-Policy:** `default-src 'self'`; scripts and workers from
  this site only; `connect-src` is this site plus the Supabase origin from
  `NEXT_PUBLIC_SUPABASE_URL` (`https://…` and `wss://…` for Realtime), read at
  build time; `img-src` also allows `data:` / `blob:`;
  `object-src 'none'`; `base-uri` and `form-action` `'self'`;
  `frame-ancestors 'none'`.
  - **No nonces, so `'unsafe-inline'` for scripts and styles.** Nonces force
    every page to render per request (no static pages, no CDN cache). The
    inline scripts are the theme script in `<head>` and Next's RSC payload;
    Monaco injects styles. Acceptable here: there is no user HTML anywhere,
    React escapes text, and names reject `<` / `>`.
  - `next dev` adds `'unsafe-eval'` (React's dev error overlay needs it).
  - The runner workers keep their own, stricter CSP (see Sandbox limits); built
    JS is excluded from the page policy so the two never stack.
  - Adding a third-party origin (analytics, fonts, a CDN) means adding it here.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, `X-Frame-Options: DENY` (old browsers).
- `Permissions-Policy` turns off camera, microphone, geolocation, payment,
  USB and topics. Fullscreen (QR code) and clipboard (invite link) stay on.

## Performance budget

`pnpm bundle:check` (CI runs it after `pnpm build`) sums the gzipped size of
every script the prerendered `/` and `/solo` pages load and fails over the
budget in `scripts/bundle-budget.ts`:

| Page               | Budget (gzip) | At TB-41 |
| ------------------ | ------------- | -------- |
| `/` Home           | 185 KB        | 175.9 KB |
| `/solo` Solo setup | 190 KB        | 179.5 KB |

About 170 KB of that is React and Next.js, shared by every page. Keep heavy
code off these pages:

- Monaco loads with `next/dynamic` on the game screen only; Pyodide downloads
  only when Python is picked (preload) or played. An E2E test checks that Home
  and Solo setup load neither.
- Screens that only need puzzle counts get them from the server
  (`countPools` in `lib/puzzles/pools.ts`), so the puzzle pack (~29 KB gzip)
  ships only with the game.

If a change has to raise a budget, raise it in the same PR and say why.

## Environment

Only public values (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
are used by the app; see `.env.example`. Supabase now calls the anon key the
**publishable key** (`sb_publishable_…`); the variable name stays the same.
Data is protected by Supabase row-level security, not by hiding the key.
Service-role keys never go in this repo or in client code.

The Supabase project must have **anonymous sign-ins** enabled
(Authentication → Sign In / Providers). Locally, `supabase/config.toml`
enables them.

## Design system

- Tokens are CSS variables in `app/globals.css` (light by default, dark via
  `data-theme="dark"`), exposed to Tailwind as semantic colors (`bg-surface`,
  `text-muted`, `text-primary`, `border-level-hard`, …). Use these, never raw hex.
- Theme choice (Light / Dark / System, default System) lives in localStorage
  under `bhr-theme`. An inline script in `<head>` sets `data-theme` before
  first paint, so there is no flash. Logic: `lib/theme/`.
- Base components are in `components/ui/`. Fonts via `next/font`: Silkscreen
  (display), Geist (UI), Geist Mono (code).
- Contrast is enforced by `lib/theme/tokens.test.ts` (WCAG AA). Animations are
  disabled under `prefers-reduced-motion`.
- Review everything at `/styleguide`.
