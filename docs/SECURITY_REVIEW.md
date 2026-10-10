# Pre-launch security review (TB-63)

One end-to-end review of the whole app as an attacker would see it, done
before launch on 2026-10-09.

- **Code:** `main` at `8538363` (TB-62), all migrations up to
  `20261009000007_end_of_game.sql`.
- **Where:** a local production build (`pnpm build && pnpm start`) and a
  local Supabase started from the repo's migrations and `supabase/puzzles.sql`.
  Nothing was run against the live site or the live Supabase project.
- **Attackers:** someone not signed in (anon key only); a signed-in player in
  another room ("outsider"); a non-admin player in the same room; a player with
  dev tools; someone spamming.
- **Accepted before this review, not re-opened:** runs happen in the player's
  browser, so a player can fake a pass with dev tools
  ([Code runner](ARCHITECTURE.md#code-runner-plug-in-interface)).

## Summary

No High findings. One Medium finding needs a decision (the reference fixes are
public on GitHub), and five Low findings are fixed: two here, three that
needed a migration in TB-66.

| ID  | Finding                                                             | Risk   | Status                         |
| --- | ------------------------------------------------------------------- | ------ | ------------------------------ |
| M1  | Reference fixes are readable in the public GitHub repo              | Medium | Open: TB-65 (decision)         |
| L1  | Admin can change language, level and rounds in the middle of a game | Low    | **Fixed** (TB-66)              |
| L2  | `room_heartbeat` locks the room before checking membership          | Low    | **Fixed** (TB-66)              |
| L3  | Realtime presence can be spoofed by anyone who knows the room id    | Low    | **Fixed** (TB-66)              |
| L4  | `/dev` test pages on the live site (one-click "Submit solve")       | Low    | **Fixed** (TB-63)              |
| L5  | `X-Powered-By: Next.js` header                                      | Low    | **Fixed** (TB-63)              |
| A1  | Hint penalty is honour-based (client reports `hint_used`)           | Low    | Accepted (same as a fake pass) |
| I1  | Roommates can read each other's anonymous `user_id`                 | Info   | Accepted                       |
| I2  | `find_open_room` (callable signed out) also closes abandoned rooms  | Info   | Accepted                       |
| I3  | A runner memory bomb can crash the player's own tab                 | Info   | Accepted (documented)          |

Risk: **High** = someone can read or change data that is not theirs, or the
app can be taken down cheaply. **Medium** = a game-fairness hole that needs no
skill, or a real weakness with limited reach. **Low** = needs an unusual
precondition, or the impact stays in the attacker's own room or browser.
**Info** = worth knowing, no action.

## 1. Row-level security and database functions

**Method**

- Catalog inventory of `public` and `private`: RLS flag of every table, every
  table and column grant to `anon` / `authenticated`, every function with its
  `security definer` flag, `search_path` and who may execute it, the policies,
  the `private` schema's usage grants and the Realtime publication. This is
  now a pgTAP test, `supabase/tests/09_security_inventory.test.sql`, so a new
  table, grant or function that widens the surface fails CI.
- 38 attacker probes through the real REST API (supabase-js, three anonymous
  users: admin, non-admin, outsider, plus the bare anon key): read every table
  and the leaderboard view, call every RPC, write `rooms` / `players` /
  `scores` directly, act as admin, reveal or score a round of another room.
- The existing pgTAP suites (`01`–`08`, 259 tests) cover the same rules per
  function; all pass.

**Result: pass.**

- RLS is on for every table. Tables are read-only for API roles; the only
  direct write is the admin's room settings (`language`, `level`,
  `total_rounds`), in the lobby only since TB-66 (L1). `status`, `current_round`, `locked`, `is_admin`,
  `connected`, names and scores can only change through the functions.
- Signed out (anon): reads `puzzles` and calls `find_open_room` only, which
  returns a preview (code, status, lock, full flag, language, level, player
  count) and no room id. Everything else: `permission denied`.
- Outsider: sees no rows of the room in any table or the leaderboard, and
  every room function answers `room_not_found` / `round_not_found` (same as
  for a room that does not exist, so ids do not leak).
- Non-admin in the room: `advance_room` and `set_room_locked` →
  `not_room_admin`; cannot update settings, make themselves admin, rename,
  delete players or insert scores.
- Scores: one result per player per round (`already_submitted`), late joiners
  refused, solve time and points computed from the server clock. Admin status
  and round number cannot be written directly, even by the admin.
- Every function pins `search_path = ''`; `private` helpers are not callable by
  `anon`, and by `authenticated` only for the three RLS membership checks.
- Puzzles: readable by anyone on purpose (buggy code, tests and hint are what
  players get anyway). A puzzle id is only tied to a room when its round
  starts. No column holds a fix.

## 2. Fix leak

**Method**

- `pnpm fixes:check` on the production build (every reference fix vs every
  client chunk).
- Import graph of `lib/puzzles/generated/fixes.ts` (`import "server-only"`).
- Columns of every table, view and RPC result (`get_current_round`), and the
  Realtime publication.
- The reveal route `GET /api/rounds/<id>/fix` on the running build: live
  round, ended round, outsider, no token, the anon key as a token, a garbage
  token, a malformed id.

**Result: pass in the app, but see M1.**

- None of the 45 fixes is in the 50 client scripts; only the route handler
  imports the fixes module.
- No table, view or RPC result has a fix; Realtime publishes `rooms` and
  `players` only.
- Route: live round → `403 round_not_over`; ended round, member → `200` with
  the fix; ended round, outsider → `404 round_not_found`; no token, anon key
  or garbage token → `401`; responses are `Cache-Control: private, no-store`.
- **M1 (Medium, TB-65):** the GitHub repo is public and holds every fix
  (`puzzles/**/fix.*` and the generated `fixes.ts`). During a round a player
  can find the puzzle on GitHub by its title or code and copy the fix. All the
  in-app protection is bypassed without dev tools. Recommended: make the repo
  private (Vandit's call; no code change). Otherwise move the fixes out of the
  repo, or accept it for an internal game.

## 3. Abuse

**Method:** probes on local Supabase (oversized and HTML names / avatars,
control characters, 200 parallel heartbeats, admin settings during a live
round, presence on the room channel from an outsider), and a read of the
limits in `20261008000005_abuse_limits.sql` and the capacity work (TB-52).

**Result: pass, with three Low findings.**

- Room creation: 10 per user per rolling hour, enforced by a trigger with a
  per-user advisory lock (pgTAP `06`). New anonymous users per IP are a
  Supabase Auth setting: [LAUNCH.md](LAUNCH.md) §4 sets it to 200/hour.
- Names: 1–24 chars, no control characters, no `<` / `>`; avatars 1–16 chars,
  no `<` / `>`. All rejected cases came back `invalid_display_name` /
  `invalid_avatar`. React escapes text in any case.
- Join spam and the 30-player cap: `join_room` locks the room row, so the cap
  holds under parallel joins (pgTAP `05`, the 30-player load test of TB-52).
  A rejoin from the same browser reuses the seat.
- Oversized code in the runner: player code never leaves the browser (only
  `passed` / `hint_used` are sent) and only runs on the player's own machine,
  under the 5 s timeout. A huge paste or a memory bomb only hurts the
  attacker's tab (I3, already documented in Sandbox limits).
- **L1 (Low, fixed in TB-66):** the admin could update `language`, `level`
  and `total_rounds` directly at any time (verified during `round_live`).
  Now a `before update` trigger on `rooms` refuses a settings change unless
  the room is in the `lobby` (`room_settings_locked`). Tests:
  `supabase/tests/10_db_hardening.test.sql`.
- **L2 (Low, fixed in TB-66):** since TB-59, `room_heartbeat` took the room
  row lock before checking the caller is in the room, so any signed-in user
  who knew a room id could add lock contention. Now it checks membership
  first, without a lock; an outsider gets `room_not_found` and never touches
  the row (pgTAP checks the row's `xmax`). Not done: a per-player throttle
  (200 parallel heartbeats from one player: ~1.1 s, a few errors). A player
  can only slow their own room, as with any other function they may call.
- **L3 (Low, fixed in TB-66):** online dots came from presence on the public
  Realtime channel `room:<id>`; an outsider who knew the room id joined it and
  showed another player as online. The channel is now private: Realtime
  policies on `realtime.messages` let only players still in the room read it,
  track presence and send broadcasts (reactions). The outsider's join is
  refused (`Unauthorized`), and a public channel of the same name is a
  different channel. Tests: pgTAP `10` and E2E `e2e/multiplayer/rooms.spec.ts`
  ("someone outside the room cannot show a player as online"). Left: the
  presence key is chosen by the client, so a player in the room can still
  show a roommate as online. Cosmetic, and only inside their own room.
- **A1 (accepted):** `record_score` trusts the client's `hint_used`, and the
  hint text comes with the puzzle. Skipping the −25% is the same kind of
  cheat as a fake pass.
- **I2:** `find_open_room` is callable signed out and closes abandoned rooms
  first (a scan of open rooms). The open-room count is bounded by the
  creation limit; nothing to do before launch.

## 4. Headers and runner sandbox

**Method:** `curl -D -` against the production build for `/`, `/solo/play`,
`/room/<code>`, `/join/<code>`, the fix route, a 404, the runner worker
bootstrap under `/_next/static/immutable/chunks/` (Vercel's path) and Pyodide.
Read `lib/runner/js/lockdown.ts`, the worker CSP in `next.config.ts` and their
tests; the E2E suite (`e2e/hardening.spec.ts`, `e2e/runner.spec.ts`) covers
the network block and timeouts in a real browser.

**Result: pass, one Low finding fixed.**

- Every page, the API route and the 404 send the page CSP (`default-src
'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `connect-src` = this
  site + the Supabase origin), `nosniff`, `Referrer-Policy`,
  `Permissions-Policy` and `X-Frame-Options: DENY`.
- The worker bootstrap on the immutable path gets only the worker CSP
  (`default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'self'`);
  other built JS gets no CSP.
- Runner: network globals are replaced by non-deletable stubs; the worker
  CSP blocks every cross-origin request including `import()`; the run is
  killed from outside after 5 s; output is capped at 10,000 chars. Known
  limits are documented in [Sandbox limits](ARCHITECTURE.md#sandbox-limits).
- `'unsafe-inline'` scripts: accepted trade-off, documented in
  [Security headers](ARCHITECTURE.md#security-headers) (no user HTML; names
  reject `<` / `>`).
- HSTS: Vercel adds `Strict-Transport-Security` on its HTTPS domains.
- **L5 (fixed):** `X-Powered-By: Next.js` was sent. Now
  `poweredByHeader: false`; tests: `next.config.test.ts` and
  `e2e/hardening.spec.ts` ("pages send the security headers").

## 5. Secrets

**Method:** search of the tree and the full git history (`git log --all -p`)
for `service_role`, `sb_secret_`, JWTs, private keys and connection strings;
tracked files named like env or key files; search of the production client
bundle for the same patterns and the local secret key; `console.*` calls in
app code; CI workflows.

**Result: pass.**

- Only `.env.example` (empty values) is tracked; `.env*` is ignored.
- The client uses the publishable (anon) key only. `service_role` appears
  once, in `scripts/load/room-30.ts`, which reads the **local** key from
  `supabase status` and refuses any non-local host. No other code uses it.
- The client bundle has no secret; the only hit is supabase-js checking the
  `sb_secret_` prefix.
- App code logs nothing but one config error (`lib/rooms/browser-client.ts`,
  no secret). CI uses no secrets.
- **I1:** roommates can read each other's anonymous `user_id` in `players`.
  It is not a credential (a session needs the JWT), so it stays.

## 6. Dev pages

`/dev/rooms`, `/dev/runner` and `/dev/crash` shipped with the live site. The
room lab has a "Submit solve" button: a player could open it in the same
browser (same anonymous session), and submit a pass in one click, no dev tools.

**L4 (fixed):** `app/dev/layout.tsx` answers 404 when `VERCEL_ENV` is
`production`, so local runs, CI (E2E uses these pages) and preview
deployments keep them. Tests: `lib/security/dev-pages.test.ts`; checked by
hand with `VERCEL_ENV=production pnpm build && pnpm start` (`/dev/*` → 404,
`/` and `/solo` → 200).

## Re-running this review

```bash
pnpm db:start && pnpm db:test          # incl. 09_security_inventory
pnpm build && pnpm fixes:check
pnpm test:e2e                          # headers, worker CSP, runner sandbox
```

Update this file and `09_security_inventory.test.sql` together when a change
adds a table, grant, function or Realtime table on purpose.
