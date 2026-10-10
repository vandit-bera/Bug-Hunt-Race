# Security policy

## Reporting a vulnerability

**Please do not open a public issue, discussion or pull request for a
security problem.** Report it privately so it can be fixed before anyone can
misuse it.

1. Go to the repo's [Security tab](https://github.com/vandit-bera/Bug-Hunt-Race/security).
2. Click **Report a vulnerability**.
3. Describe the problem: what an attacker can do, the steps to reproduce it,
   and the affected page, API route, database function or file.

GitHub's guide:
[Privately reporting a security vulnerability](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability).

This is a small project run in spare time, so there is no bug bounty. We aim
to reply within a week, keep you updated while we work on a fix, and credit
you in the advisory if you want.

## In scope

- The game at [bug-hunt-race.vercel.app](https://bug-hunt-race.vercel.app)
  and the code in this repo.
- Examples: escaping the code-runner sandbox, reading or changing another
  player's data or score, bypassing row-level security, taking over a room
  you are not admin of, getting puzzle fixes from the live site, leaked
  secrets in the repo.

## Out of scope

- Denial of service or load testing against the live site. Use the local
  load test (`pnpm load:room`) instead.
- Social engineering, spam and physical attacks.
- Problems in Supabase, Vercel or other third-party services themselves;
  report those to the vendor.
- Known issues already listed in
  [`docs/SECURITY_REVIEW.md`](docs/SECURITY_REVIEW.md), such as puzzle
  reference fixes being readable in this public repo (M1).

## Testing safely

Test against your own local copy (see the [Quick start](README.md#quick-start)),
not the live site. Never access, change or delete other people's data.

## Supported versions

Only the latest `main` branch (what runs on the live site) gets security
fixes.
