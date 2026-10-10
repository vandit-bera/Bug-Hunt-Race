## What and why

<!-- What does this PR change, and why? -->

Closes #

## How to test

<!-- Steps a reviewer can follow, e.g. pages to open and what to check. -->

## Screenshots

<!-- For UI changes: before and after, light and dark theme, mobile and desktop. -->

## Checklist

- [ ] `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build` pass
- [ ] Tests added or updated (unit, E2E or pgTAP)
- [ ] `pnpm puzzles:check` passes (if I touched `puzzles/` or the code runner)
- [ ] `pnpm test:e2e` passes (if I touched pages or game flows)
- [ ] `pnpm db:test` passes and types are regenerated (if I touched `supabase/`)
- [ ] Works on mobile and desktop, in light and dark theme (if I touched UI)
- [ ] Docs updated (`README.md`, `docs/ARCHITECTURE.md`, `.env.example`) if setup or contracts changed
- [ ] No secrets, real keys or puzzle fixes in client code, docs or comments
- [ ] New dependencies are explained above
