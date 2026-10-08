import { REPORT_BUG_URL } from "@/lib/game/features";
import pkg from "@/package.json";

const COMMIT = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";

export function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-4 border-t-2 border-border-subtle px-4 py-2 text-sm text-muted">
      <span>
        Bug Hunt Race v{pkg.version} ({COMMIT})
      </span>
      <a
        href={REPORT_BUG_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center font-bold underline"
      >
        Report a bug
      </a>
    </footer>
  );
}
