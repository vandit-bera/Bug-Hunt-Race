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

| Command              | What it does                                    |
| -------------------- | ----------------------------------------------- |
| `pnpm dev`           | Start the dev server                            |
| `pnpm build`         | Production build                                |
| `pnpm start`         | Serve the production build                      |
| `pnpm lint`          | ESLint                                          |
| `pnpm format`        | Format everything with Prettier                 |
| `pnpm format:check`  | Check formatting (CI runs this)                 |
| `pnpm typecheck`     | Generate Next.js route types, then `tsc`        |
| `pnpm test`          | Unit tests (Vitest)                             |
| `pnpm test:watch`    | Unit tests in watch mode                        |
| `pnpm test:e2e`      | End-to-end tests (Playwright)                   |
| `pnpm puzzles:check` | Puzzle auto-checker (placeholder until Phase 2) |

## Tests

- **Unit** tests sit next to the code they test as `*.test.ts(x)` and run with
  `pnpm test`.
- **E2E** tests live in `e2e/` and run with `pnpm test:e2e`. The first time,
  install the browser: `pnpm exec playwright install chromium`. Locally,
  Playwright starts `pnpm dev` for you (or reuses one already running on port
  3000). If port 3000 is taken by another app, pick another port:
  `E2E_PORT=3100 pnpm test:e2e`.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every pull request and on
pushes to `main`: install → lint → format check → typecheck → unit tests →
puzzle check → build → E2E. A PR cannot merge unless CI is green.

## Environment variables

See [`.env.example`](.env.example). Only public Supabase values are used by the
app; never commit real values or service-role keys.
