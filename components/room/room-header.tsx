import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export function RoomHeader({ title }: { title: string }) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-sm font-bold underline"
        >
          ← Home
        </Link>
        <ThemeToggle />
      </div>
      <h1 className="font-display text-3xl font-bold">{title}</h1>
    </>
  );
}
