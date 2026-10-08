import { Suspense } from "react";
import { SoloGame } from "@/components/solo/solo-game";
import { Spinner } from "@/components/ui/spinner";

export const metadata = { title: "Solo Practice · Bug Hunt Race" };

export default function SoloPlayPage() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center">
            <Spinner size="lg" label="Loading game" />
          </div>
        }
      >
        <SoloGame />
      </Suspense>
    </main>
  );
}
