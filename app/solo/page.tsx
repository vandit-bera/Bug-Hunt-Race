import { SoloSetup } from "@/components/solo/solo-setup";
import { PUZZLES } from "@/lib/puzzles/generated";
import { countPools } from "@/lib/puzzles/pools";

export const metadata = { title: "Solo Practice · Bug Hunt Race" };

export default function SoloPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <SoloSetup pools={countPools(PUZZLES)} />
    </main>
  );
}
