import type { Metadata } from "next";
import { ThemeToggle } from "@/components/theme-toggle";
import { Showcase } from "./showcase";

export const metadata: Metadata = {
  title: "Styleguide · Bug Hunt Race",
};

export default function StyleguidePage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Styleguide</h1>
          <p className="text-muted">
            Tokens and components in both themes. The toggle changes the whole
            app theme; the panels below always show a fixed theme.
          </p>
        </div>
        <ThemeToggle />
      </header>
      <div className="grid gap-6 xl:grid-cols-2">
        <Showcase theme="light" />
        <Showcase theme="dark" />
      </div>
    </main>
  );
}
