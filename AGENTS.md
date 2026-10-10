# Repo conventions

Read this before working in the repo. It is for everyone who changes code:
human contributors and AI coding assistants (tools such as Claude Code and
Codex read `AGENTS.md` automatically; `CLAUDE.md` just points here). How to
send a change is in `CONTRIBUTING.md`; the code-level design is in
`docs/ARCHITECTURE.md`.

IDs like `TB-19` in commits, PRs and docs are the maintainers' internal issue
tracker numbers. You do not need access to it: GitHub issues work the same.

## Workflow

- Branch from `main`: `feature/<issue-id>-short-name`, `fix/…`, `refactor/…`.
  Never commit to `main`.
- Small, focused commits. One issue per PR. Link the issue in the PR.
- Before pushing, run: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`.
  Run `pnpm test:e2e` when you touch pages or flows, and `pnpm db:test` when
  you touch `supabase/`.
- CI must be green and a maintainer must approve the PR before merge.
- No new paid services, deploys or secrets without the maintainer's approval.

## Code

- TypeScript strict. No `any` unless unavoidable, and then explain why in a comment.
- Use the `@/` import alias for anything outside the current folder.
- Keep `lib/game` pure (no React, no Supabase) and unit test it.
- Supabase access goes through `lib/db`. Schema changes are new files in
  `supabase/migrations/` with RLS, a pgTAP test and regenerated types
  (`pnpm db:types`).
- Server components by default; add `"use client"` only where needed.
- Prettier owns formatting; do not hand-format against it.
- No dead code, debug logs or commented-out code.
- File names: `kebab-case.ts(x)`; React components export `PascalCase`.

## Tests

- Unit tests next to the code: `foo.ts` → `foo.test.ts` (Vitest).
- E2E tests in `e2e/` (Playwright). Prefer role/name selectors.
- Bug fixes come with a regression test.
- Every puzzle: buggy code must fail its tests, reference fix must pass
  (`pnpm puzzles:check`).

## Docs

Update `README.md`, `docs/ARCHITECTURE.md` and `.env.example` when you change
setup, env vars, the runner interface, the room state machine or the data
model.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
