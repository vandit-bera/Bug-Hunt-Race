## E2E tests

Playwright tests for the app. Single-player specs sit in `e2e/` and run
anywhere. Multi-player specs sit in `e2e/multiplayer/`: they open several
browsers against a **local** Supabase and are skipped without one.

```
e2e/
  *.spec.ts            Single-player flows (no database).
  multiplayer/         Room features with 2+ players (local Supabase).
  support/             The multi-player harness: fixtures and helpers.
```

## Run the multi-player tests

Needs Docker. Never point these tests at the live Supabase project.

```bash
pnpm db:start                          # local Supabase with migrations + seed
pnpm exec supabase status              # prints API URL and anon key
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
export NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase status>
pnpm test:e2e:multiplayer              # starts `pnpm dev` with that env
pnpm test:e2e:multiplayer --headed     # watch the browsers
pnpm exec playwright test e2e/multiplayer --repeat-each=3   # flake check
```

If a dev server is already running on port 3000, Playwright reuses it, so
start it with the same two variables (or use `E2E_PORT=3100`).

CI runs them in the `realtime` job (`.github/workflows/ci.yml`): it starts a
fresh local Supabase, builds the app against it and runs
`pnpm test:e2e:multiplayer --retries=0`, so a flaky test fails the job instead
of passing on a retry.

## Write a multi-player test

Import `test` and `expect` from `../support`, not from `@playwright/test`:
that `test` adds the `players` fixture.

```ts
import {
  LIVE,
  RECONNECT,
  createRoom,
  expect,
  joinRoom,
  playerRow,
  reconnect,
  requireSupabase,
  setOffline,
  test,
  waitForPlayers,
} from "../support";

requireSupabase();

test("a dropped player comes back as themselves", async ({ players }) => {
  const [ana, ben] = await players(2);
  const code = await createRoom(ana.page, ana.name, { level: "hard" });
  await joinRoom(ben.page, code, ben.name);
  await waitForPlayers(ana.page, 2);

  await setOffline(ben.page);
  await expect(playerRow(ana.page, "Ben")).toContainText("offline", LIVE);

  await reconnect(ben.page);
  await expect(playerRow(ana.page, "Ben")).toContainText("online", RECONNECT);
});
```

`e2e/multiplayer/harness.spec.ts` is a full example: three players, one drops
and reconnects, then the admin leaves and the role passes on.

### Fixture and helpers

| Helper                                        | What it does                                                                                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `players(n)`                                  | `n` players, each `{ name, page, context }` in its own browser context, so its own anonymous user. Names: Ana, Ben, Cleo, … Max 30 per test. |
| `createRoom(page, name, settings?)`           | Opens the room lab, creates a **new** room and returns its code. `settings`: `language`, `level`, `totalRounds` (`null` = endless).          |
| `createRoomFromScreen(page, name, settings?)` | Creates a room through the real Create Room screen (`/room/new`) and returns its code from the admin lobby URL.                              |
| `joinRoom(page, code, name)`                  | Fills in the join form. Does not wait, so you can also check rejections (locked or full room).                                               |
| `waitForPlayers(page, n)`                     | Waits until that page lists exactly `n` players.                                                                                             |
| `playerList(page)` / `playerRow(page, n)`     | Locators for the player list and one player's row (with `admin`, `online` / `offline` badges).                                               |
| `setOffline(page)`                            | Cuts the player's network: Realtime socket closed, HTTP blocked. Others see them offline at once; the database after 15 s.                   |
| `reconnect(page)`                             | Network back on. The client reconnects on its own backoff: wait with `RECONNECT`.                                                            |
| `expectTimerNear(locator, s, opts?)`          | Asserts a timer shows about `s` seconds (default ± 2 s). Pass a function, e.g. `() => secondsUntil(deadline)`, for a running timer.          |
| `requireSupabase()`                           | Skips the file when no Supabase is configured. Call it at the top of every multi-player spec.                                                |

Timeouts to pass to `expect`: `LIVE` (3 s, a Realtime round trip),
`RECONNECT` (20 s, after `reconnect`), `HAND_OVER` (30 s, admin hand-over
after a drop, which waits 15 s by design).

### Rules that keep these tests stable

- **One room per test.** Always `createRoom`; never reuse a code across tests.
  Tests run in parallel, and the database is not reset between them.
- **Wait for the state, never for time.** No `waitForTimeout`. Assert what the
  player should see with a timeout from above.
- **Wait on every page that matters.** Realtime reaches each browser
  separately: check the players who must see a change, not just one.
- **Never assert exact timer values.** Each browser reads the server's clock
  through its own clock and network delay; use `expectTimerNear`.
- **Cap the players.** Every player is a browser context. Use the fewest that
  show the behaviour; 30 is the room limit.
- **Anonymous sign-ins are rate-limited per IP.** The local limit is raised
  in `supabase/config.toml` (`anonymous_users`) so a full run fits.

The helpers drive the dev room lab (`/dev/rooms`). When the real room screens
land, point the helpers in `support/rooms.ts` at them; the specs stay the same.

## For QA

The same flows can be checked by hand: run the app against the local Supabase,
open `/dev/rooms` in a normal window and in private windows (one per player),
and close a player's window to drop them (DevTools → Network → Offline may
keep an open Realtime socket alive).
`/dev/rooms?language=python&level=mixed&rounds=endless` creates a room with
those settings.
