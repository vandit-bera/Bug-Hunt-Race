# Launch checklist

The steps to put Bug Hunt Race live (TB-19 Phase 5), in order. **The launch
needs Vandit's approval**, and only Vandit applies changes to the live
Supabase project and sets secrets. Tick each box in the launch issue.

## 1. Before you start

- [ ] `main` is green in CI (all three jobs) and every Phase 4 PR is merged.
- [ ] Locally on `main`: `pnpm lint && pnpm typecheck && pnpm test && pnpm puzzles:check && pnpm build`.
- [ ] Note the current production deployment in Vercel (for rollback, §7).
- [ ] Back up the live database: Supabase dashboard → Database → Backups
      (Pro plan), or `pg_dump` with the project's connection string (Free
      plan has no dashboard backups). Keep the file off the repo.

## 2. Environment variables (Vercel)

Vercel → Project → Settings → Environment Variables, for **Production** and
**Preview**. Only these two; both are public by design (row-level security
protects the data).

| Name                            | Value                                                        |
| ------------------------------- | ------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase → Project Settings → API → Project URL              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → publishable or anon |

- [ ] Both set. They are read at build time (`NEXT_PUBLIC_*` and the CSP in
      `next.config.ts`), so **redeploy** after changing them.
- [ ] No service-role or secret key anywhere in Vercel or the repo. The app
      never needs one.
- [ ] Check the values (TB-62):
  - `NEXT_PUBLIC_SUPABASE_URL` is exactly `https://<ref>.supabase.co`: no
    `/rest/v1`, no trailing slash, no spaces or quotes. The app strips a
    trailing `/rest/v1`, `/auth/v1` or `/realtime/v1` and slashes, but fix the
    value anyway.
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` is the publishable (or anon) key, not the
    service-role or secret key.
  - After the redeploy, search the Vercel build log for
    `Supabase is misconfigured`. It names the wrong variable (never its
    value) and means rooms are switched off ("Rooms are not available").

## 3. Database (Supabase SQL Editor)

Run each file from `supabase/migrations/` in the SQL Editor, **in order**, one
at a time, and stop at the first error. Skip files already applied (the check
query below tells you which).

- [ ] `20261008000001_core_schema.sql`
- [ ] `20261008000002_row_level_security.sql`
- [ ] `20261008000003_room_functions.sql`
- [ ] `20261008000004_room_engine.sql` (also adds `rooms` and `players` to
      Realtime)
- [ ] `20261008000005_abuse_limits.sql`
- [ ] `20261008000006_round_engine.sql`
- [ ] `20261009000007_end_of_game.sql`
- [ ] `20261009000008_db_hardening.sql` (makes the room's Realtime channel
      private: apply it **before** deploying the app from the same commit,
      or nobody's lobby goes live)
- [ ] `supabase/puzzles.sql` (the puzzle catalog; safe to run again, and run it
      again whenever `puzzles/` changes)

Check query (every row must say `true`):

```sql
select m.migration,
       to_regprocedure(m.fn) is not null as applied
from (values
  ('000001 core schema',        'public.set_room_closed_at()'),
  ('000002 row-level security', 'private.is_round_member(uuid)'),
  ('000003 room functions',     'private.generate_room_code()'),
  ('000004 room engine',        'private.touch_presence(uuid)'),
  ('000005 abuse limits',       'private.limit_room_creation()'),
  ('000006 round engine',       'private.pick_puzzle(public.rooms)'),
  ('000007 end of game',        'private.is_closed_code(text)'),
  ('000008 db hardening',       'private.guard_room_settings()')
) as m(migration, fn)
union all
select 'puzzles.sql (' || count(*) filter (where active) || ' active puzzles)',
       count(*) filter (where active) > 0
from public.puzzles;
```

- [ ] All `true`, and the active puzzle count matches the number of puzzles in
      `puzzles/` (45 at the time of writing).
- [ ] Realtime: Database → Publications → `supabase_realtime` lists `rooms` and
      `players` (and not `scores`).

## 4. Supabase Auth settings

Authentication → Sign In / Providers, and Authentication → Rate Limits.

- [ ] **Anonymous sign-ins: on.** Every player is an anonymous user; without it
      nobody can create or join a room.
- [ ] **Anonymous sign-ins per hour, per IP: 200.** The default (30) is too low
      for an office: the whole team shares one public IP, and each new browser
      or private window is a new anonymous user.
- [ ] Token refreshes (default 150 per 5 min per IP) is enough for 30 players;
      leave it.
- [ ] Email, phone and social providers stay off (not used).

## 5. Realtime limits (from TB-52)

The numbers and how they were measured are in
[`ARCHITECTURE.md` → Capacity](ARCHITECTURE.md#capacity). On the Supabase
**Free** plan:

| Quota                        | Free plan | What it means for us                                        |
| ---------------------------- | --------- | ----------------------------------------------------------- |
| Concurrent connections       | 200       | 6 full rooms at most; plan for **5** (reconnects, 2nd tabs) |
| Messages per second          | 100       | ~30 per room state change; 3 rooms changing at once hit it  |
| Presence messages per second | 20        | 30 players joining in the same second briefly exceed it     |
| Messages per month           | 2 million | ~2,300 per 30-player game → ~850 games a month              |

- [ ] For the team game (one room of 30), Free is enough. Ask players to join
      over a few seconds, not on a countdown; a burst only costs a short
      reconnect (the "Reconnecting…" banner), never a seat or a score.
- [ ] A Free project **pauses after a week without traffic**. Open the site (or
      run the smoke test) the day before a game, or move to Pro (spending: ask
      Vandit).

## 6. Deploy and smoke test

- [ ] Deploy `main` to production in Vercel (or promote the green preview).
- [ ] Run the smoke test against the live site from any machine with the repo:

  ```bash
  pnpm install
  pnpm exec playwright install chromium
  E2E_BASE_URL=https://<live site> pnpm smoke:live
  ```

  It checks (`e2e/live/smoke.spec.ts`): Home loads with the security headers;
  a Solo puzzle loads and the code runner runs it; the 404 page; the fix
  route refuses anonymous requests; and two browsers create a room, join by
  link, see each other and leave (this creates one room in the live database).

- [ ] By hand, with two phones on mobile data and one laptop on office Wi-Fi:
      create a room, join by QR, play one round, turn one phone's network off
      for 10 s mid-round and back on: it shows "Reconnecting…", then the same
      seat and score.
- [ ] Light and dark theme look right; no errors in the browser console.

## 7. Rollback

- **App:** Vercel → Deployments → the previous production deployment (noted in
  §1) → **Instant Rollback**. Takes seconds; no data is touched.
- **Environment variables:** fix the value, then redeploy (they are baked in at
  build time).
- **Database:** migrations are forward-only and the app at a given commit
  expects all migrations up to that commit, so do **not** run hand-written
  `drop` statements. If a migration broke the live data, restore the backup
  from §1 (Supabase → Database → Backups, or `psql` with the `pg_dump` file)
  and roll the app back to the matching deployment. A wrong puzzle is fixed by
  re-running `supabase/puzzles.sql` from a fixed commit.
- **Auth settings:** turning anonymous sign-ins off stops new players at once
  (existing sessions keep working until they expire); use it as the
  emergency stop.

## 8. After launch

- [ ] Post the live URL and the results of §6 on the launch issue.
- [ ] Watch Supabase → Reports → Realtime during the first team game.
- [ ] `/dev/rooms`, `/dev/runner` and `/dev/crash` answer 404 on the live
      site (`VERCEL_ENV=production`); local runs, CI and previews keep them
      for the E2E suite. Check that `/dev/rooms` is a 404 after deploying.
