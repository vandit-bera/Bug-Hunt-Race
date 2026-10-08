import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

/** `actions` sit next to the theme toggle, e.g. a Leave room button. */
export function RoomHeader({
  title,
  actions,
}: {
  title: string;
  actions?: ReactNode;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-sm font-bold underline"
        >
          ← Home
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {actions}
          <ThemeToggle />
        </div>
      </div>
      <h1 className="font-display text-3xl font-bold">{title}</h1>
    </>
  );
}
