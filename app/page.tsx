import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
        Bug Hunt Race 🐛
      </h1>
      <p className="max-w-md text-lg text-muted">
        Race your team to fix buggy code. Fastest correct fix wins.
      </p>
      <ThemeToggle />
    </main>
  );
}
