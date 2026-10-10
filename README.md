# Bug Hunt Race 🐛

[![CI](https://github.com/vandit-bera/Bug-Hunt-Race/actions/workflows/ci.yml/badge.svg)](https://github.com/vandit-bera/Bug-Hunt-Race/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A multiplayer web game for teams. Everyone gets the same buggy code snippet
and a set of failing tests; the fastest correct fix wins. There is also a Solo
Practice mode for beating your personal best.

**Play it:** [bug-hunt-race.vercel.app](https://bug-hunt-race.vercel.app)

<!-- Screenshot: add docs/images/screenshot.png and replace the line below. -->

> Screenshot and gameplay GIF coming soon.

## Features

- **Race Rooms:** up to 30 players join with a room code, link or QR code.
  Everyone gets the same puzzle and a shared timer; a live leaderboard shows
  who fixed it first. The room admin can pause, skip or stop a round.
- **Solo Practice:** play on your own and beat your personal best. No account
  and no database needed.
- **Three languages:** JavaScript, TypeScript and Python. Code runs in your
  browser in a sandboxed Web Worker (Python through Pyodide) with a 5 second
  time limit.
- **Levels:** Easy, Medium, Hard and Mixed.
- **Fun extras:** countdown, sounds (with mute), confetti, emoji reactions,
  badges and win streaks.
- **Light and dark theme**, keyboard friendly, works on phones.

## Tech stack

| Part            | Choice                                                   |
| --------------- | -------------------------------------------------------- |
| App             | Next.js (App Router), React, TypeScript (strict)         |
| Styling         | Tailwind CSS v4                                          |
| Editor          | Monaco                                                   |
| Database + live | Supabase (Postgres, Auth, Realtime)                      |
| Code runner     | In the browser: Web Worker for JS/TS, Pyodide for Python |
| Tests           | Vitest (unit), Playwright (E2E), pgTAP (database)        |
| Tooling         | pnpm, ESLint, Prettier, GitHub Actions, Vercel (hosting) |

How it all fits together: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Quick start

You do **not** need any real keys or a Supabase account. Solo Practice runs
with no database at all; Race Rooms use a local Supabase in Docker.

### 1. Solo Practice only

Requires Node.js 22 (see `.nvmrc`; 20.9+ works) and pnpm 10
(`corepack enable` picks the pinned version).

```bash
git clone https://github.com/vandit-bera/Bug-Hunt-Race.git
cd Bug-Hunt-Race
corepack enable
pnpm install
pnpm dev                     # http://localhost:3000
```

Open <http://localhost:3000> and pick **Solo Practice**.

### 2. Everything, with a local database

Also requires [Docker](https://docs.docker.com/get-docker/). The Supabase CLI
is a dev dependency, so there is nothing else to install.

```bash
pnpm db:start                # first run downloads the images (a few minutes)
cp .env.example .env.local
```

`pnpm db:start` prints a local API URL (`http://127.0.0.1:54321`) and a
publishable/anon key. Put them in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<the anon key printed by pnpm db:start>
```

These are local development values, not secrets. Run `pnpm exec supabase status`
to see them again. Then:

```bash
pnpm dev
```

Create a room, then open the invite link in a second browser (or a private
window) to join as another player. Stop the database with `pnpm db:stop`.

If `pnpm dev` logs `EMFILE: too many open files, watch` and pages never load,
your machine is out of file watchers: close other dev servers or run
`WATCHPACK_POLLING=true pnpm dev`.

## Running the tests

```bash
pnpm lint && pnpm format:check && pnpm typecheck   # static checks
pnpm test                                          # unit tests (Vitest)
pnpm puzzles:check                                 # every puzzle: buggy fails, fix passes
```

End-to-end tests (Playwright). The first time, install the browsers:

```bash
pnpm exec playwright install chromium webkit
pnpm test:e2e                       # every test in Chromium and WebKit
pnpm test:e2e --project=chromium    # one browser only
E2E_PORT=3100 pnpm test:e2e         # if port 3000 is taken
```

Locally, Playwright starts `pnpm dev` for you (or reuses one already running
on the port).

Tests that need the local database (start it first with `pnpm db:start`):

```bash
pnpm db:test                        # database tests (pgTAP: security rules, rooms, scores)
pnpm test:e2e:multiplayer           # multi-player E2E with several browsers
```

Multi-player tests are skipped when no local Supabase is running. How to run
and write them: [`e2e/README.md`](e2e/README.md). Which test covers which
flow: [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md).

## Adding a puzzle

New puzzles are the easiest way to contribute. Each puzzle is a folder in
`puzzles/<language>/<level>/<id>/` with metadata, the buggy code, tests and a
reference fix. The rule: the buggy code must fail at least one test and the
fix must pass every test.

Read [`puzzles/README.md`](puzzles/README.md) for the format and what makes a
good puzzle, and [`CONTRIBUTING.md`](CONTRIBUTING.md#adding-a-puzzle) for how
to send one in. Not ready to write code? Open a
[new puzzle idea](https://github.com/vandit-bera/Bug-Hunt-Race/issues/new?template=puzzle_idea.yml).

## Scripts

| Command                     | What it does                                  |
| --------------------------- | --------------------------------------------- |
| `pnpm dev`                  | Start the dev server                          |
| `pnpm build`                | Production build                              |
| `pnpm bundle:check`         | First-load JS budget for Home and Solo setup  |
| `pnpm fixes:check`          | No reference fix in client JS (after build)   |
| `pnpm start`                | Serve the production build                    |
| `pnpm lint`                 | ESLint                                        |
| `pnpm format`               | Format everything with Prettier               |
| `pnpm format:check`         | Check formatting (CI runs this)               |
| `pnpm typecheck`            | Generate Next.js route types, then `tsc`      |
| `pnpm test`                 | Unit tests (Vitest)                           |
| `pnpm test:watch`           | Unit tests in watch mode                      |
| `pnpm test:e2e`             | End-to-end tests (Playwright)                 |
| `pnpm test:e2e:multiplayer` | Multi-player E2E tests (needs local Supabase) |
| `pnpm smoke:live`           | Smoke test a deployed site (`E2E_BASE_URL`)   |
| `pnpm load:room`            | Load test: 30 players × 3 rounds, local only  |
| `pnpm puzzles:check`        | Check every puzzle: buggy fails, fix passes   |
| `pnpm puzzles:build`        | Regenerate the puzzle index, fixes and SQL    |
| `pnpm db:start`             | Start local Supabase (Docker)                 |
| `pnpm db:stop`              | Stop local Supabase                           |
| `pnpm db:reset`             | Rebuild the local database from migrations    |
| `pnpm db:test`              | Database tests (pgTAP: RLS, rooms, scores)    |
| `pnpm db:types`             | Regenerate `lib/db/types.ts` from the schema  |

## More docs

- **Code runner:** player code runs in a sandboxed Web Worker. Try it at
  [`/dev/runner`](http://localhost:3000/dev/runner) in local dev. How it
  works and what is blocked:
  [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#code-runner-plug-in-interface).
- **Database:** schema, security rules and the data-access layer are in
  [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#data-model). The local seed is
  `supabase/puzzles.sql`, generated from `puzzles/`.
- **Load test:** `pnpm load:room` fills one room with 30 headless players on
  the local Supabase and prints latencies and correctness checks. It refuses
  any non-local Supabase. Results:
  [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#capacity).
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) runs on every pull
  request: lint, format, typecheck, unit tests, puzzle check, build, bundle
  budget, fix leak check and E2E in Chromium, Firefox and WebKit, plus
  database tests and multi-player E2E against a fresh local Supabase.
- **Deploying your own copy:** [`docs/LAUNCH.md`](docs/LAUNCH.md) (env vars,
  migrations, Supabase Auth settings, smoke test, rollback).
- **Security:** [`SECURITY.md`](SECURITY.md) to report a problem;
  [`docs/SECURITY_REVIEW.md`](docs/SECURITY_REVIEW.md) for the pre-launch
  review.
- **Repo conventions:** [`AGENTS.md`](AGENTS.md) (read by humans and AI
  coding assistants alike).

## Environment variables

See [`.env.example`](.env.example). The app only uses public Supabase values
(the project URL and the anon key, which row-level security protects). Never
commit real values or service-role keys.

## Project status

Bug Hunt Race is live and actively developed. v1 covers JavaScript,
TypeScript and Python, Solo Practice and Race Rooms of up to 30 players.
Bug reports, puzzle ideas and pull requests are welcome; see
[`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

[MIT](LICENSE) © Vandit Bera
