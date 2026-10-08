# Repo conventions

Read this before working in the repo. The product plan is the TB-19 epic;
the code-level design is in `docs/ARCHITECTURE.md`.

## Workflow

- Branch from `main`: `feature/<issue-id>-short-name`, `fix/…`, `refactor/…`.
  Never commit to `main`.
- Small, focused commits. One issue per PR. Link the issue in the PR.
- Before pushing, run: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`.
  Run `pnpm test:e2e` when you touch pages or flows.
- CI must be green and the PR reviewed by Full Stack Dev – Senior before merge.
- No new paid services, deploys or secrets without Vandit's approval.

## Code

- TypeScript strict. No `any` unless unavoidable, and then explain why in a comment.
- Use the `@/` import alias for anything outside the current folder.
- Keep `lib/game` pure (no React, no Supabase) and unit test it.
- Supabase access goes through `lib/supabase` (added in Phase 1.4).
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
