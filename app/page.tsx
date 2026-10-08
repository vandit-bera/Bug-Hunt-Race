import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonClass } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
        Bug Hunt Race 🐛
      </h1>
      <p className="max-w-md text-lg text-muted">
        Race your team to fix buggy code. Fastest correct fix wins.
      </p>
      <Link href="/solo" className={buttonClass({ size: "lg" })}>
        Solo Practice
      </Link>
      <Card aria-disabled="true" className="w-full max-w-sm opacity-60">
        <CardTitle>Race Room</CardTitle>
        <p className="text-sm text-muted">Coming soon</p>
      </Card>
      <ThemeToggle />
    </main>
  );
}
