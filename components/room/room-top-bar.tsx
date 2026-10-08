import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

/** Home link, optional extra controls, and the theme toggle. */
export function RoomTopBar({ children }: { children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center text-sm font-bold underline"
      >
        ← Home
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <ThemeToggle />
      </div>
    </div>
  );
}
