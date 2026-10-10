# Contributing to Bug Hunt Race

Thanks for helping! Bug reports, puzzle ideas, new puzzles, docs fixes and
code changes are all welcome.

By taking part you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).
Found a security problem? Do **not** open a public issue; follow
[`SECURITY.md`](SECURITY.md).

## Before you start

- **Small fixes** (typos, docs, an obvious bug): just open a pull request.
- **Anything bigger** (a new feature, a change to how the game plays, a new
  dependency): open an issue first so we can agree on the idea before you
  spend time on it.
- Look for an existing issue before opening a new one. Use the issue
  templates: bug report, feature request or new puzzle idea.

## Set up

Follow the [Quick start](README.md#quick-start) in the README. You need no
real keys: Solo Practice runs with no database, and Race Rooms use a local
Supabase in Docker.

Repo conventions (folder layout, code rules, test rules) are in
[`AGENTS.md`](AGENTS.md). Read it once before your first change.

## Branch and pull request flow

1. Fork the repo (or create a branch if you have write access).
2. Branch from `main`: `feature/<short-name>`, `fix/<short-name>` or
   `docs/<short-name>`. If there is an issue, put its number in the name,
   e.g. `fix/123-timer-pause`.
3. Make small, focused commits with clear messages. One topic per PR.
4. Run the checks below before you push.
5. Open a pull request against `main` and fill in the template. Link the
   issue (`Closes #123`).
6. CI must be green and a maintainer must approve before the PR is merged.
   We may ask for changes; that is normal.

## Checks to run before pushing

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
```

Also run:

- `pnpm puzzles:check` when you touch `puzzles/` or the code runner.
- `pnpm test:e2e` when you touch pages or game flows.
- `pnpm db:test` (and `pnpm db:types`) when you touch `supabase/`.
- `pnpm test:e2e:multiplayer` when you touch rooms or Realtime.

### What CI checks

GitHub Actions (`.github/workflows/ci.yml`) runs on every pull request:

| Job        | Checks                                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `ci`       | lint, format, typecheck, unit tests, puzzle check, build, bundle size budget, no reference fix in client JS, E2E in Chromium |
| `browsers` | E2E in Firefox and WebKit (Safari's engine)                                                                                  |
| `database` | fresh local Supabase from the migrations, pgTAP tests, `lib/db/types.ts` up to date                                          |
| `realtime` | multi-player E2E against a local Supabase (no retries, so a flaky test fails)                                                |

## Code style

- **Prettier owns formatting.** Run `pnpm format` and do not hand-format
  against it. ESLint must pass with no warnings you added.
- **TypeScript strict.** No `any` unless there is no other way, and then say
  why in a comment.
- **Keep it simple.** Small functions, clear names, no dead code, no debug
  logs, no commented-out code.
- **Tests come with changes.** New logic gets unit tests; bug fixes get a
  regression test; new flows get an E2E test.
- **Follow the existing patterns** for components, styles and data access
  (see `AGENTS.md` and `docs/ARCHITECTURE.md`). Reuse existing components and
  design tokens instead of adding new styles.
- **Accessible and responsive by default:** semantic HTML, labels on inputs,
  keyboard support, and layouts that work from 320px phones to desktop.
- **New dependencies** need a reason in the PR description.
- **Database changes** are new files in `supabase/migrations/` with row-level
  security, a pgTAP test and regenerated types (`pnpm db:types`). Never edit
  a migration that is already on `main`.

## Adding a puzzle

1. Read [`puzzles/README.md`](puzzles/README.md): the folder format, the
   size limits per level and what makes a good puzzle.
2. Add your folder under `puzzles/<language>/<level>/<id>/`.
3. Run `pnpm puzzles:check` until it is green. The rule for every puzzle:
   **the buggy code must fail at least one test and the reference fix must
   pass every test.**
4. Run `pnpm puzzles:build` and commit the generated files with the puzzle.
5. Open a PR. In the description, explain the bug in one line so the
   reviewer can check the puzzle is fair.

Only have an idea? Open a "New puzzle idea" issue instead.

Please do not post solutions to puzzles in issues, discussions or PR
descriptions for puzzles that are already live.

## Never commit secrets

- Never commit `.env.local`, real Supabase keys, service-role keys, access
  tokens or passwords. `.env*` files are git-ignored except `.env.example`,
  which must only hold empty values and comments.
- The local Supabase URL and anon key printed by `pnpm db:start` are
  development values; still keep them in `.env.local`, not in code.
- Never put a puzzle's reference fix anywhere the browser can load it.
  `pnpm fixes:check` fails the build if a fix ends up in client JavaScript.
- If you committed a secret by mistake, tell a maintainer privately (see
  [`SECURITY.md`](SECURITY.md)). Removing the commit is not enough; the key
  must be rotated.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
