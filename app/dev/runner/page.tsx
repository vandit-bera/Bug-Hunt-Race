import type { Metadata } from "next";
import { RunnerLab } from "./runner-lab";

export const metadata: Metadata = {
  title: "Runner lab · Bug Hunt Race",
  robots: { index: false },
};

/** Dev page for trying the code runner; the game screens replace it later. */
export default function RunnerLabPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Runner lab</h1>
        <p className="text-muted">
          Runs code and tests in a sandboxed Web Worker, exactly like a round
          will. Nothing is sent to a server.
        </p>
      </header>
      <RunnerLab />
    </main>
  );
}
