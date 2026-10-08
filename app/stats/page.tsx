import { StatsView } from "@/components/stats/stats-view";

export const metadata = { title: "My Stats · Bug Hunt Race" };

export default function StatsPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
      <StatsView />
    </main>
  );
}
