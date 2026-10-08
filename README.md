# Bug Hunt Race 🐛

A multiplayer web game for the team. Everyone gets the same buggy code snippet
and a set of failing tests; the fastest correct fix wins. There is also a Solo
Practice mode for beating your personal best.

- Languages (v1): JavaScript, TypeScript, Python, run in the browser
- Levels: Easy, Medium, Hard, Mixed
- Stack: Next.js (App Router) + TypeScript + Tailwind CSS, Monaco editor,
  Supabase (Postgres + Realtime), hosted on Vercel

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how it fits together.

## Run locally

Requires Node.js 22 (see `.nvmrc`; 20.9+ works) and pnpm 10
(`corepack enable` picks the pinned version).

```bash
pnpm install
cp .env.example .env.local   # optional until Supabase is connected
pnpm dev                     # http://localhost:3000
```

If `pnpm dev` logs `EMFILE: too many open files, watch` and pages never load,
your machine is out of file watchers: close other dev servers or run
`WATCHPACK_POLLING=true pnpm dev`.

## Scripts

| Command                     | What it does                                  |
| --------------------------- | --------------------------------------------- |
| `pnpm dev`                  | Start the dev server                          |
| `pnpm build`                | Production build                              |
| `pnpm bundle:check`         | First-load JS budget for Home and Solo setup  |
| `pnpm start`                | Serve the production build                    |
| `pnpm lint`                 | ESLint                                        |
| `pnpm format`               | Format everything with Prettier               |
| `pnpm format:check`         | Check formatting (CI runs this)               |
| `pnpm typecheck`            | Generate Next.js route types, then `tsc`      |
| `pnpm test`                 | Unit tests (Vitest)                           |
| `pnpm test:watch`           | Unit tests in watch mode                      |
| `pnpm test:e2e`             | End-to-end tests (Playwright)                 |
| `pnpm test:e2e:multiplayer` | Multi-player E2E tests (needs local Supabase) |
| `pnpm puzzles:check`        | Check every puzzle: buggy fails, fix passes   |
| `pnpm puzzles:build`        | Regenerate the puzzle index the app imports   |
| `pnpm db:start`             | Start local Supabase (Docker)                 |
| `pnpm db:stop`              | Stop local Supabase                           |
| `pnpm db:reset`             | Rebuild the local database from migrations    |
| `pnpm db:test`              | Database tests (pgTAP: RLS, rooms, scores)    |
| `pnpm db:types`             | Regenerate `lib/db/types.ts` from the schema  |

## Tests

- **Unit** tests sit next to the code they test as `*.test.ts(x)` and run with
  `pnpm test`.
- **E2E** tests live in `e2e/` and run with `pnpm test:e2e`. The first time,
  install the browser: `pnpm exec playwright install chromium`. Locally,
  Playwright starts `pnpm dev` for you (or reuses one already running on port
  3000). If port 3000 is taken by another app, pick another port:
  `E2E_PORT=3100 pnpm test:e2e`.
- **Multi-player** E2E tests live in `e2e/multiplayer/`, need a running local
  Supabase and are skipped without one. How to run and write them:
  [`e2e/README.md`](e2e/README.md).

## Code runner

Player code runs in the browser, in a sandboxed Web Worker. Try it at
[`/dev/runner`](http://localhost:3000/dev/runner) (a dev page; the game screens
replace it later). How it works and what is blocked:
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#code-runner-plug-in-interface).

## Local database

Needs Docker. The Supabase CLI is a dev dependency, so no global install.

```bash
pnpm db:start   # first run downloads the images; prints the local URL and keys
pnpm db:test
```

`pnpm db:start` prints a local API URL (`http://127.0.0.1:54321`) and a
publishable/anon key; put them in `.env.local` to point the app at the local
database. `supabase/seed.sql` loads three sample puzzles (dev only). Schema,
security rules and the data-access layer are described in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#data-model).

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every pull request and on
pushes to `main`: install → lint → format check → typecheck → unit tests →
puzzle check → build → bundle budget → E2E. A second job starts a fresh
Supabase database from the migrations, runs the pgTAP tests and checks
`lib/db/types.ts` is up to date. A third job starts a local Supabase
(database, auth, API, Realtime) and runs the two-browser room E2E tests. A PR
cannot merge unless CI is green.

## Environment variables

See [`.env.example`](.env.example). Only public Supabase values are used by the
app; never commit real values or service-role keys.
