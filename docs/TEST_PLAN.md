## Test plan and coverage map

Which test proves each flow and each failure case in the TB-19 plan
(§13–§14 flows, §17 test plan, §18 failure cases). Every row names at least
one automated test that runs in CI on every pull request.

Where the tests run (`.github/workflows/ci.yml`):

| Job        | What it runs                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| `ci`       | lint, types, unit tests (Vitest), `puzzles:check`, build, then single-player E2E (`e2e/*.spec.ts`) in Chromium |
| `browsers` | the same single-player E2E in Firefox and in WebKit (one job per browser)                                      |
| `database` | pgTAP tests (`supabase/tests/`) on a fresh Postgres with every migration                                       |
| `realtime` | multi-player E2E (`e2e/multiplayer/`) against a local Supabase, Chromium, **no retries**                       |

Paths below are relative to the repo root; E2E names are the Playwright test titles.

## Flows

| Flow                                       | Covered by                                                                                                                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Solo: setup, play, result (JS, TS, Python) | `e2e/solo.spec.ts`: "javascript/typescript: setup, fix the bug, see the result", "Python: setup, fix the bug, see the result"; hints, give up, time out, Mixed steps                           |
| Solo stats and badges                      | `e2e/stats.spec.ts`; `lib/game/badges.test.ts`, `lib/game/progress.test.ts`                                                                                                                    |
| Create room (code, link, QR, copy, share)  | `e2e/multiplayer/create-room.spec.ts`: "Create Room opens the ready panel with code, link and a QR of the link", "Copy puts the exact invite link on the clipboard", "Share shows only where…" |
| Join by code / link / QR                   | `e2e/multiplayer/join.spec.ts`: "code, link and QR all reach the same lobby"; `e2e/join.spec.ts` (code field)                                                                                  |
| Lobby (live list, admin panel, lock)       | `e2e/multiplayer/join.spec.ts` "lobby" group; `e2e/multiplayer/rooms.spec.ts`; `e2e/multiplayer/create-room.spec.ts` "the Lock switch…"                                                        |
| Race round (same puzzle, clock, countdown) | `e2e/multiplayer/race.spec.ts`: "a race: same countdown, puzzle and clock; solve, pause, skip, late joiner, stop"; `e2e/multiplayer/round.spec.ts`                                             |
| Admin Pause / Resume / Skip / Stop         | `e2e/multiplayer/race.spec.ts` (first and third tests); `lib/game/room-machine.test.ts`; `supabase/tests/07_round_engine.test.sql`                                                             |
| Round results and live leaderboard         | `e2e/multiplayer/scoring.spec.ts`: "a full 2-player game: live leaderboard, round results, podium, play again, close"                                                                          |
| Final podium                               | `e2e/multiplayer/scoring.spec.ts`; `e2e/room-ui.spec.ts` "podium admin buttons and confetti respect reduced motion"                                                                            |
| Play again                                 | `e2e/multiplayer/end-of-game.spec.ts`: "two games in a row: Play again resets the leaderboard, Close ends the room"; `e2e/multiplayer/race.spec.ts` third test                                 |
| Close room                                 | `e2e/multiplayer/end-of-game.spec.ts` (same test: everyone sees "Room closed", code and link refused)                                                                                          |
| Room state machine (every transition)      | `lib/game/room-machine.test.ts`; `supabase/tests/05_room_engine.test.sql`                                                                                                                      |
| Theme (light / dark / system)              | `e2e/theme.spec.ts`; `e2e/errors.spec.ts` (both themes)                                                                                                                                        |
| Accessibility (keyboard, reduced motion)   | `e2e/join.spec.ts` "keyboard only"; `e2e/theme.spec.ts` roving tabindex; `e2e/solo.spec.ts` "reduced motion…"; `e2e/room-ui.spec.ts` "30-player leaderboard … works by keyboard"               |
| Phones (320–414 px)                        | `e2e/mobile.spec.ts`; width checks in `e2e/solo.spec.ts`, `e2e/stats.spec.ts`, `e2e/room-ui.spec.ts`, `e2e/multiplayer/join.spec.ts` "on a phone, in dark mode"                                |
| Security (CSP, headers, no fix leak)       | `e2e/hardening.spec.ts`; `e2e/multiplayer/race.spec.ts` (no response holds the fix during a round); `pnpm fixes:check`; `supabase/tests/03_rls.test.sql`, `09_security_inventory.test.sql`     |

## §18 failure cases

| If this happens…                         | Covered by                                                                                                                                                                                                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Infinite loop (JavaScript)               | `e2e/solo.spec.ts` "an infinite loop shows Time limit exceeded and the page stays usable"; `e2e/runner.spec.ts` "an infinite loop times out at ~5s…"; `e2e/multiplayer/failure-cases.spec.ts` "§18 infinite loop in a race round…" (new)                             |
| Infinite loop (Python)                   | `e2e/runner.spec.ts` "Python: an infinite loop times out at ~5s, the page stays responsive and the next run works"; `lib/runner/node.test.ts`                                                                                                                        |
| Internet drops; rejoin keeps the score   | `e2e/multiplayer/resilience.spec.ts` "a player who drops for 10 s mid-round keeps their seat and score"; `e2e/multiplayer/failure-cases.spec.ts` "§18 rejoin: closing the tab and opening the invite link again keeps the seat and score" (new)                      |
| Admin leaves → role passes on            | `e2e/multiplayer/rooms.spec.ts` "the admin role passes on when the admin drops for more than 15 s"; `e2e/multiplayer/harness.spec.ts`; `supabase/tests/05_room_engine.test.sql`                                                                                      |
| Admin Stop mid-round → final leaderboard | `e2e/multiplayer/race.spec.ts` "the admin plays too, and Stop from a live round ends the game" (live) and the first test (paused)                                                                                                                                    |
| Simultaneous finish / exact tie          | `supabase/tests/04_scores.test.sql` "exact ties share the place", "equal points: the earlier last solve (server time) wins"; `supabase/tests/08_end_of_game.test.sql`; `lib/rooms/leaderboard.test.ts`; `components/results/results.test.tsx` "shows shared places…" |
| Nobody solves → fix revealed, 0 points   | `e2e/multiplayer/race.spec.ts` "everyone done ends the round early; nobody solved shows the fix" (now also checks 0 points); `e2e/solo.spec.ts` "time running out ends the game with 0 points"                                                                       |
| Join mid-round → waits for next round    | `e2e/multiplayer/join.spec.ts` "a player who joins mid-round waits for the next round"; `e2e/multiplayer/race.spec.ts` (Dev, first test)                                                                                                                             |
| Wrong / expired code or link             | `e2e/multiplayer/join.spec.ts` "unknown code: Room not found, with Try again"; `e2e/multiplayer/end-of-game.spec.ts` (closed room's code and link); `supabase/tests/02_rooms.test.sql`, `05_room_engine.test.sql` (auto-closed room)                                 |
| Room locked                              | `e2e/multiplayer/join.spec.ts` "locked room"; `e2e/multiplayer/rooms.spec.ts` "only the admin can lock the room…"                                                                                                                                                    |
| Room full (30)                           | `e2e/multiplayer/join.spec.ts` "full room (30/30)"; `supabase/tests/05_room_engine.test.sql` (30-player cap); `pnpm load:room` (manual, 30 players)                                                                                                                  |
| Same name twice → "Riya (2)"             | `e2e/multiplayer/join.spec.ts` "duplicate names get a number, and a reload keeps the identity"                                                                                                                                                                       |
| Everyone leaves → room closes (10 min)   | `supabase/tests/05_room_engine.test.sql` "the first heartbeat after 10 minutes of nobody closes the room", "an empty room older than 10 minutes is closed on lookup". Not an E2E test: it would wait 10 minutes.                                                     |
| Clipboard blocked → manual copy          | `e2e/multiplayer/create-room.spec.ts` "clipboard denied: the link is shown pre-selected"; `e2e/room-ui.spec.ts` "clipboard denied…"                                                                                                                                  |
| A puzzle is broken → CI blocks it        | `pnpm puzzles:check` in the `ci` job; `scripts/check-puzzles.test.ts` "exits non-zero and names each broken puzzle"; `lib/puzzles/check.test.ts`                                                                                                                     |
| Python slow to load → loading bar        | `e2e/multiplayer/failure-cases.spec.ts` "§18 Python slow to load: the round shows a loading bar until Python is ready" (new); `e2e/runner.spec.ts` "Python: preload reports progress…"; `e2e/hardening.spec.ts` (Solo setup preloads Python)                         |
| Pyodide preloaded in the lobby           | `e2e/multiplayer/preload.spec.ts` "§18 Python slow to load: Pyodide is preloaded in the lobby", "a JavaScript room's lobby does not download Pyodide" (TB-76)                                                                                                        |
| Supabase down → error with Retry         | `e2e/multiplayer/resilience.spec.ts` "Supabase unreachable: a friendly error with Retry, which recovers"; `e2e/errors.spec.ts` "error page … Retry recovers"; `lib/rooms/retry.test.ts`                                                                              |
| Finished-round scores are not lost       | `e2e/multiplayer/resilience.spec.ts` "a result whose answer was lost is counted once" and the 10 s drop test; `supabase/tests/04_scores.test.sql`                                                                                                                    |
| Dev agent fails a task twice             | Team process, not app behaviour: no test.                                                                                                                                                                                                                            |

## Flakes

Run the suite five times without retries before a release:

```bash
pnpm exec playwright test --project=chromium --repeat-each=5 --retries=0
```

| Test                                                                          | Cause                                                                                                                                    | Status                                                                                      |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `race.spec.ts` "everyone done ends the round early; nobody solved…"           | The last give-up ends the round at once, so "You gave up this one." can vanish before the check (`realtime` on `main`, 2026-10-09 10:07) | Fixed: `solve` / `giveUp` in `e2e/support/race.ts` accept the round results screen as well. |
| `hardening.spec.ts` "the Solo game loads Monaco (the check above can see it)" | Monaco can take over 5 s to appear when the machine is busy                                                                              | Fixed: waits up to 15 s, like the other Solo game tests.                                    |
| `runner.spec.ts` "Python: an infinite loop times out at ~5s…" (WebKit)        | The warm-spare run took 3.1 s on a busy CI runner, over the 3 s limit (flaky on `main`)                                                  | Fixed: limit is 4 s.                                                                        |
| Every Solo test that edits code (Firefox)                                     | Monaco's Firefox input ignores the synthetic paste in `setCode`                                                                          | Fixed: `setCode` types the code with `insertText` in Firefox (no auto-indent there).        |

Known browser difference, tracked as an app issue: WebKit overflows its JS stack
before Python's recursion limit (TB-67), so that test is `test.fixme` in WebKit
only. Firefox's stack overflow now reports `RangeError` like Node (TB-77).

## Manual checks

Not automated, checked by QA before launch (TB-64, TB-75): the QR code
opening the room on a real iPhone and Android phone, and Copy on real
Safari and Firefox.
